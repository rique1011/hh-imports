import { supabase } from '@/lib/supabase'
import FiltroCategoria from '@/app/categoria/FiltroCategoria'
import { getCategoriasPublicas } from '@/lib/categorias-servidor'
import type { Produto } from '@/types/loja'

export const revalidate = 0
export default async function PaginaTodosProdutos() {
  const categorias = await getCategoriasPublicas()
  const produtos: Produto[] = []
  for (let inicio = 0; ; inicio += 500) {
    const { data, error } = await supabase.from('produtos').select('id,nome,slug,preco,fotos,material,estoque,estoque_reservado,categoria_id,categoria_slug')
      .order('criado_em', { ascending: false }).order('id').range(inicio, inicio + 499).abortSignal(AbortSignal.timeout(5000))
    if (error) throw new Error('Não foi possível carregar o catálogo. Tente novamente em instantes.')
    produtos.push(...(data || []))
    if ((data?.length || 0) < 500) break
  }
  return <FiltroCategoria key="catalogo" produtosOriginais={produtos} tituloCategoria="Todas as peças" descricao="Joias folheadas, prata 925 e bijuterias. Escolha por categoria, material, preço ou disponibilidade." categorias={categorias} />
}
