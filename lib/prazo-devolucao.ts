export const FUSO_LOJA = 'America/Sao_Paulo'
const calendario = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_LOJA, year: 'numeric', month: '2-digit', day: '2-digit' })

export function diaNaLoja(agora = new Date()): string {
  const partes = calendario.formatToParts(agora)
  const parte = (tipo: string) => partes.find(p => p.type === tipo)?.value
  return `${parte('year')}-${parte('month')}-${parte('day')}`
}

export function dataRecebimentoValida(data: unknown): data is string {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data) || data.startsWith('0000-')) return false
  const dia = new Date(`${data}T12:00:00.000Z`)
  return Number.isFinite(dia.getTime()) && dia.toISOString().slice(0, 10) === data
}

export function prazoDevolucao(dataEntrega: string | null | undefined, agora = new Date()) {
  if (!dataRecebimentoValida(dataEntrega) || dataEntrega > diaNaLoja(agora)) {
    return { situacao: 'sem_data' as const, aberto: false, dataLimite: null }
  }
  // Sete dias corridos a partir do dia seguinte ao recebimento, até o fim do 7º dia.
  const limite = new Date(`${dataEntrega}T12:00:00.000Z`)
  limite.setUTCDate(limite.getUTCDate() + 7)
  const dataLimite = limite.toISOString().slice(0, 10)
  const aberto = diaNaLoja(agora) <= dataLimite
  return { situacao: aberto ? 'aberto' as const : 'encerrado' as const, aberto, dataLimite }
}

export function formatarDia(data: string) {
  return data.split('-').reverse().join('/')
}

// Metadado persistido nos itens privados do pedido, sem alterar o schema do banco.
export function dataEntregaDosItens(itens: unknown): string | null {
  if (!Array.isArray(itens) || !itens.length) return null
  const datas = itens.map(item => item && typeof item === 'object' ? item.data_recebimento : null)
  return datas.every(data => dataRecebimentoValida(data) && data === datas[0]) ? datas[0] : null
}
