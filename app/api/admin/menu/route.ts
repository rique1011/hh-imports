import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { exigirAdmin, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
import { lerJson, limitar } from '@/lib/seguranca'
import { slugCategoria } from '@/lib/categorias'
import { TIPOS_MENU, slugSelecaoValido } from '@/lib/selecoes'
import { COLUNAS_MENU } from '@/lib/navegacao-servidor'

const headers = { 'Cache-Control': 'private, no-store' }
export async function GET(request: Request) {
  try {
    const { db } = await exigirAdmin(request)
    const { data, error } = await db.from('loja_navegacao').select(COLUNAS_MENU).order('ordem').order('nome').limit(100)
    if (error) throw error
    return NextResponse.json({ itens: data || [] }, { headers })
  } catch (e) { return responderErro(e) }
}

export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirAdmin(request)
    await limitar(request, 'editar-menu', 60, 600, String(user.id))
    const body = await lerJson(request)
    if (Object.keys(body).some(k => !['id','nome','descricao','tipo','regra','ativo','ordem','versao'].includes(k))) throw new ErroHttp(400, 'Campo não permitido.')
    const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
    const descricao = typeof body.descricao === 'string' ? body.descricao.trim() : null
    if (nome.length < 2 || nome.length > 60 || /[\u0000-\u001f\u007f<>]/.test(nome) || !slugSelecaoValido(slugCategoria(nome))) throw new ErroHttp(400, 'Use um nome com 2 a 60 caracteres.')
    if (descricao === null || descricao.length > 240 || /[\u0000-\u001f\u007f<>]/.test(descricao)) throw new ErroHttp(400, 'Use uma descrição com até 240 caracteres, sem marcação.')
    if (typeof body.ativo !== 'boolean' || !Number.isSafeInteger(body.ordem) || Number(body.ordem) < 0 || Number(body.ordem) > 999) throw new ErroHttp(400, 'Confira a visibilidade e a ordem do item.')
    if (!(TIPOS_MENU as readonly unknown[]).includes(body.tipo) || (body.regra !== 'manual' && body.regra !== 'recentes')
      || (body.tipo !== 'selecao' && body.regra !== 'manual')) throw new ErroHttp(400, 'Selecione um destino válido para o menu.')
    let result
    if (body.id !== undefined) {
      if (typeof body.id !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(body.id)
        || !Number.isSafeInteger(body.versao) || Number(body.versao) < 1) throw new ErroHttp(400, 'Recarregue o item antes de editar.')
      const { data: atual, error } = await user.db.from('loja_navegacao').select('tipo').eq('id', body.id).maybeSingle()
      if (error) throw error
      if (!atual) throw new ErroHttp(404, 'Item não encontrado.')
      if (atual.tipo !== body.tipo) throw new ErroHttp(400, 'Crie outro item para mudar o destino, preservando os links e produtos desta campanha.')
      result = await user.db.from('loja_navegacao').update({ nome, descricao, regra: body.regra, ativo: body.ativo, ordem: body.ordem, versao: Number(body.versao) + 1 })
        .eq('id', body.id).eq('versao', body.versao).select(COLUNAS_MENU).maybeSingle()
      if (!result.error && !result.data) throw new ErroHttp(409, 'O menu foi atualizado em outra aba. Recarregue antes de salvar.')
    } else {
      const { count, error } = await user.db.from('loja_navegacao').select('id', { count: 'exact', head: true })
      if (error) throw error
      if ((count || 0) >= 100) throw new ErroHttp(400, 'Você já possui 100 itens. Edite ou reative um item existente.')
      result = await user.db.from('loja_navegacao').insert({ nome, slug: slugCategoria(nome), descricao, tipo: body.tipo, regra: body.regra, ativo: body.ativo, ordem: body.ordem }).select(COLUNAS_MENU).single()
    }
    if (result.error?.code === '23505') throw new ErroHttp(409, 'Já existe um item com este endereço. Edite ou reative o item existente.')
    if (result.error) throw result.error
    revalidateTag('navegacao-publica', { expire: 0 })
    revalidateTag('vitrine-publica', { expire: 0 })
    return NextResponse.json({ item: result.data }, { headers })
  } catch (e) { return responderErro(e) }
}
