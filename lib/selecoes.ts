export const SELECOES = [
  { slug: 'lancamentos', nome: 'Lançamentos', descricao: 'Novas peças para fazer parte da sua história.' },
  { slug: 'joias', nome: 'Joias', descricao: 'Colares, pulseiras, brincos e anéis. Encontre o seu próximo detalhe.' },
  { slug: 'masculino', nome: 'Masculino', descricao: 'Personalidade em cada detalhe. Uma seleção feita pela H&H.' },
  { slug: 'presentes', nome: 'Presentes', descricao: 'Escolhas para surpreender e celebrar quem importa.' },
] as const
export const VITRINES_PRODUTO = ['lancamentos', 'masculino', 'presentes'] as const
export type VitrineProduto = typeof VITRINES_PRODUTO[number]
export function vitrinesValidas(v: unknown): v is VitrineProduto[] {
  return Array.isArray(v) && v.length <= 3 && new Set(v).size === v.length && v.every(s => VITRINES_PRODUTO.includes(s))
}
