import { NextResponse } from 'next/server'
import { dataEntregaDosItens } from '@/lib/prazo-devolucao'
import { exigirUsuario, responderErro, ErroHttp } from '@/lib/autorizacao'
import { incluirEventosPedidos } from '@/lib/eventos-pedido'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await exigirUsuario(request)
    const { id } = await params
    const { data, error } = await user.db.from('pedidos').select('id,created_at,status,total,itens,codigo_rastreio')
      .eq('id', id).eq('cliente_email', user.email).maybeSingle()
    if (error) throw error
    if (!data) throw new ErroHttp(404, 'Pedido não encontrado.')
    const [pedido] = await incluirEventosPedidos(user.db, [data])
    return NextResponse.json({ ...pedido, data_entrega: dataEntregaDosItens(pedido.itens) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return responderErro(error) }
}
