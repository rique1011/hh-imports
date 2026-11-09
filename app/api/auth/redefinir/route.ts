import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import bcrypt from 'bcryptjs'
import { validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
import { hash, lerJson, limitar, validarSenha, FalhaSeguranca } from '@/lib/seguranca'
import { minimoSenha } from '@/lib/politica-senha'

export async function POST(request: Request) {
  try {
    validarOrigem(request)
    await limitar(request, 'redefinir', 10, 900)
    const { token, novaSenha } = await lerJson(request)
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new ErroHttp(400, 'Link inválido ou expirado.')
    const db = getSupabaseAdmin(), tokenHash = hash(token)
    const { data: usuario, error: consulta } = await db.from('usuarios').select('id,perfil,role,sessao_versao')
      .eq('recovery_token', tokenHash).gt('recovery_token_expires', new Date().toISOString()).eq('bloqueado', false).maybeSingle()
    if (consulta) throw new Error('Recuperação indisponível.')
    if (!usuario) throw new ErroHttp(400, 'Link inválido, já utilizado ou expirado. Solicite outro.')
    const administrador = [usuario.perfil, usuario.role].includes('admin')
    try { validarSenha(novaSenha, administrador) }
    catch (error) {
      if (error instanceof FalhaSeguranca) return NextResponse.json({ error: error.message, minimoSenha: minimoSenha(administrador) }, { status: error.status })
      throw error
    }
    const senha = await bcrypt.hash(novaSenha, 12)
    // Um único UPDATE consome o token e revoga as sessões. A versão impede também
    // aplicar a regra de cliente se a conta virar admin durante o processamento.
    let atualizacao = db.from('usuarios').update({ senha, recovery_token: null, recovery_token_expires: null,
      sessao_versao: usuario.sessao_versao + 1, senha_politica_versao: 1 })
      .eq('id', usuario.id).eq('sessao_versao', usuario.sessao_versao).eq('recovery_token', tokenHash)
      .gt('recovery_token_expires', new Date().toISOString()).eq('bloqueado', false)
    atualizacao = usuario.perfil == null ? atualizacao.is('perfil', null) : atualizacao.eq('perfil', usuario.perfil)
    atualizacao = usuario.role == null ? atualizacao.is('role', null) : atualizacao.eq('role', usuario.role)
    const { data, error } = await atualizacao.select('id')
    if (error) throw new Error('Recuperação indisponível.')
    if (!data?.length) throw new ErroHttp(400, 'Link inválido, já utilizado ou expirado. Solicite outro.')
    return NextResponse.json({ success: true })
  } catch (error) { return responderErro(error) }
}
