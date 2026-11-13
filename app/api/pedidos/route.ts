import { NextResponse } from 'next/server'
import { pedidoParaCliente, COLUNAS_PEDIDO_CLIENTE } from '@/lib/pedido-dto'
import { exigirUsuario, responderErro } from '@/lib/autorizacao'
import { incluirEventosPedidos } from '@/lib/eventos-pedido'
import { incluirRetiradas } from '@/lib/retirada-pedidos'
import { incluirCancelamentos } from '@/lib/cancelamentos'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  try {
    const user = await exigirUsuario(request)
    const { data, error } = await user.db.from('pedidos')
      .select(COLUNAS_PEDIDO_CLIENTE)
      .eq('cliente_email', user.email).order('created_at', { ascending: false })
    if (error) throw error
    const pedidos = await incluirEventosPedidos(user.db, await incluirCancelamentos(user.db, await incluirRetiradas(user.db, data || [], true)))
    return NextResponse.json(pedidos.map(pedidoParaCliente), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return responderErro(error) }
}
