export interface CancelamentoPedido {
  estado: 'reembolso_pendente' | 'cancelado'
  motivo: string
  solicitado_em: string
  reembolsado_em: string | null
  erro?: string | null
}
