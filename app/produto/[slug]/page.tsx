import { Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import BotaoAdicionar from '@/components/BotaoAdicionar'
import BotaoFavorito from '@/components/BotaoFavorito'
import CalculadorFrete from '@/components/CalculadorFrete'
import AvaliacoesDiferidas from '@/components/AvaliacoesDiferidas'
import ZoomImagem from '@/components/ZoomImagem'
import ProductCard from '@/components/ProductCard'
import { formatarPreco } from '@/lib/formatacao'
import { ArrowRight, ChevronRight, Play, ShieldCheck, Truck } from 'lucide-react'

export const revalidate = 0

async function PecasRelacionadas({ produtoId, categoria }: { produtoId: string; categoria: string | null }) {
  let query = supabase.from('produtos').select('id,nome,slug,preco,fotos,material,estoque,estoque_reservado').neq('id', produtoId)
  if (categoria) query = query.eq('categoria_slug', categoria)
  const { data: produtos } = await query.order('criado_em', { ascending: false }).limit(4)
  if (!produtos?.length) return null
  return <section className="border-t border-luxury-line pt-14 sm:pt-20"><div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow mb-3">Continue descobrindo</p><h2 className="luxury-title">Uma boa <span className="italic text-luxury-gold-light">companhia.</span></h2></div><Link href="/produtos" className="luxury-link">Todas as peças <ArrowRight size={15} /></Link></div><div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4 lg:gap-8">{produtos.map(produto => <ProductCard key={produto.id} produto={produto} />)}</div></section>
}

export default async function PaginaProduto({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data: produto, error } = await supabase.from('produtos')
    .select('id,nome,slug,preco,descricao,material,fotos,video_url,estoque,estoque_reservado,categoria_slug')
    .eq('slug', slug).single()
  if (error && error.code !== 'PGRST116') throw new Error('Não foi possível carregar esta peça. Tente novamente.')
  if (!produto) notFound()
  const produtoCompra = { id: produto.id, nome: produto.nome, slug: produto.slug, preco: produto.preco, fotos: produto.fotos, estoque: produto.estoque, estoque_reservado: produto.estoque_reservado }
  return <main className="product-page min-w-0 bg-luxury-black">
    <div className="luxury-container pb-16 sm:pb-24">
      <nav aria-label="Localização" className="flex flex-wrap items-center gap-2 py-5 text-[10px] leading-6 text-luxury-muted sm:py-8"><Link href="/" className="inline-flex min-h-11 items-center hover:text-luxury-gold-light">Início</Link><ChevronRight size={12} /><Link href="/produtos" className="inline-flex min-h-11 items-center hover:text-luxury-gold-light">Peças</Link><ChevronRight size={12} /><span className="max-w-[60vw] truncate text-luxury-ivory" aria-current="page">{produto.nome}</span></nav>
      <div className="mb-16 grid gap-9 lg:mb-24 lg:grid-cols-[1.2fr_0.8fr] lg:items-start lg:gap-14 xl:gap-20">
        <div className="min-w-0 space-y-6">
          {produto.fotos?.length ? <ZoomImagem src={produto.fotos[0]} alt={produto.nome} material={produto.material} fotos={produto.fotos} /> : <div className="flex aspect-[4/5] items-center justify-center border border-luxury-line bg-luxury-surface text-sm text-luxury-muted">Imagem em breve</div>}
          {produto.video_url && <div><div className="mb-3 flex items-center gap-2"><Play size={14} className="text-luxury-gold" /><h2 className="eyebrow">A peça em movimento</h2></div><video src={produto.video_url} controls loop muted playsInline preload="none" className="max-h-[500px] w-full border border-luxury-line bg-black object-contain" /></div>}
        </div>
        <div className="min-w-0 lg:sticky lg:top-44">
          <p className="eyebrow mb-4">H&H IMPORTS {produto.material ? ` / ${produto.material}` : ''}</p>
          <div className="mb-5 flex items-start justify-between gap-4"><h1 className="min-w-0 flex-1 break-words font-serif text-3xl font-normal leading-tight tracking-[-0.025em] text-luxury-ivory sm:text-4xl xl:text-5xl">{produto.nome}</h1><div className="shrink-0"><BotaoFavorito produto={produtoCompra} /></div></div>
          <p className="mb-7 text-2xl font-medium tabular-nums text-luxury-gold-light">{formatarPreco(produto.preco)}</p>
          <div className="border-y border-luxury-line py-6"><h2 className="eyebrow mb-3 text-luxury-muted">Sobre a peça</h2><p className="whitespace-pre-line text-sm leading-7 text-luxury-muted">{produto.descricao || 'Uma escolha da seleção H&H IMPORTS. Entre em contato para saber mais sobre esta peça.'}</p>{produto.material && <p className="mt-4 text-xs text-luxury-ivory">Composição: {produto.material}</p>}<Link href="/cuidados" className="luxury-link mt-3 underline decoration-luxury-gold/40 underline-offset-8">Cuidados e garantia <ArrowRight size={14} /></Link></div>
          <div className="mt-7"><BotaoAdicionar produto={produtoCompra} /></div>
          <div className="mt-7 border-b border-luxury-line pb-7"><CalculadorFrete produtoId={produto.id} /></div>
          <div className="mt-6 grid grid-cols-2 gap-4 text-xs leading-6 text-luxury-muted"><p className="flex items-start gap-2"><ShieldCheck size={17} strokeWidth={1.4} className="mt-1 shrink-0 text-luxury-gold" />Pagamento via<br />Mercado Pago</p><p className="flex items-start gap-2"><Truck size={17} strokeWidth={1.4} className="mt-1 shrink-0 text-luxury-gold" />Entrega para<br />todo o Brasil</p></div>
        </div>
      </div>
      <div className="mb-16 border-t border-luxury-line pt-10 sm:mb-24"><AvaliacoesDiferidas produtoId={produto.id} /></div>
      <Suspense fallback={null}><PecasRelacionadas produtoId={produto.id} categoria={produto.categoria_slug} /></Suspense>
    </div>
  </main>
}
