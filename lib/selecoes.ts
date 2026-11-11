export const TIPOS_MENU = ['selecao', 'categorias', 'colecoes', 'catalogo'] as const
export type TipoMenu = typeof TIPOS_MENU[number]
export type RegraSelecao = 'manual' | 'recentes'
export interface ItemMenu {
  id: string
  slug: string
  nome: string
  descricao: string
  tipo: TipoMenu
  regra: RegraSelecao
  ativo: boolean
  ordem: number
  versao: number
}

// Usado apenas se a consulta do menu estiver temporariamente indisponível.
export const MENU_PADRAO: readonly ItemMenu[] = [
  { id: 'lancamentos', slug: 'lancamentos', nome: 'Lançamentos', descricao: 'Novas peças para fazer parte da sua história.', tipo: 'selecao', regra: 'recentes', ativo: true, ordem: 0, versao: 1 },
  { id: 'joias', slug: 'joias', nome: 'Joias', descricao: '', tipo: 'categorias', regra: 'manual', ativo: true, ordem: 1, versao: 1 },
  { id: 'masculino', slug: 'masculino', nome: 'Masculino', descricao: 'Personalidade em cada detalhe. Uma seleção feita pela H&H.', tipo: 'selecao', regra: 'manual', ativo: true, ordem: 2, versao: 1 },
  { id: 'presentes', slug: 'presentes', nome: 'Presentes', descricao: 'Escolhas para surpreender e celebrar quem importa.', tipo: 'selecao', regra: 'manual', ativo: true, ordem: 3, versao: 1 },
  { id: 'colecoes', slug: 'colecoes', nome: 'Coleções', descricao: '', tipo: 'colecoes', regra: 'manual', ativo: true, ordem: 4, versao: 1 },
]

export function linkDoMenu(item: Pick<ItemMenu, 'tipo' | 'slug'>): string {
  if (item.tipo === 'categorias' || item.tipo === 'catalogo') return '/produtos'
  if (item.tipo === 'colecoes') return '/colecoes'
  return '/selecao/' + item.slug
}

export function slugSelecaoValido(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(valor)
}

export type VitrineProduto = string
export function vitrinesValidas(valor: unknown): valor is VitrineProduto[] {
  return Array.isArray(valor) && valor.length <= 100 && new Set(valor).size === valor.length && valor.every(slugSelecaoValido)
}
