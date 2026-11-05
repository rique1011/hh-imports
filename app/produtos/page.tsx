import { supabase } from '@/lib/supabase'
import ProductCard from '@/components/ProductCard'

export const revalidate = 0

export default async function PaginaTodosProdutos() {
  const { data: produtos, error } = await supabase.from('produtos')
    .select('id,nome,slug,preco,fotos,material,estoque,estoque_reservado')
    .order('criado_em', { ascending: false })
  if (error) console.error('Falha ao consultar o catálogo.')
  return <main className="luxury-container min-h-dvh py-14 sm:py-20 lg:py-24">
    <div className="mb-10 flex flex-wrap items-end justify-between gap-6 sm:mb-14"><div><p className="eyebrow mb-4">A seleção completa</p><h1 className="luxury-title">Encontre o seu <span className="italic text-luxury-gold-light">brilho.</span></h1></div><p className="text-xs text-luxury-muted">{produtos?.length || 0} peças para descobrir</p></div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-14 lg:grid-cols-4 lg:gap-x-8">
      {produtos?.length ? produtos.map((produto, index) => <ProductCard key={produto.id} produto={produto} eager={index < 2} />) : <p className="col-span-full border border-luxury-line px-6 py-16 text-center text-sm text-luxury-muted">{error ? 'Não foi possível carregar o catálogo. Tente novamente em instantes.' : 'Novas peças estão a caminho. Volte em breve.'}</p>}
    </div>
  </main>
}
