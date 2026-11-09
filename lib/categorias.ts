export const CATEGORIAS = [
  { slug: 'colares', nome: 'Colares', termos: ['colar', 'colares', 'corrente', 'correntes', 'choker', 'chokers', 'gargantilha', 'gargantilhas', 'escapulario', 'escapulário', 'escapularios', 'escapulários'] },
  { slug: 'pulseiras', nome: 'Pulseiras', termos: ['pulseira', 'pulseiras', 'bracelete', 'braceletes'] },
  { slug: 'brincos', nome: 'Brincos', termos: ['brinco', 'brincos'] },
  { slug: 'aneis', nome: 'Anéis', termos: ['anel', 'anéis', 'aneis', 'alianca', 'aliança', 'aliancas', 'alianças'] },
  { slug: 'relogios', nome: 'Relógios', termos: ['relogio', 'relógio', 'relogios', 'relógios'] },
  { slug: 'outros', nome: 'Outras peças', termos: ['outro', 'outros'] },
] as const
export type SlugCategoria = typeof CATEGORIAS[number]['slug']
export interface CategoriaSalva { id: string; nome: string }
const normalizar = (valor: string) => valor.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function obterCategoria(valor: unknown) {
  if (typeof valor !== 'string') return null
  const termo = normalizar(valor)
  return CATEGORIAS.find(c => c.slug === termo || c.termos.some(t => normalizar(t) === termo)) || null
}

export function inferirCategoriaNome(nome: string): SlugCategoria | null {
  const palavras = new Set(normalizar(nome).split(/[^a-z0-9]+/))
  const candidatas = CATEGORIAS.filter(c => c.slug !== 'outros' && c.termos.some(t => palavras.has(normalizar(t))))
  // Uma peça sem categoria e com nome ambíguo continua no catálogo geral para revisão no admin.
  return candidatas.length === 1 ? candidatas[0].slug : null
}

export function categoriaDoProduto(produto: { nome: string; categoria_slug?: string | null; categoria_id?: string | null }, categorias: CategoriaSalva[] = []): SlugCategoria | null {
  const explicita = obterCategoria(produto.categoria_slug)
  if (explicita) return explicita.slug
  const vinculada = categorias.find(c => c.id === produto.categoria_id)
  if (vinculada) return obterCategoria(vinculada.nome)?.slug || null
  if (produto.categoria_slug?.trim() || produto.categoria_id) return null
  return inferirCategoriaNome(produto.nome)
}
