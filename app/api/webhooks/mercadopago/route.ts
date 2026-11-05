import { NextResponse, after } from 'next/server'
import { Payment } from 'mercadopago'
import { getMercadoPagoClient, validarAssinatura } from '@/lib/mercadopago'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { processarNotificacoes } from '@/lib/notificacoes'
import { processarEnvioAutomatico } from '@/lib/envio-automatico'

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
    if (pagamento.status !== 'approved') {
      return NextResponse.json({ received: true, status: pagamento.status })
    }
    if (!pagamento.external_reference || pagamento.currency_id !== 'BRL') {
      throw new Error('Pagamento aprovado sem referencia valida ou moeda BRL.')
    }
    const pedidoId = String(pagamento.external_reference)
    // A transacao atualiza o pedido, credita cashback uma vez e persiste os e-mails.
    const { error } = await getSupabaseAdmin().rpc('hh_confirmar_pagamento', {
      p_pedido_id: pedidoId,
      p_pagamento_id: paymentId,
      p_total: pagamento.transaction_amount,
    })
    if (error) throw new Error('Falha ao confirmar pedido: ' + error.message)

    // A fila ja esta persistida. after mantem o envio ativo na Vercel apos o ACK.
    after(async () => {
      const resultados = await Promise.allSettled([processarNotificacoes(pedidoId, 6), processarEnvioAutomatico(pedidoId)])
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
