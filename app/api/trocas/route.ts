import { NextResponse } from 'next/server'
import { exigirUsuario, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirUsuario(request)
    const { pedidoId, produtoId, motivo, fotoUrl } = await request.json()
    if (!pedidoId || !produtoId || !['arrependimento','defeito','tamanho'].includes(motivo)) throw new ErroHttp(400, 'Solicitação inválida.')
    const { data: pedido, error } = await user.db.from('pedidos').select('id,status,itens')
      .eq('id', pedidoId).eq('cliente_email', user.email).maybeSingle()
    if (error) throw error
    if (!pedido || pedido.status?.toLowerCase() !== 'entregue' ||
      !Array.isArray(pedido.itens) || !pedido.itens.some((item: { id: string }) => String(item.id) === String(produtoId))) {
      throw new ErroHttp(404, 'Item entregue não encontrado para esta conta.')
    }
    const item = pedido.itens.find((item: { id: string }) => String(item.id) === String(produtoId))
    const pasta = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '') + '/storage/v1/object/public/joias/trocas/' + user.id + '/'
    const fotoPropria = typeof fotoUrl === 'string' && fotoUrl.startsWith(pasta)
    if (motivo === 'defeito' && !fotoPropria) throw new ErroHttp(400, 'Envie a foto do defeito pela sua conta.')
    if (fotoUrl && !fotoPropria && fotoUrl !== item.foto) throw new ErroHttp(400, 'Foto inválida.')
    const { data: existente, error: buscaError } = await user.db.from('trocas').select('id')
      .eq('pedido_id', String(pedidoId)).eq('produto_id', produtoId).maybeSingle()
    if (buscaError) throw buscaError
    if (existente) throw new ErroHttp(409, 'Você já abriu uma solicitação para este item.')
    const { error: insertError } = await user.db.from('trocas').insert({ pedido_id: String(pedidoId), produto_id: produtoId,
      usuario_id: user.id, motivo, foto_url: fotoUrl || null, status: 'analise_pendente' })
    if (insertError?.code === '23505') throw new ErroHttp(409, 'Você já abriu uma solicitação para este item.')
    if (insertError) throw insertError
    return NextResponse.json({ sucesso: true, status: 'analise_pendente', mensagem: 'Solicitação recebida. Nossa equipe analisará as fotos e enviará o código de postagem reversa em até 48h.' })
  } catch (error) { return responderErro(error) }
}
