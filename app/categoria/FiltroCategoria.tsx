'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { SlidersHorizontal, X } from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import { categoriaDoProduto, type CategoriaSalva } from '@/lib/categorias'
import { FILTROS_INICIAIS, filtrarCatalogo, grupoMaterial, type FiltrosCatalogo } from '@/lib/filtros-catalogo'
import { MENSAGEM_FRETE_GRATIS } from '@/lib/politica-frete'
import type { Produto } from '@/types/loja'

const campo = 'min-h-11 w-full rounded border border-luxury-line bg-hb-black px-3 py-2 text-base text-luxury-ivory outline-none focus:border-hb-gold'
export default function FiltroCategoria({ produtosOriginais, tituloCategoria, descricao, categorias = [] }: {
  produtosOriginais: Produto[]; tituloCategoria: string; descricao?: string; categorias?: readonly CategoriaSalva[]
}) {
  const [filtros, setFiltros] = useState<FiltrosCatalogo>(FILTROS_INICIAIS)
  const [aberto, setAberto] = useState(false)
  const alterar = <K extends keyof FiltrosCatalogo>(chave: K, valor: FiltrosCatalogo[K]) => setFiltros(atual => ({ ...atual, [chave]: valor }))
  const materiais = useMemo(() => Array.from(new Set(produtosOriginais.map(p => grupoMaterial(p.material)))).sort(), [produtosOriginais])
  const tipos = useMemo(() => categorias.filter(c => produtosOriginais.some(p => categoriaDoProduto(p, categorias) === c.slug)), [produtosOriginais, categorias])
  const produtos = useMemo(() => filtrarCatalogo(produtosOriginais, filtros, categorias), [produtosOriginais, filtros, categorias])
  const ativos = Object.entries(filtros).filter(([k, v]) => k !== 'ordem' && Boolean(v)).length
  const limpar = () => setFiltros(FILTROS_INICIAIS)

  return <main className="min-h-dvh min-w-0 bg-hb-black text-luxury-ivory">
    <header className="border-b border-luxury-line bg-luxury-surface py-10 sm:py-16">
      <div className="luxury-container">
        <nav aria-label="Localização" className="mb-6 flex gap-3 text-xs text-luxury-muted"><Link href="/">Início</Link><span aria-hidden="true">/</span><span>{tituloCategoria}</span></nav>
        <h1 className="luxury-title [overflow-wrap:anywhere]">{tituloCategoria}</h1>
        {descricao && <p className="mt-5 max-w-2xl text-sm leading-7 text-luxury-muted">{descricao}</p>}
        <Link href="/fretes-e-entregas" className="mt-4 inline-block text-xs leading-6 text-luxury-gold-light">{MENSAGEM_FRETE_GRATIS}</Link>
      </div>
    </header>
    <div className="luxury-container flex min-w-0 flex-col gap-7 py-8 md:flex-row md:gap-10 md:py-12">
      <aside aria-label="Filtros do catálogo" className="min-w-0 shrink-0 md:w-56">
        <button type="button" aria-expanded={aberto} aria-controls="painel-filtros" onClick={() => setAberto(!aberto)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded border border-luxury-gold/40 px-4 text-sm text-luxury-gold-light md:hidden"><span className="flex items-center gap-2"><SlidersHorizontal size={17} />Filtrar peças{ativos > 0 && ` (${ativos})`}</span><span>{aberto ? 'Fechar' : 'Abrir'}</span></button>
        <h2 className="mb-6 hidden items-center gap-2 text-sm text-luxury-gold-light md:flex"><SlidersHorizontal size={17} />Filtros</h2>
        <div id="painel-filtros" className={`${aberto ? 'block' : 'hidden'} space-y-5 border-b border-luxury-line py-5 md:block md:border-0 md:py-0`}>
          <label className="block text-xs leading-6 text-luxury-muted">Buscar nesta seleção<input type="search" maxLength={100} value={filtros.busca} onChange={e => alterar('busca', e.target.value)} placeholder="Nome da peça" className={campo} /></label>
          {tipos.length > 1 && <label className="block text-xs leading-6 text-luxury-muted">Categoria<select aria-label="Categoria" value={filtros.categoria} onChange={e => alterar('categoria', e.target.value)} className={campo}><option value="">Todas as categorias</option>{tipos.map(c => <option key={c.slug} value={c.slug}>{c.nome}</option>)}</select></label>}
          <label className="block text-xs leading-6 text-luxury-muted">Material<select aria-label="Material" value={filtros.material} onChange={e => alterar('material', e.target.value)} className={campo}><option value="">Todos os materiais</option>{materiais.map(m => <option key={m} value={m}>{m}</option>)}</select></label>
          <fieldset><legend className="mb-2 text-xs text-luxury-muted">Faixa de preço (R$)</legend><div className="grid grid-cols-2 gap-3"><label className="text-xs leading-6 text-luxury-muted">De<input type="number" inputMode="decimal" min="0" step="0.01" value={filtros.precoMin} onChange={e => alterar('precoMin', e.target.value)} placeholder="0,00" className={campo} /></label><label className="text-xs leading-6 text-luxury-muted">Até<input type="number" inputMode="decimal" min="0" step="0.01" value={filtros.precoMax} onChange={e => alterar('precoMax', e.target.value)} placeholder="Sem limite" className={campo} /></label></div></fieldset>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={filtros.disponivel} onChange={e => alterar('disponivel', e.target.checked)} className="h-5 w-5 accent-hb-gold" />Somente disponíveis</label>
          {ativos > 0 && <button type="button" onClick={limpar} className="flex min-h-11 items-center gap-2 text-xs text-luxury-gold-light"><X size={16} />Limpar filtros</button>}
        </div>
      </aside>
      <section aria-label="Peças da seleção" className="min-w-0 flex-1">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <p role="status" className="text-xs text-luxury-muted">{produtos.length} de {produtosOriginais.length} peças{ativos > 0 && ' · filtros aplicados'}</p>
          <label className="flex min-w-0 items-center gap-2 text-xs text-luxury-muted">Ordenar<select aria-label="Ordenar" value={filtros.ordem} onChange={e => alterar('ordem', e.target.value)} className={`${campo} w-auto max-w-52 text-sm`}><option value="recentes">Mais recentes</option><option value="menor-preco">Menor preço</option><option value="maior-preco">Maior preço</option><option value="nome">Nome de A a Z</option></select></label>
        </div>
        {ativos > 0 && !aberto && <button type="button" onClick={limpar} className="mb-6 flex min-h-11 items-center gap-2 text-xs text-luxury-gold-light md:hidden"><X size={15} />Limpar filtros aplicados</button>}
        {produtos.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3">{produtos.map((p, i) => <ProductCard key={p.id} produto={p} eager={i < 2} sizes="(max-width: 639px) calc(50vw - 24px), (max-width: 767px) calc(50vw - 36px), (max-width: 1023px) calc(50vw - 160px), (max-width: 1375px) calc(33vw - 136px), 310px" />)}</div>
          : <div className="border border-dashed border-luxury-line px-5 py-16 text-center"><p className="mb-4 text-sm text-luxury-muted">{produtosOriginais.length ? 'Nenhuma peça encontrada com estes filtros.' : 'Ainda não há peças cadastradas nesta seleção.'}</p>{produtosOriginais.length ? <button type="button" onClick={limpar} className="luxury-button luxury-button-outline">Limpar filtros</button> : <Link href="/produtos" className="luxury-link">Explorar todas as peças</Link>}</div>}
      </section>
    </div>
  </main>
}
