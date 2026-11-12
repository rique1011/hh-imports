import { dataEntregaDosItens, dataRecebimentoValida, diaNaLoja, formatarDia, FUSO_LOJA } from '@/lib/prazo-devolucao'
import type { EventoPedido, ItemPedido } from '@/types/loja'

const dataFormato = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_LOJA, day: '2-digit', month: '2-digit', year: 'numeric' })
const horaFormato = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_LOJA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export function instanteRegistrado(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(valor)
    && dataRecebimentoValida(valor.slice(0, 10)) && Number.isFinite(Date.parse(valor))
}
function instanteDosItens(itens: ItemPedido[], campo: 'preparacao_iniciada_em' | 'recebimento_confirmado_em') {
  if (!Array.isArray(itens) || !itens.length) return null
  const instante = itens[0]?.[campo]
  return instanteRegistrado(instante) && itens.every(item => item?.[campo] === instante) ? instante : null
}
export function eventosDosItens(itens: ItemPedido[]): EventoPedido[] {
  const eventos: EventoPedido[] = []
  const preparacao = instanteDosItens(itens, 'preparacao_iniciada_em')
  if (preparacao) eventos.push({ etapa: 'preparando', ocorrido_em: preparacao, data_local: null })
  const data = dataEntregaDosItens(itens)
  if (data) {
    const instante = instanteDosItens(itens, 'recebimento_confirmado_em')
    const confirmado = instante && itens.every(item => ['melhor_envio','retirada'].includes(item.recebimento_origem || '')) && diaNaLoja(new Date(instante)) === data
    eventos.push({ etapa: 'entregue', ocorrido_em: confirmado ? instante : null, data_local: data })
  }
  return eventos
}
export function horarioEvento(evento?: EventoPedido) {
  if (instanteRegistrado(evento?.ocorrido_em)) {
    const instante = new Date(evento.ocorrido_em)
    return { data: dataFormato.format(instante), hora: horaFormato.format(instante), dateTime: evento.ocorrido_em }
  }
  if (dataRecebimentoValida(evento?.data_local)) return { data: formatarDia(evento.data_local), hora: null, dateTime: evento.data_local }
  return null
}
export function progressoPedido(status: string) {
  return ({ pendente: 1, pago: 2, confirmado: 2, processando: 3, enviado: 4, entregue: 5 } as Record<string, number>)[status?.toLowerCase()] || 0
}
