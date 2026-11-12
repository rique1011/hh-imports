import type { Endereco } from '@/types/loja'
export interface ConfigRetirada {
  ativa: boolean; local: string; endereco: Endereco; instrucoes: string; prazo_dias: number; versao: number
}
export interface RetiradaPedido {
  estado: 'aguardando_preparo' | 'disponivel' | 'retirado' | 'reembolso_pendente' | 'cancelado'
  local: string; endereco: Endereco; instrucoes: string; prazo_dias: number
  disponivel_em: string | null; avisado_em: string | null; prazo_final: string | null
  retirado_em: string | null; reembolsado_em: string | null; versao: number; codigo?: string; erro?: string | null
}
