import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { exigirAdmin, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
import { lerJson, limitar } from '@/lib/seguranca'
import { slugCategoria } from '@/lib/categorias'
import { COLUNAS_CATEGORIAS } from '@/lib/categorias-servidor'

const headers = { 'Cache-Control': 'private, no-store' }
export async function GET(request: Request) {
  try {
    const { db } = await exigirAdmin(request)
    const { data, error } = await db.from('categorias').select(COLUNAS_CATEGORIAS).order('ordem').order('nome').limit(100)
    if (error) throw error
    return NextResponse.json({ categorias: data || [] }, { headers })
  } catch (e) { return responderErro(e) }
}
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirAdmin(request)
    await limitar(request, 'editar-categorias', 30, 600, String(user.id))
    const body = await lerJson(request)
    if (Object.keys(body).some(k => !['id','nome','ativo','ordem','versao'].includes(k))) throw new ErroHttp(400, 'Campo não permitido.')
    const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
    if (nome.length < 2 || nome.length > 60 || /[\u0000-\u001f<>]/.test(nome) || !slugCategoria(nome)) throw new ErroHttp(400, 'Use um nome de categoria com 2 a 60 caracteres.')
    if (typeof body.ativo !== 'boolean' || !Number.isSafeInteger(body.ordem) || Number(body.ordem) < 0 || Number(body.ordem) > 999) throw new ErroHttp(400, 'Confira a visibilidade e a ordem da categoria.')
    let result
    if (body.id !== undefined) {
      if (typeof body.id !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(body.id)
        || !Number.isSafeInteger(body.versao) || Number(body.versao) < 1) throw new ErroHttp(400, 'Recarregue a categoria antes de editar.')
      // O endereço da categoria é estável mesmo ao alterar o nome ou ocultar a categoria.
      result = await user.db.from('categorias').update({ nome, ativo: body.ativo, ordem: body.ordem, versao: Number(body.versao) + 1 })
        .eq('id', body.id).eq('versao', body.versao).select(COLUNAS_CATEGORIAS).maybeSingle()
      if (!result.error && !result.data) throw new ErroHttp(409, 'A categoria foi atualizada em outra aba. Recarregue antes de salvar.')
    } else {
      const { count, error } = await user.db.from('categorias').select('id', { count: 'exact', head: true })
      if (error) throw error
      if ((count || 0) >= 100) throw new ErroHttp(400, 'Você já possui 100 categorias. Edite ou reative uma categoria existente.')
      result = await user.db.from('categorias').insert({ nome, slug: slugCategoria(nome), ativo: body.ativo, ordem: body.ordem }).select(COLUNAS_CATEGORIAS).single()
    }
    if (result.error?.code === '23505') throw new ErroHttp(409, 'Já existe uma categoria com este nome ou endereço. Edite ou reative a categoria existente.')
    if (result.error) throw result.error
    revalidateTag('categorias-publicas', { expire: 0 })
    revalidateTag('vitrine-publica', { expire: 0 })
    return NextResponse.json({ categoria: result.data }, { headers })
  } catch (e) { return responderErro(e) }
}
