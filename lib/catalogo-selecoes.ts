import 'server-only'
import { unstable_cache } from 'next/cache'
import { supabase } from '@/lib/supabase'
import { categoriaDoProduto } from '@/lib/categorias'
import type { Produto } from '@/types/loja'
import { SELECOES } from '@/lib/selecoes'

export const produtosDaSelecao = unstable_cache(async (slug: string): Promise<Produto[]> => {
  if (!SELECOES.some(s => s.slug === slug)) return []
  const { data: categorias, error: erroCategorias } = slug === 'joias'
    ? await supabase.from('categorias').select('id,nome').abortSignal(AbortSignal.timeout(5000)) : { data: [], error: null }
  if (erroCategorias) throw new Error('Não foi possível carregar as categorias.')
  const produtos: Produto[] = []
  const recente = new Date(Date.now() - 30 * 86400_000).toISOString()
  for (let inicio = 0; ; inicio += 500) {
    let query = supabase.from('produtos').select('id,nome,slug,preco,fotos,material,estoque,estoque_reservado,categoria_id,categoria_slug,criado_em,vitrines')
    if (slug === 'lancamentos') query = query.or(`criado_em.gte.${recente},vitrines.cs.{lancamentos}`)
    if (slug === 'masculino' || slug === 'presentes') query = query.contains('vitrines', [slug])
    const { data, error } = await query.order('criado_em', { ascending: false }).order('id', { ascending: true })
      .range(inicio, inicio + 499).abortSignal(AbortSignal.timeout(5000))
    if (error) throw new Error('Não foi possível carregar esta seleção.')
    const pagina = (data || []) as Produto[]
    produtos.push(...pagina.filter(p => slug !== 'joias' || ['aneis','brincos','colares','pulseiras'].includes(categoriaDoProduto(p, categorias || []) || '')))
    if (pagina.length < 500) return produtos
  }
}, ['hh-selecoes-v1'], { revalidate: 60, tags: ['vitrine-publica'] })
