import type { ConfigRetirada, RetiradaPedido } from '@/types/retirada'
export const RETIRADA_PADRAO: ConfigRetirada = { ativa: false, local: 'H&H IMPORTS — Joinville/SC', endereco: {}, instrucoes: 'Retirada mediante agendamento. Aguarde o aviso de disponibilidade e combine o horário pelo WhatsApp da loja.', prazo_dias: 30, versao: 1 }
export const ehRetirada = (pedido: { entrega?: { modalidade?: string } | null; retirada?: RetiradaPedido | null }) => pedido.entrega?.modalidade === 'retirada' || !!pedido.retirada
export function dataRetirada(valor?: string | null) {
  return valor && Number.isFinite(Date.parse(valor)) ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor)) : ''
}
