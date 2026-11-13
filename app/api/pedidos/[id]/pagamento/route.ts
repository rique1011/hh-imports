import { after, NextResponse } from 'next/server'
import { exigirUsuario, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
import { sincronizarPagamentoPedido } from '@/lib/pagamentos'
import { STATUS_PAGOS } from '@/lib/pagamento-pedido'
import { pedidoParaCliente, COLUNAS_PEDIDO_CLIENTE } from '@/lib/pedido-dto'
import { incluirEventosPedidos } from '@/lib/eventos-pedido'
import { processarNotificacoes } from '@/lib/notificacoes'
import { processarEnvioAutomatico } from '@/lib/envio-automatico'
import { incluirRetiradas } from '@/lib/retirada-pedidos'
import { limitar, lerJson } from '@/lib/seguranca'
import { incluirCancelamentos } from '@/lib/cancelamentos'
export const runtime = 'nodejs'
export const maxDuration = 120
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    validarOrigem(request)
    const user = await exigirUsuario(request), { id } = await params
    await limitar(request,'consultar-pagamento',30,60,String(user.id))
    const { data: pedido, error } = await user.db.from('pedidos').select('*').eq('id', id).eq('cliente_email', user.email).maybeSingle()
    if (error) throw error
    if (!pedido) throw new ErroHttp(404, 'Pedido não encontrado.')
    const body = request.body ? await lerJson(request) : {}
    if (body.paymentId != null && typeof body.paymentId !== 'string') throw new ErroHttp(400, 'Pagamento inválido.')
    const atualizado = await sincronizarPagamentoPedido(user.db, pedido, typeof body.paymentId === 'string' ? body.paymentId : undefined)
    if (STATUS_PAGOS.has(atualizado.status.toLowerCase()) || atualizado.status === 'pagamento_em_analise') {
      after(async () => {
        const trabalhos: Promise<unknown>[] = [processarNotificacoes(id, 6)]
        if (STATUS_PAGOS.has(atualizado.status.toLowerCase()) && atualizado.entrega?.modalidade !== 'retirada') trabalhos.push(processarEnvioAutomatico(id))
        await Promise.allSettled(trabalhos)
      })
    }
    const { data, error: leitura } = await user.db.from('pedidos').select(COLUNAS_PEDIDO_CLIENTE).eq('id', id).eq('cliente_email', user.email).single()
    if (leitura) throw leitura
    const [comEventos] = await incluirEventosPedidos(user.db, await incluirCancelamentos(user.db, await incluirRetiradas(user.db, [data], true)))
    return NextResponse.json(pedidoParaCliente(comEventos), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return responderErro(error) }
}
