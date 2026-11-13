import 'server-only'
import { Payment, PaymentRefund } from 'mercadopago'
import { getMercadoPagoClient } from '@/lib/mercadopago'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { registrarPagamentoVerificado } from '@/lib/pagamentos'
import { ErroHttp } from '@/lib/autorizacao'
import type { Pedido } from '@/types/loja'
import type { CancelamentoPedido } from '@/types/cancelamento'

type Db = ReturnType<typeof getSupabaseAdmin>
interface Resumo { pedido_id: string; pode_cancelar: boolean; cancelamento: CancelamentoPedido | null }
interface Trabalho {
  pedido: Pedido & { mp_payment_id: string | null }
  cancelamento: { pedido_id: string; lease_id: string; reembolso_chave: string; pagamento_id: string | null; valor: number }
}
class FalhaReembolso extends Error {}

export function validarIdCancelamento(id: unknown) {
  if (typeof id !== 'string' || !/^(?:[1-9]\d{0,19}|[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})$/i.test(id)) throw new ErroHttp(400, 'Pedido inválido.')
  return id
}

export async function incluirCancelamentos<T extends Pick<Pedido, 'id'>>(db: Db, pedidos: T[], admin = false): Promise<(T & { pode_cancelar: boolean; cancelamento: CancelamentoPedido | null })[]> {
  const resumos = new Map<string, Resumo>()
  for (let inicio = 0; inicio < pedidos.length; inicio += 100) {
    const { data, error } = await db.rpc('hh_resumo_cancelamentos', { p_ids: pedidos.slice(inicio, inicio + 100).map(p => String(p.id)), p_admin: admin })
    if (error) throw Error('Não foi possível conferir os cancelamentos dos pedidos.')
    for (const r of (data || []) as Resumo[]) resumos.set(r.pedido_id, r)
  }
  return pedidos.map(p => {
    const r = resumos.get(String(p.id))
    return { ...p, pode_cancelar: r?.pode_cancelar ?? false, cancelamento: r?.cancelamento || null }
  })
}

export async function solicitarCancelamento(db: Db, user: { id: string | number; email: string }, id: string, body: Record<string, unknown>, admin = false) {
  if (body.confirmar !== true || typeof body.motivo !== 'string' || body.motivo.trim().length < 3 || body.motivo.length > 500
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body.motivo)) throw new ErroHttp(400, 'Confirme o cancelamento e informe um motivo com 3 a 500 caracteres.')
  let query = db.from('pedidos').select('id').eq('id', id)
  if (!admin) query = query.eq('cliente_email', user.email)
  const { data: pedido, error } = await query.maybeSingle()
  if (error) throw Error('Não foi possível consultar o pedido.')
  if (!pedido) throw new ErroHttp(404, 'Pedido não encontrado.')
  const { error: erroCancelamento } = await db.rpc('hh_solicitar_cancelamento_entrega', {
    p_pedido_id: id, p_email: user.email, p_admin: admin, p_solicitante: String(user.id), p_motivo: body.motivo.trim(),
  })
  if (erroCancelamento) throw new ErroHttp(409, 'O cancelamento automático exige pagamento confirmado e envio ainda não iniciado. Atualize o pedido; se houver etiqueta, envio ou revisão financeira, fale com o atendimento.')
}

export async function processarCancelamentos(pedidoId?: string) {
  const db = getSupabaseAdmin()
  const { data, error } = await db.rpc('hh_claim_cancelamentos', { p_pedido_id: pedidoId || null, p_limite: 3 })
  if (error) throw Error('Não foi possível reservar os cancelamentos pendentes.')
  let concluidos = 0, pendentes = 0
  for (const { pedido, cancelamento } of (data || []) as Trabalho[]) {
    try {
      const centavos = (valor: unknown) => Math.round(Number(valor) * 100)
      if (pedido.mp_payment_id !== cancelamento.pagamento_id || !Number.isFinite(Number(pedido.total))
        || centavos(pedido.total) !== centavos(cancelamento.valor) || pedido.entrega?.modalidade === 'retirada'
        || ['enviado', 'entregue'].includes(pedido.status)) throw new FalhaReembolso('Os dados do pedido mudaram. Confira o pagamento e o envio antes de retomar o reembolso.')
      if (Number(pedido.total) > 0) {
        if (!pedido.mp_payment_id || !/^\d{1,30}$/.test(pedido.mp_payment_id)) throw new FalhaReembolso('Pagamento não identificado. Confira o Mercado Pago antes de retomar o reembolso.')
        const provider = new Payment(getMercadoPagoClient())
        const conferir = async () => {
          const p = await provider.get({ id: pedido.mp_payment_id! })
          if (String(p.id) !== pedido.mp_payment_id || String(p.external_reference) !== String(pedido.id) || p.currency_id !== 'BRL'
            || !Number.isFinite(Number(p.transaction_amount)) || centavos(p.transaction_amount) !== centavos(pedido.total)) throw new FalhaReembolso('O pagamento retornado não corresponde ao pedido e ao valor original. Confira o Mercado Pago.')
          return p
        }
        let pagamento = await conferir()
        if (pagamento.status !== 'refunded') {
          if (pagamento.status !== 'approved' || Number(pagamento.transaction_amount_refunded) > 0) throw new FalhaReembolso('Pagamento pendente, contestado ou com estorno parcial. Confira o Mercado Pago antes de retomar.')
          await new PaymentRefund(getMercadoPagoClient()).total({ payment_id: pedido.mp_payment_id, requestOptions: { idempotencyKey: cancelamento.reembolso_chave } })
          pagamento = await conferir()
        }
        await registrarPagamentoVerificado(db, pagamento, pedido.mp_payment_id)
        if (pagamento.status !== 'refunded' || centavos(pagamento.transaction_amount_refunded) !== centavos(pedido.total)) throw new FalhaReembolso('O Mercado Pago ainda não confirmou o reembolso integral. O sistema consultará novamente.')
      }
      const { data: concluido, error } = await db.rpc('hh_concluir_cancelamento_entrega', { p_pedido_id: String(pedido.id), p_lease: cancelamento.lease_id })
      if (error || !concluido) throw new FalhaReembolso('Falta concluir o registro do cancelamento. O sistema conferirá o pagamento novamente antes de atualizar o estoque e os créditos.')
      concluidos++
    } catch (error) {
      pendentes++
      const mensagem = error instanceof FalhaReembolso ? error.message : 'O reembolso não foi confirmado. Confira saldo disponível, credenciais e condições do pagamento no Mercado Pago. A fila tentará novamente com a mesma chave.'
      const { error: falha } = await db.rpc('hh_falha_cancelamento_entrega', { p_pedido_id: String(pedido.id), p_lease: cancelamento.lease_id, p_erro: mensagem })
      if (falha) console.error('[cancelamento] Pendência será retomada após o lease.', { pedidoId: pedido.id })
    }
  }
  return { consultados: (data || []).length, concluidos, pendentes }
}
