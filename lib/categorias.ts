export const CATEGORIAS = [
  { slug: 'colares', nome: 'Colares', termos: ['colar', 'colares', 'corrente', 'correntes', 'choker', 'chokers', 'gargantilha', 'gargantilhas', 'escapulario', 'escapulário', 'escapularios', 'escapulários'] },
  { slug: 'pulseiras', nome: 'Pulseiras', termos: ['pulseira', 'pulseiras', 'bracelete', 'braceletes'] },
  { slug: 'brincos', nome: 'Brincos', termos: ['brinco', 'brincos'] },
  { slug: 'aneis', nome: 'Anéis', termos: ['anel', 'anéis', 'aneis', 'alianca', 'aliança', 'aliancas', 'alianças'] },
  { slug: 'relogios', nome: 'Relógios', termos: ['relogio', 'relógio', 'relogios', 'relógios'] },
  { slug: 'outros', nome: 'Outras peças', termos: ['outro', 'outros'] },
] as const
export type SlugCategoria = typeof CATEGORIAS[number]['slug']
export interface CategoriaSalva { id: string; nome: string; slug?: string; ativo?: boolean; ordem?: number; versao?: number }
export interface CategoriaLoja extends CategoriaSalva { slug: string; ativo: boolean; ordem: number; versao: number }
const normalizar = (valor: string) => valor.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function slugCategoria(nome: string) {
  return normalizar(nome).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function obterCategoria(valor: unknown, categorias: readonly CategoriaSalva[] = []) {
  if (typeof valor !== 'string') return null
  const termo = normalizar(valor)
  const salva = categorias.find(c => c.slug === termo || normalizar(c.nome) === termo)
  if (salva?.slug) return { ...salva, slug: salva.slug, termos: [...(CATEGORIAS.find(c => c.slug === salva.slug)?.termos || []), salva.slug, salva.nome] }
  return CATEGORIAS.find(c => c.slug === termo || c.termos.some(t => normalizar(t) === termo)) || null
}

export function inferirCategoriaNome(nome: string): SlugCategoria | null {
  const palavras = new Set(normalizar(nome).split(/[^a-z0-9]+/))
  const candidatas = CATEGORIAS.filter(c => c.slug !== 'outros' && c.termos.some(t => palavras.has(normalizar(t))))
  // Uma peça sem categoria e com nome ambíguo continua no catálogo geral para revisão no admin.
  return candidatas.length === 1 ? candidatas[0].slug : null
}

export function categoriaDoProduto(produto: { nome: string; categoria_slug?: string | null; categoria_id?: string | null }, categorias: readonly CategoriaSalva[] = []): string | null {
  const explicita = obterCategoria(produto.categoria_slug, categorias)
  if (explicita) return explicita.slug
  const vinculada = categorias.find(c => c.id === produto.categoria_id)
  if (vinculada) return vinculada.slug || obterCategoria(vinculada.nome)?.slug || null
  if (produto.categoria_slug?.trim() || produto.categoria_id) return null
  return inferirCategoriaNome(produto.nome)
}
