import { NextResponse, after } from 'next/server'
import { Payment } from 'mercadopago'
import { getMercadoPagoClient, validarAssinatura } from '@/lib/mercadopago'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { processarNotificacoes } from '@/lib/notificacoes'
import { processarEnvioAutomatico } from '@/lib/envio-automatico'

import { registrarPagamentoVerificado } from '@/lib/pagamentos'
import { STATUS_PAGOS } from '@/lib/pagamento-pedido'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const body = await request.json().catch(() => ({}))
    const type = body.type || url.searchParams.get('type') || url.searchParams.get('topic')
    if (type !== 'payment' && !String(body.action || '').startsWith('payment.')) {
      return NextResponse.json({ received: true, ignored: true })
    }
    const queryId = url.searchParams.get('data.id') || url.searchParams.get('id')
    const paymentId = String(queryId || body.data?.id || '')
    if (!/^\d+$/.test(paymentId) ||
        (queryId && body.data?.id && String(body.data.id) !== queryId)) {
      return NextResponse.json({ error: 'Identificador de pagamento invalido.' }, { status: 400 })
    }
    if (!validarAssinatura(request, paymentId)) {
      return NextResponse.json({ error: 'Assinatura invalida.' }, { status: 401 })
    }

    // O status confiavel vem da API autenticada, nunca do corpo do webhook.
    const pagamento = await new Payment(getMercadoPagoClient()).get({ id: paymentId })
    const pedido = await registrarPagamentoVerificado(getSupabaseAdmin(), pagamento, paymentId)
    const pedidoId = String(pedido.id)
    if (pagamento.status !== 'approved') return NextResponse.json({ received: true, pedidoId })

    // A fila ja esta persistida. after mantem o envio ativo na Vercel apos o ACK.
    after(async () => {
      const trabalhos: Promise<unknown>[] = [processarNotificacoes(pedidoId, 6)]
      if (STATUS_PAGOS.has(pedido.status.toLowerCase())) trabalhos.push(processarEnvioAutomatico(pedidoId))
      const resultados = await Promise.allSettled(trabalhos)
      resultados.forEach((resultado, indice) => {
        if (resultado.status === 'rejected') console.error('[webhook] Trabalho persistido aguarda retry.', { pedidoId, fila: indice === 0 ? 'email' : 'envio' })
      })
    })
    return NextResponse.json({ received: true, pedidoId })
  } catch (error) {
    console.error('[webhook] Falha no processamento:', error)
    // Sem confirmacao persistida, o Mercado Pago deve tentar novamente.
    return NextResponse.json({ error: 'Falha ao processar notificacao.' }, { status: 503 })
  }
}
