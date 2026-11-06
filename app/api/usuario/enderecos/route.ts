import { limitar, lerJson } from '@/lib/seguranca'
import { NextResponse } from 'next/server'
import { exigirUsuario, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
import { listarEnderecos } from '@/lib/enderecos-servidor'
import { normalizarEndereco } from '@/lib/enderecos'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  try { const user = await exigirUsuario(request); return NextResponse.json(await listarEnderecos(user.db, user.id), { headers: { 'Cache-Control': 'private, no-store' } }) }
  catch (error) { return responderErro(error) }
}
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirUsuario(request)
    await limitar(request,'enderecos',30,600,String(user.id))
    const body = await lerJson(request)
    if (typeof body.acao!=='string' || !['salvar', 'excluir', 'padrao'].includes(body.acao) || (body.id != null && (typeof body.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)))) throw new ErroHttp(400, 'Endereço inválido.')
    let dados = null
    if (body.acao === 'salvar') { try { dados = normalizarEndereco(body.dados) } catch (e) { throw new ErroHttp(400, (e as Error).message) } }
    if (body.acao === 'salvar' && (typeof body.apelido !== 'string' || !body.apelido.trim() || body.apelido.trim().length > 60)) throw new ErroHttp(400, 'Informe um nome para o endereço.')
    const { data, error } = await user.db.rpc('hh_endereco_usuario', { p_email: user.email, p_acao: body.acao, p_id: body.id || null,
      p_dados: dados, p_apelido: typeof body.apelido==='string' ? body.apelido.trim() : null, p_padrao: body.padrao === true })
    if (error?.message?.includes('Endereco nao encontrado')) throw new ErroHttp(404, 'Endereço não encontrado.')
    if (error) throw error
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return responderErro(error) }
}
