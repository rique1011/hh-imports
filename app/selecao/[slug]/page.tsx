import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ProductCard from '@/components/ProductCard'
import { SELECOES } from '@/lib/selecoes'
import { produtosDaSelecao } from '@/lib/catalogo-selecoes'
import { MENSAGEM_FRETE_GRATIS } from '@/lib/politica-frete'

type Props = { params: Promise<{ slug: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const selecao = SELECOES.find(s => s.slug === slug)
  return { title: selecao ? `${selecao.nome} | H&H IMPORTS` : 'Seleção H&H' }
}
export default async function PaginaSelecao({ params }: Props) {
  const { slug } = await params, selecao = SELECOES.find(s => s.slug === slug)
  if (!selecao) notFound()
  const produtos = await produtosDaSelecao(slug)
  return <main className="luxury-container min-w-0 pb-20 pt-10 sm:pt-16">
    <nav aria-label="Localização" className="mb-8 flex gap-3 text-xs text-luxury-muted"><Link href="/" className="hover:text-luxury-gold-light">Início</Link><span aria-hidden="true">/</span><span className="text-luxury-ivory">{selecao.nome}</span></nav>
    <div className="mb-10 max-w-2xl"><p className="eyebrow mb-4">A seleção H&H</p><h1 className="font-serif text-4xl tracking-tight text-luxury-ivory sm:text-6xl">{selecao.nome}</h1><p className="mt-5 text-sm leading-7 text-luxury-muted">{selecao.descricao}</p><Link href="/fretes-e-entregas" className="mt-4 inline-block text-xs leading-6 text-luxury-gold-light">{MENSAGEM_FRETE_GRATIS}</Link></div>
    {slug === 'joias' && <nav aria-label="Tipos de joias" className="mb-10 flex flex-wrap gap-3">{[{ slug: 'aneis', nome: 'Anéis' },{ slug: 'brincos', nome: 'Brincos' },{ slug: 'colares', nome: 'Colares' },{ slug: 'pulseiras', nome: 'Pulseiras' }].map(c => <Link href={'/categoria/' + c.slug} key={c.slug} className="luxury-button luxury-button-outline px-5">{c.nome}</Link>)}</nav>}
    {produtos.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4 lg:gap-x-8">{produtos.map(p => <ProductCard key={p.id} produto={p} />)}</div>
      : <div className="border border-luxury-line bg-luxury-surface px-5 py-16 text-center"><h2 className="font-serif text-2xl text-luxury-ivory">Novas escolhas estão a caminho.</h2><p className="my-4 text-sm text-luxury-muted">Estamos preparando esta seleção para você.</p><Link href="/produtos" className="luxury-button luxury-button-outline mt-3">Explorar todas as peças</Link></div>}
  </main>
}
