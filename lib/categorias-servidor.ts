import 'server-only'
import { unstable_cache } from 'next/cache'
import { supabase } from '@/lib/supabase'
import { CATEGORIAS, type CategoriaLoja } from '@/lib/categorias'

export const COLUNAS_CATEGORIAS = 'id,nome,slug,ativo,ordem,versao'

export const getCategoriasPublicas = unstable_cache(async (): Promise<CategoriaLoja[]> => {
  const { data, error } = await supabase.from('categorias').select(COLUNAS_CATEGORIAS)
    .eq('ativo', true).order('ordem').order('nome').abortSignal(AbortSignal.timeout(5000))
  if (!error) return data || []
  // Mantém a navegação disponível se o serviço de catálogo estiver temporariamente indisponível.
  console.error('Categorias indisponíveis; usando a navegação padrão.')
  return CATEGORIAS.map((c, ordem) => ({ id: c.slug, nome: c.nome, slug: c.slug, ativo: true, ordem, versao: 1 }))
}, ['hh-categorias-v1'], { revalidate: 60, tags: ['categorias-publicas'] })
