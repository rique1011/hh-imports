import { Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ProductCard from '@/components/ProductCard'

export default async function PaginaPesquisa({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const params = await searchParams
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : ''
  // Os separadores de filtros PostgREST não devem ser interpolados na expressão.
  const termo = query.replace(/[%_(),.\\]/g, ' ').trim()
  const resultado = termo ? await supabase.from('produtos')
    .select('id,nome,slug,preco,fotos,material,estoque,estoque_reservado')
    .or(`nome.ilike.%${termo}%,descricao.ilike.%${termo}%`).limit(60) : null
  return <main className="luxury-container min-h-dvh py-14 sm:py-20">
    <p className="eyebrow mb-4">Seu próximo detalhe</p><h1 className="luxury-title">O que você <span className="italic text-luxury-gold-light">procura?</span></h1>
    <form action="/pesquisa" method="get" role="search" className="mb-12 mt-8 flex max-w-2xl items-center gap-3 border-b border-luxury-gold/50 pb-3">
      <Search size={20} strokeWidth={1.5} className="shrink-0 text-luxury-gold" aria-hidden="true" /><label className="sr-only" htmlFor="pesquisa-catalogo">Pesquisar joias</label><input id="pesquisa-catalogo" name="q" defaultValue={query} maxLength={100} placeholder="Colares, pulseiras, prata..." className="min-h-12 min-w-0 flex-1 bg-transparent text-base text-luxury-ivory outline-none placeholder:text-luxury-muted" /><button className="luxury-link shrink-0 px-2" type="submit">Buscar</button>
    </form>
    {query && <p className="mb-8 break-words text-sm text-luxury-muted">{resultado?.data?.length || 0} resultados para <span className="text-luxury-ivory">“{query}”</span></p>}
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-14 lg:grid-cols-4 lg:gap-x-8">
      {resultado?.data?.map((produto, index) => <ProductCard key={produto.id} produto={produto} eager={index < 2} />)}
    </div>
    {query && !resultado?.data?.length && <p className="border border-luxury-line px-6 py-12 text-sm leading-7 text-luxury-muted">{resultado?.error ? 'Não foi possível pesquisar agora. Tente novamente em instantes.' : 'Não encontramos essa peça. Experimente outro nome ou material.'}</p>}
  </main>
}
