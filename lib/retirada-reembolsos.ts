import 'server-only'
import { Payment, PaymentRefund } from 'mercadopago'
import { getMercadoPagoClient } from '@/lib/mercadopago'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { registrarPagamentoVerificado } from '@/lib/pagamentos'
import type { Pedido } from '@/types/loja'

interface Trabalho {
  pedido: Pedido & { mp_payment_id: string | null }
  retirada: { pedido_id: string; lease_id: string; reembolso_chave: string }
}

export async function processarReembolsosRetirada(pedidoId?: string) {
  const db = getSupabaseAdmin()
  if (!pedidoId) {
    const { error: prazoError } = await db.rpc('hh_preparar_prazos_retirada')
    if (prazoError) throw Error('Não foi possível conferir os prazos de retirada.')
  }
  const { data, error } = await db.rpc('hh_claim_retirada_reembolsos', { p_pedido_id: pedidoId || null, p_limite: 3 })
  if (error) throw Error('Não foi possível reservar os reembolsos de retirada.')
  let concluidos = 0, pendentes = 0
  for (const { pedido, retirada } of (data || []) as Trabalho[]) {
    try {
      if (Number(pedido.total) > 0) {
        if (!pedido.mp_payment_id || !/^\d{1,30}$/.test(pedido.mp_payment_id)) throw Error('Pagamento não identificado. Confira o Mercado Pago antes de reembolsar.')
        const provider = new Payment(getMercadoPagoClient())
        const conferir = async () => {
          const p = await provider.get({ id: pedido.mp_payment_id! })
          if (String(p.external_reference) !== String(pedido.id) || String(p.id) !== pedido.mp_payment_id || p.currency_id !== 'BRL'
            || Math.round(Number(p.transaction_amount) * 100) !== Math.round(Number(pedido.total) * 100)) throw Error('Pagamento incompatível. Confira o Mercado Pago.')
          return p
        }
        let pagamento = await conferir()
        if (pagamento.status !== 'refunded') {
          if (pagamento.status !== 'approved' || Number(pagamento.transaction_amount_refunded) > 0 || pedido.pagamento?.requer_revisao) throw Error('Pagamento em revisão ou com estorno parcial. Regularize no Mercado Pago e tente novamente.')
          // A chave é persistida no banco e permanece igual inclusive após timeout ou outro worker.
          await new PaymentRefund(getMercadoPagoClient()).total({ payment_id: pedido.mp_payment_id, requestOptions: { idempotencyKey: retirada.reembolso_chave } })
          pagamento = await conferir()
        }
        await registrarPagamentoVerificado(db, pagamento, pedido.mp_payment_id)
        if (pagamento.status !== 'refunded' || Number(pagamento.transaction_amount_refunded) < Number(pedido.total)) throw Error('O provedor ainda não confirmou o reembolso integral. O sistema consultará novamente.')
      }
      const r = await db.rpc('hh_concluir_reembolso_retirada', { p_pedido_id: String(pedido.id), p_lease: retirada.lease_id })
      if (r.error || !r.data) throw Error('Reembolso confirmado; falta concluir a reposição do estoque. O sistema tentará novamente.')
      concluidos++
    } catch {
      pendentes++
      const r = await db.rpc('hh_falha_reembolso_retirada', { p_pedido_id: retirada.pedido_id, p_lease: retirada.lease_id })
      if (r.error) console.error('[retirada] Pendência será retomada após o lease.', { pedidoId: pedido.id })
    }
  }
  return { consultados: (data || []).length, concluidos, pendentes }
}
