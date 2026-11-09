export const FRETE_GRATIS_CENTAVOS = 10_000
export const MENSAGEM_FRETE_GRATIS = 'Frete grátis em todo o Brasil a partir de R$ 100 em produtos.'

// O benefício considera as peças antes de cupom/cashback; embalagem não conta.
export function temFreteGratis(subtotal: number) {
  return Number.isFinite(subtotal) && Math.round(subtotal * 100) >= FRETE_GRATIS_CENTAVOS
}
export function faltaParaFreteGratis(subtotal: number) {
  return Math.max(0, FRETE_GRATIS_CENTAVOS - Math.round(subtotal * 100)) / 100
}
