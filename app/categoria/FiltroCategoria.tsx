'use client'
import ProductCard from '@/components/ProductCard'
import Link from 'next/link'
import type { Produto } from '@/types/loja'

import { useState, useMemo } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'

// Recebe os produtos já carregados pelo servidor
export default function FiltroCategoria({ produtosOriginais, tituloCategoria }: { produtosOriginais: Produto[], tituloCategoria: string }) {
  const [filtroMaterial, setFiltroMaterial] = useState('')
  const [filtroPreco, setFiltroPreco] = useState<number | null>(null)
  const precoMaximo = Math.max(50, Math.ceil(produtosOriginais.reduce((maior, p) => Math.max(maior, Number(p.preco) || 0), 0) / 50) * 50)
  const limitePreco = filtroPreco ?? precoMaximo

  // Identifica os materiais existentes
  const materiaisDisponiveis = useMemo(() => {
    const lista = produtosOriginais.map(p => p.material).filter((material): material is string => Boolean(material))
    return Array.from(new Set(lista))
  }, [produtosOriginais])

  // Aplica os filtros
  const produtosFiltrados = useMemo(() => {
    return produtosOriginais.filter(p => {
      const bateMaterial = filtroMaterial === '' || p.material === filtroMaterial
      const batePreco = filtroPreco === null || Number(p.preco) <= filtroPreco
      return bateMaterial && batePreco
    })
  }, [produtosOriginais, filtroMaterial, filtroPreco])

  return (
    <main className="min-h-dvh bg-hb-black text-gray-200">
      {/* Header */}
      <div className="bg-luxury-surface py-12 md:py-20 border-b border-luxury-line">
        <div className="luxury-container text-center">
          <h1 className="luxury-title text-luxury-ivory [overflow-wrap:anywhere]">
            {tituloCategoria}
          </h1>
          <div className="w-12 h-[1px] bg-hb-gold mx-auto mt-4"></div>
        </div>
      </div>

      <div className="luxury-container py-8 md:py-14 flex flex-col md:flex-row gap-8 md:gap-12">
        
        {/* BARRA LATERAL DE FILTROS */}
        <aside className="w-full md:w-52 flex-shrink-0 min-w-0 space-y-5 md:space-y-8">
          <div className="flex items-center gap-2 border-b border-luxury-line pb-3">
            <SlidersHorizontal size={16} />
            <span className="text-xs font-black uppercase tracking-widest">Filtros</span>
          </div>

          {/* Filtro de Material */}
          {materiaisDisponiveis.length > 0 && (
            <div>
              <h3 className="text-[10px] font-black text-luxury-muted uppercase mb-3 tracking-widest">Material</h3>
              <div className="flex flex-wrap md:flex-col gap-2">
                {materiaisDisponiveis.map((m) => (
                  <button
                    key={m}
                    onClick={() => setFiltroMaterial(filtroMaterial === m ? '' : m)}
                    aria-pressed={filtroMaterial === m}
                    className={`min-h-11 text-left text-xs px-3 py-2 border transition-colors flex items-center gap-2 ${
                      filtroMaterial === m ? 'text-hb-gold border-hb-gold bg-hb-gold/10 font-bold' : 'text-gray-300 border-luxury-line hover:border-hb-gold'
                    }`}
                  >
                    {filtroMaterial === m && <div className="w-1 h-1 bg-hb-gold rounded-full" />}
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filtro de Preço */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-black text-luxury-muted uppercase tracking-widest">Preço Máx.</h3>
              <span className="text-xs font-bold">R$ {limitePreco.toLocaleString('pt-BR')}</span>
            </div>
            <input 
              type="range" aria-label="Preço máximo" aria-valuetext={`Até R$ ${limitePreco}`} min="0" max={precoMaximo} step="50"
              value={limitePreco}
              onChange={(e) => setFiltroPreco(Number(e.target.value))}
              className="price-range"
            />
          </div>

          {/* Limpar Filtros */}
          {(filtroMaterial || filtroPreco !== null) && (
            <button 
              onClick={() => { setFiltroMaterial(''); setFiltroPreco(null); }}
              className="flex items-center gap-1 min-h-11 text-xs font-bold text-luxury-gold-light uppercase hover:text-luxury-ivory transition"
            >
              <X size={14} /> Limpar Filtros
            </button>
          )}
        </aside>

        {/* LISTAGEM DE PRODUTOS */}
        <div className="flex-1 min-w-0">
          {produtosFiltrados.length === 0 ? (
            <div className="text-center text-gray-500 py-20 border border-dashed rounded-xl">
              <p className="text-sm font-light mb-4">{produtosOriginais.length ? 'Nenhum item encontrado com estes filtros.' : 'Ainda não há peças cadastradas nesta coleção.'}</p>
              {produtosOriginais.length ? <button
                onClick={() => { setFiltroMaterial(''); setFiltroPreco(null); }}
                className="min-h-11 text-xs font-bold uppercase border-b border-hb-gold text-hb-gold pb-1"
              >
                Resetar Filtros
              </button> : <Link href="/produtos" className="luxury-link">Explorar todas as peças</Link>}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 sm:gap-x-6 gap-y-10">
              {produtosFiltrados.map((produto) => (
                <ProductCard key={produto.id} produto={produto} sizes="(max-width: 639px) calc(50vw - 24px), (max-width: 767px) calc(50vw - 36px), (max-width: 1023px) calc(50vw - 160px), (max-width: 1375px) calc(33vw - 136px), 310px" />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
