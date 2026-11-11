import 'server-only'
import { supabase } from '@/lib/supabase'
import { categoriaDoProduto, obterCategoria, type CategoriaSalva } from '@/lib/categorias'
import type { Produto } from '@/types/loja'

const COLUNAS = 'id,nome,slug,preco,fotos,material,estoque,estoque_reservado,categoria_id,categoria_slug'
const TAMANHO_PAGINA = 500

export async function produtosDaCategoria(slug: string): Promise<Produto[]> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return []
  const { data: salvas, error: erroCategorias } = await supabase.from('categorias').select('id,nome,slug,ativo').abortSignal(AbortSignal.timeout(5000))
  if (erroCategorias) throw new Error('Não foi possível carregar as coleções.')
  const categorias: CategoriaSalva[] = salvas || []
  const categoria = obterCategoria(slug, categorias)
  if (!categoria || categorias.some(c => c.slug === categoria.slug && c.ativo === false)) return []
  const termos = [...new Set([categoria.slug, ...categoria.termos])]
  // Somente tokens simples entram na expressão PostgREST; o resultado é conferido pela classificação.
  const filtros = termos.filter(t => /^[\p{L}\p{N} -]+$/u.test(t)).flatMap(t => [`categoria_slug.ilike.*${t}*`, `nome.ilike.*${t}*`])
  const ids = categorias.filter(c => (c.slug || obterCategoria(c.nome)?.slug) === categoria.slug).map(c => c.id)
    .filter(id => /^[\da-f-]{36}$/i.test(id) || /^\d{1,20}$/.test(id))
  if (ids.length) filtros.push(`categoria_id.in.(${ids.join(',')})`)
  const produtos: Produto[] = []
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data, error } = await supabase.from('produtos').select(COLUNAS).or(filtros.join(','))
      .order('criado_em', { ascending: false }).order('id', { ascending: true })
      .range(inicio, inicio + TAMANHO_PAGINA - 1).abortSignal(AbortSignal.timeout(5000))
    if (error) throw new Error('Não foi possível carregar as peças desta coleção.')
    const pagina = (data || []) as Produto[]
    produtos.push(...pagina.filter(p => categoriaDoProduto(p, categorias) === categoria.slug))
    if (pagina.length < TAMANHO_PAGINA) return produtos
  }
}
