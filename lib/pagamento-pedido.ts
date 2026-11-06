import type { Pedido } from '@/types/loja'
export const STATUS_PAGOS = new Set(['pago', 'confirmado', 'processando', 'enviado', 'entregue'])
export function prazoPagamento(pedido: Pick<Pedido, 'created_at' | 'pagamento_expira_em'>) {
  if (pedido.pagamento_expira_em) return pedido.pagamento_expira_em
  const criado = Date.parse(pedido.created_at)
  return Number.isFinite(criado) ? new Date(criado + 24 * 3600_000).toISOString() : ''
}
export function pedidoNaoConcluido(pedido: Pick<Pedido, 'created_at' | 'pagamento_expira_em' | 'status'>, agora = Date.now()) {
  return pedido.status.toLowerCase() === 'cancelado' || (pedido.status.toLowerCase() === 'pendente' && Date.parse(prazoPagamento(pedido)) <= agora)
}
export function nomePagamento(pedido: Pick<Pedido, 'status' | 'pagamento'>) {
  const p = pedido.pagamento
  if (p?.metodo === 'cashback') return 'Créditos da loja'
  if (p?.metodo === 'isento') return 'Sem cobrança'
  if (p?.metodo === 'pix') return 'Pix'
  if (p?.tipo === 'credit_card') return 'Cartão de crédito' + (p.parcelas && p.parcelas > 1 ? ` · ${p.parcelas}x` : '')
  if (p?.tipo === 'debit_card') return 'Cartão de débito'
  if (p?.tipo === 'ticket' || p?.metodo === 'bolbradesco') return 'Boleto bancário'
  if (p?.tipo === 'account_money') return 'Saldo Mercado Pago'
  if (p?.tipo === 'bank_transfer') return 'Transferência bancária'
  return pedido.status.toLowerCase() === 'pendente' ? 'A escolher no Mercado Pago' : 'Meio de pagamento não registrado'
}
