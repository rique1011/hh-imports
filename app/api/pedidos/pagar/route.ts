import { NextResponse } from 'next/server'
import { exigirUsuario, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
import { criarPreferenciaPedido } from '@/lib/pagamentos'
import { limitar, lerJson } from '@/lib/seguranca'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirUsuario(request)
    await limitar(request,'retomar-pagamento',10,60,String(user.id))
    const { pedidoId } = await lerJson(request)
    if (!pedidoId) throw new ErroHttp(400, 'Pedido inválido.')
    const { data: pedido, error } = await user.db.from('pedidos').select('*').eq('id', pedidoId).eq('cliente_email', user.email).maybeSingle()
    if (error) throw error
    if (!pedido) throw new ErroHttp(404, 'Pedido não encontrado.')
    if (Number(pedido.total) <= 0) throw new ErroHttp(409, 'Este pedido não possui pagamento pendente.')
    return NextResponse.json({ urlPagamento: await criarPreferenciaPedido(user.db, pedido, user.email) })
  } catch (error) { return responderErro(error) }
}
