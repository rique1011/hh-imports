import 'server-only'
import { unstable_cache } from 'next/cache'
import { supabase } from '@/lib/supabase'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { ProdutoCard } from '@/components/ProductCard'

// Somente a vitrine pública é cacheada. Checkout e página do produto leem o estoque atual.
export const getVitrine = unstable_cache(async (): Promise<ProdutoCard[]> => {
  const { data, error } = await supabase.from('produtos')
    .select('id,nome,slug,preco,fotos,material,estoque,estoque_reservado')
    .order('criado_em', { ascending: false }).limit(8)
    .abortSignal(AbortSignal.timeout(5000))
  if (error) throw new Error('Não foi possível consultar a vitrine.')
  return data || []
}, ['hh-vitrine-v1'], { revalidate: 60, tags: ['vitrine-publica'] })

export const getCupomPublico = unstable_cache(async () => {
  const { data, error } = await getSupabaseAdmin().from('cupons')
    .select('codigo,desconto').eq('ativo', true).is('usuario_id', null).gt('desconto', 0)
    .order('desconto', { ascending: false }).limit(1)
    .abortSignal(AbortSignal.timeout(5000))
  if (error) throw new Error('Não foi possível consultar o benefício público.')
  return data?.[0] as { codigo: string; desconto: number } | undefined || null
}, ['hh-cupom-publico-v1'], { revalidate: 60, tags: ['vitrine-publica'] })
