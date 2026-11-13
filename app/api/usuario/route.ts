import { NextResponse } from 'next/server'
import { exigirUsuario, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
import { limitar, lerJson } from '@/lib/seguranca'

import { listarEnderecos } from '@/lib/enderecos-servidor'
import { normalizarEndereco, enderecoPadrao } from '@/lib/enderecos'

export const dynamic = 'force-dynamic'
const CAMPOS = 'id,nome,email,cpf_cnpj,whatsapp,data_nascimento,endereco,saldo_cashback,created_at,perfil,role'

export async function GET(request: Request) {
  try {
    const user = await exigirUsuario(request)
    const [{ data, error }, { count, error: ordersError }] = await Promise.all([
      user.db.from('usuarios').select(CAMPOS).eq('id', user.id).single(),
      user.db.from('pedidos').select('id', { count: 'exact', head: true }).eq('cliente_email', user.email),
    ])
    if (error || ordersError) throw error || ordersError
    const enderecos = await listarEnderecos(user.db, user.id)
    return NextResponse.json({ ...data, enderecos, possui_pedidos: Boolean(count) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return responderErro(error) }
}

export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirUsuario(request)
    await limitar(request,'atualizar-cadastro',30,600,String(user.id))
    const body = await lerJson(request)
    const campos = ['cpf_cnpj','whatsapp','data_nascimento'] as const
    const update: Record<string, string> = {}
    for (const campo of campos) {
      if (typeof body[campo] !== 'string' || body[campo].length > 100) {
        throw new ErroHttp(400, 'Dados de cadastro inválidos.')
      }
      update[campo] = body[campo]
    }
    if (typeof body.endereco === 'string') {
      let dados
      try { dados = normalizarEndereco(JSON.parse(body.endereco)) } catch { throw new ErroHttp(400, 'Endereço inválido.') }
      const atual = enderecoPadrao(await listarEnderecos(user.db, user.id))
      const { error } = await user.db.rpc('hh_endereco_usuario', { p_email: user.email, p_acao: 'salvar', p_id: atual?.id || null, p_dados: dados, p_apelido: atual?.apelido || 'Principal', p_padrao: true })
      if (error) throw error
    }
    const { error } = await user.db.from('usuarios').update(update).eq('id', user.id)
    if (error) throw error
    return NextResponse.json({ sucesso: true })
  } catch (error) { return responderErro(error) }
}
