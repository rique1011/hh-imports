import { NextResponse } from 'next/server'
import { dataEntregaDosItens } from '@/lib/prazo-devolucao'
import { exigirUsuario, responderErro } from '@/lib/autorizacao'
import { incluirEventosPedidos } from '@/lib/eventos-pedido'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  try {
    const user = await exigirUsuario(request)
    const { data, error } = await user.db.from('pedidos')
      .select('id,created_at,status,total,itens,codigo_rastreio')
      .eq('cliente_email', user.email).order('created_at', { ascending: false })
    if (error) throw error
    const pedidos = await incluirEventosPedidos(user.db, data || [])
    return NextResponse.json(pedidos.map(pedido => ({ ...pedido, data_entrega: dataEntregaDosItens(pedido.itens) })), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return responderErro(error) }
}
