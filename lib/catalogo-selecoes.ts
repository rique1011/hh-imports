import 'server-only'
import { unstable_cache } from 'next/cache'
import { supabase } from '@/lib/supabase'
import { categoriaDoProduto } from '@/lib/categorias'
import type { Produto } from '@/types/loja'
import { slugSelecaoValido } from '@/lib/selecoes'
import { getNavegacaoPublica } from '@/lib/navegacao-servidor'

export const produtosDaSelecao = unstable_cache(async (slug: string): Promise<Produto[]> => {
  if (!slugSelecaoValido(slug)) return []
  const selecao = (await getNavegacaoPublica()).find(s => s.slug === slug && s.tipo === 'selecao')
  if (!selecao) return []
  const { data: categorias, error: erroCategorias } = await supabase.from('categorias').select('id,nome,slug').abortSignal(AbortSignal.timeout(5000))
  if (erroCategorias) throw new Error('Não foi possível carregar as categorias.')
  const produtos: Produto[] = []
  const recente = new Date(Date.now() - 30 * 86400_000).toISOString()
  for (let inicio = 0; ; inicio += 500) {
    let query = supabase.from('produtos').select('id,nome,slug,preco,fotos,material,estoque,estoque_reservado,categoria_id,categoria_slug,criado_em,vitrines')
    if (selecao.regra === 'recentes') query = query.or(`criado_em.gte.${recente},vitrines.cs.{${slug}}`)
    else query = query.contains('vitrines', [slug])
    const { data, error } = await query.order('criado_em', { ascending: false }).order('id', { ascending: true })
      .range(inicio, inicio + 499).abortSignal(AbortSignal.timeout(5000))
    if (error) throw new Error('Não foi possível carregar esta seleção.')
    const pagina = (data || []) as Produto[]
    produtos.push(...pagina.map(p => ({ ...p, categoria_slug: categoriaDoProduto(p, categorias || []) })))
    if (pagina.length < 500) return produtos
  }
}, ['hh-selecoes-v3'], { revalidate: 60, tags: ['vitrine-publica'] })
