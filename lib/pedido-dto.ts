import type { Pedido } from '@/types/loja'
import { dataEntregaDosItens } from '@/lib/prazo-devolucao'
import { prazoPagamento } from '@/lib/pagamento-pedido'
export const COLUNAS_PEDIDO_CLIENTE = 'id,created_at,status,total,itens,codigo_rastreio,entrega,pagamento,pagamento_expira_em,cashback_debitado'
export function pedidoParaCliente(p: Omit<Pedido, 'cliente_email'>) {
  const pagamento = p.pagamento || {}
  const entrega = p.entrega ? { cep: p.entrega.cep, logradouro: p.entrega.logradouro, numero: p.entrega.numero, complemento: p.entrega.complemento,
    bairro: p.entrega.bairro, cidade: p.entrega.cidade, uf: p.entrega.uf, ...(p.entrega.modalidade ? { modalidade: p.entrega.modalidade } : {}) } : null
  return { id: p.id, created_at: p.created_at, status: p.status, total: p.total, itens: p.itens, codigo_rastreio: p.codigo_rastreio,
    entrega, retirada: p.retirada, data_entrega: dataEntregaDosItens(p.itens), linha_tempo: p.linha_tempo,
    pagamento: { status: pagamento.status, metodo: Number(p.total) === 0 ? (Number(p.cashback_debitado) > 0 ? 'cashback' : 'isento') : pagamento.metodo,
      tipo: pagamento.tipo, parcelas: pagamento.parcelas, aprovado_em: pagamento.aprovado_em, atualizado_em: pagamento.atualizado_em,
      expirado_em: pagamento.expirado_em, requer_revisao: pagamento.requer_revisao },
    pagamento_expira_em: prazoPagamento(p), pode_pagar: p.status.toLowerCase() === 'pendente' && Date.parse(prazoPagamento(p)) > Date.now() }
}
