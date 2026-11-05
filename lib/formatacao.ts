const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatarPreco(valor: number | string) {
  return moeda.format(Number(valor))
}
