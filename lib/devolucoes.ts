import type { ItemPedido } from '@/types/loja'

export type ResolucaoTroca = 'reembolso' | 'troca' | 'credito'
export interface ProdutoDevolucao { id: string; nome: string; foto: string; preco: number; quantidade: number; valor_restituicao: number | null }
export interface TrocaCliente {
  id: string; pedido_id: string; produto_id: string | null; motivo: string; descricao: string; status: string; criado_em: string;
  produto_snapshot: ProdutoDevolucao | null; resolucao: ResolucaoTroca; codigo_postagem: string | null;
  postagem_validade: string | null; observacao_cliente: string; credito_valor: number; credito_liberado_em: string | null; versao: number;
}
export const STATUS_TROCA: Record<string, string> = { analise_pendente: 'Solicitação recebida', aprovado: 'Devolução aprovada', aguardando_retorno: 'Aguardando postagem', recebido: 'Peça recebida para análise', reembolso_pendente: 'Reembolso em andamento', concluido: 'Atendimento concluído', recusado: 'Solicitação não aprovada' }
export const RESOLUCOES: Record<ResolucaoTroca, string> = { reembolso: 'Reembolso do pagamento', troca: 'Troca da peça', credito: 'Crédito na loja (opcional)' }
export const COLUNAS_TROCA_CLIENTE = 'id,pedido_id,produto_id,motivo,descricao,status,criado_em,produto_snapshot,resolucao,codigo_postagem,postagem_validade,observacao_cliente,credito_valor,credito_liberado_em,versao'
export function snapshotDevolucao(pedido: { itens: ItemPedido[]; total: number; cashback_debitado?: number; resumo_compra?: unknown }, produtoId: string): ProdutoDevolucao | null {
  const grupos = new Map<string, ProdutoDevolucao>()
  for (const item of pedido.itens) {
    if (!Number.isSafeInteger(Number(item.quantidade)) || Number(item.quantidade) < 1 || !Number.isFinite(Number(item.preco)) || Number(item.preco) < 0) return null
    const id = String(item.id), existente = grupos.get(id)
    if (existente && existente.preco !== Number(item.preco)) return null
    grupos.set(id, { id, nome: item.nome, foto: item.foto || '', preco: Number(item.preco), quantidade: Number(item.quantidade) + (existente?.quantidade || 0), valor_restituicao: null })
  }
  const item = grupos.get(produtoId)
  if (!item) return null
  const resumo = pedido.resumo_compra as Record<string, unknown> | null
  const todos = [...grupos.values()], subtotal = todos.reduce((s, i) => s + Math.round(i.preco * 100) * i.quantidade, 0)
  if (resumo && Math.round(Number(resumo.subtotal) * 100) === subtotal && Math.round(Number(resumo.total) * 100) === Math.round(Number(pedido.total) * 100)) {
    // Rateia descontos, embalagem e frete efetivamente pagos. O último item recebe o resto de centavos.
    const total = Math.round((Number(pedido.total) + Number(pedido.cashback_debitado || 0)) * 100)
    if (subtotal > 0 && Number.isSafeInteger(total) && total >= 0) {
      let distribuido = 0
      todos.forEach((i, indice) => {
        const centavos = indice === todos.length - 1 ? total - distribuido : Math.floor(total * Math.round(i.preco * 100) * i.quantidade / subtotal)
        i.valor_restituicao = centavos / 100; distribuido += centavos
      })
    }
  }
  return item
}
