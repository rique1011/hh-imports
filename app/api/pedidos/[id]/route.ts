import { NextResponse } from 'next/server'
import { pedidoParaCliente, COLUNAS_PEDIDO_CLIENTE } from '@/lib/pedido-dto'
import { exigirUsuario, responderErro, ErroHttp } from '@/lib/autorizacao'
import { incluirEventosPedidos } from '@/lib/eventos-pedido'
import { incluirRetiradas } from '@/lib/retirada-pedidos'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await exigirUsuario(request)
    const { id } = await params
    const { data, error } = await user.db.from('pedidos').select(COLUNAS_PEDIDO_CLIENTE)
      .eq('id', id).eq('cliente_email', user.email).maybeSingle()
    if (error) throw error
    if (!data) throw new ErroHttp(404, 'Pedido não encontrado.')
    const [pedido] = await incluirEventosPedidos(user.db, await incluirRetiradas(user.db, [data], true))
    return NextResponse.json(pedidoParaCliente(pedido), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return responderErro(error) }
}
