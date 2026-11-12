import type { Pedido } from '@/types/loja'

export const FILTROS_PEDIDOS_ADMIN = [
  { id: 'a_enviar', nome: 'A enviar', vazio: 'Nenhum pedido aguardando envio.', descricao: 'Pedidos com pagamento confirmado, prontos para separar ou em preparação.' },
  { id: 'retiradas', nome: 'Retiradas', vazio: 'Nenhuma retirada pendente.', descricao: 'Pedidos para retirada presencial: preparo, disponibilidade e eventuais reembolsos pendentes.' },
  { id: 'enviados', nome: 'Enviados', vazio: 'Nenhum pedido em transporte.', descricao: 'Pedidos enviados para acompanhar até a entrega ao cliente.' },
  { id: 'entregues', nome: 'Entregues', vazio: 'Nenhum pedido entregue.', descricao: 'Compras que já chegaram ao cliente.' },
  { id: 'aguardando', nome: 'Aguardando pagamento', vazio: 'Nenhum pedido aguardando pagamento.', descricao: 'Compras ainda sem confirmação de pagamento. Não entram na fila de envio.' },
  { id: 'revisao', nome: 'Atenção financeira', vazio: 'Nenhuma pendência financeira encontrada.', descricao: 'Pagamentos em análise, estornados ou contestados. Confira antes de preparar ou postar.' },
  { id: 'todos', nome: 'Todos', vazio: 'Nenhum pedido cadastrado.', descricao: 'Histórico completo, incluindo pendentes, cancelados e pedidos antigos.' },
] as const
export type FiltroPedidosAdmin = typeof FILTROS_PEDIDOS_ADMIN[number]['id']
type PedidoResumo = Pick<Pedido, 'id' | 'status' | 'cliente_email' | 'cliente_nome' | 'pagamento' | 'entrega' | 'retirada'>

export function grupoPedidoAdmin(pedido: Pick<Pedido, 'status' | 'pagamento' | 'entrega' | 'retirada'>): Exclude<FiltroPedidosAdmin, 'todos'> | 'historico' {
  const status = pedido.status?.trim().toLowerCase() || ''
  const financeiro = pedido.pagamento?.status?.toLowerCase() || ''
  if (pedido.retirada?.estado === 'cancelado') return 'historico'
  if (pedido.retirada?.estado === 'reembolso_pendente') return 'retiradas'
  if (status === 'pagamento_em_analise' || pedido.pagamento?.requer_revisao || Number(pedido.pagamento?.valor_reembolsado) > 0
    || ['refunded', 'charged_back', 'in_mediation'].includes(financeiro)) return 'revisao'
  if (status === 'entregue') return 'entregues'
  if (status === 'enviado') return 'enviados'
  // A confirmação vem do servidor; um status financeiro incompatível bloqueia a fila.
  if (['pago', 'confirmado', 'processando'].includes(status)) return !financeiro || financeiro === 'approved' ? pedido.entrega?.modalidade === 'retirada' ? 'retiradas' : 'a_enviar' : 'revisao'
  if (['pendente', 'aguardando_pagamento'].includes(status)) return 'aguardando'
  return 'historico'
}
const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
export function filtrarPedidosAdmin<T extends PedidoResumo>(pedidos: T[], filtro: FiltroPedidosAdmin, busca: string): T[] {
  const termo = normalizar(busca).replace(/^#/, '')
  return pedidos.filter(p => (filtro === 'todos' || grupoPedidoAdmin(p) === filtro)
    && (!termo || [String(p.id), p.cliente_email || '', p.cliente_nome || ''].some(t => normalizar(t).includes(termo))))
}

// O painel recebe apenas o resumo financeiro; IDs de preferência e URLs privadas ficam no servidor.
export function resumoPagamentoAdmin(p: Pick<Pedido, 'pagamento' | 'total' | 'cashback_debitado'>): Pedido['pagamento'] {
  const pg = p.pagamento || {}
  return { status: pg.status, metodo: Number(p.total) === 0 ? (Number(p.cashback_debitado) > 0 ? 'cashback' : 'isento') : pg.metodo,
    tipo: pg.tipo, parcelas: pg.parcelas, aprovado_em: pg.aprovado_em, atualizado_em: pg.atualizado_em,
    expirado_em: pg.expirado_em, requer_revisao: pg.requer_revisao, valor_reembolsado: pg.valor_reembolsado }
}
