'use client'
import Image from 'next/image'
import type { Produto } from '@/types/loja'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { SlidersHorizontal, X, ChevronRight } from 'lucide-react'

// Recebe os produtos já carregados pelo servidor
export default function FiltroCategoria({ produtosOriginais, tituloCategoria }: { produtosOriginais: Produto[], tituloCategoria: string }) {
  const [filtroMaterial, setFiltroMaterial] = useState('')
  const [filtroPreco, setFiltroPreco] = useState(10000)

  // Identifica os materiais existentes
  const materiaisDisponiveis = useMemo(() => {
    const lista = produtosOriginais.map(p => p.material).filter((material): material is string => Boolean(material))
    return Array.from(new Set(lista))
  }, [produtosOriginais])

  // Aplica os filtros
  const produtosFiltrados = useMemo(() => {
    return produtosOriginais.filter(p => {
      const bateMaterial = filtroMaterial === '' || p.material === filtroMaterial
      const batePreco = Number(p.preco) <= filtroPreco
      return bateMaterial && batePreco
    })
  }, [produtosOriginais, filtroMaterial, filtroPreco])

  return (
    <main className="min-h-dvh bg-hb-black text-gray-200">
      {/* Header */}
      <div className="bg-hb-gray py-8 md:py-12 border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 md:px-6 text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-light text-white uppercase tracking-wide [overflow-wrap:anywhere]">
            {tituloCategoria}
          </h1>
          <div className="w-12 h-[1px] bg-hb-gold mx-auto mt-4"></div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-12 flex flex-col md:flex-row gap-6 md:gap-10">
        
        {/* BARRA LATERAL DE FILTROS */}
        <aside className="w-full md:w-52 flex-shrink-0 min-w-0 space-y-5 md:space-y-8">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
            <SlidersHorizontal size={16} />
            <span className="text-xs font-black uppercase tracking-widest">Filtros</span>
          </div>

          {/* Filtro de Material */}
          {materiaisDisponiveis.length > 0 && (
            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase mb-3 tracking-widest">Material</h3>
              <div className="flex flex-wrap md:flex-col gap-2">
                {materiaisDisponiveis.map((m) => (
                  <button
                    key={m}
                    onClick={() => setFiltroMaterial(filtroMaterial === m ? '' : m)}
                    className={`min-h-11 text-left text-xs px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
                      filtroMaterial === m ? 'text-hb-gold border-hb-gold bg-hb-gold/10 font-bold' : 'text-gray-300 border-gray-700 hover:border-hb-gold'
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
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Preço Máx.</h3>
              <span className="text-xs font-bold">R$ {filtroPreco}</span>
            </div>
            <input 
              type="range" aria-label="Preço máximo" min="0" max="10000" step="50"
              value={filtroPreco}
              onChange={(e) => setFiltroPreco(Number(e.target.value))}
              className="price-range"
            />
          </div>

          {/* Limpar Filtros */}
          {(filtroMaterial || filtroPreco < 10000) && (
            <button 
              onClick={() => { setFiltroMaterial(''); setFiltroPreco(10000); }}
              className="flex items-center gap-1 min-h-11 text-xs font-bold text-red-400 uppercase hover:text-red-300 transition"
            >
              <X size={14} /> Limpar Filtros
            </button>
          )}
        </aside>

        {/* LISTAGEM DE PRODUTOS */}
        <div className="flex-1 min-w-0">
          {produtosFiltrados.length === 0 ? (
            <div className="text-center text-gray-500 py-20 border border-dashed rounded-xl">
              <p className="text-sm font-light mb-4">Nenhum item encontrado com estes filtros.</p>
              <button 
                onClick={() => { setFiltroMaterial(''); setFiltroPreco(10000); }}
                className="min-h-11 text-xs font-bold uppercase border-b border-hb-gold text-hb-gold pb-1"
              >
                Resetar Filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-3 sm:gap-x-6 gap-y-6 md:gap-y-10">
              {produtosFiltrados.map((produto) => (
                <Link 
                  href={`/produto/${produto.slug}`} 
                  key={produto.id} 
                  className="group flex flex-col min-w-0"
                >
                  <div className="relative w-full aspect-square bg-hb-gray overflow-hidden mb-3 border border-gray-800 rounded-lg">
                    {produto.fotos && produto.fotos.length > 0 ? (
                      <Image width={600} height={600} sizes="(max-width: 767px) calc(50vw - 22px), (max-width: 1023px) 32vw, 280px"
                        src={produto.fotos[0]} 
                        alt={produto.nome} 
                        loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs italic">Sem imagem</div>
                    )}
                  </div>

                  <div className="flex flex-col items-center text-center px-2 min-w-0">
                    <p className="text-[9px] text-gray-400 uppercase font-bold mb-1 tracking-widest">{produto.material}</p>
                    <h2 className="text-xs md:text-sm max-w-full break-words line-clamp-2 min-h-8 font-medium text-gray-200 uppercase tracking-wide group-hover:text-hb-gold transition">
                      {produto.nome}
                    </h2>
                    <p className="text-sm md:text-base font-bold text-hb-gold mt-2">
                      R$ {Number(produto.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="mt-3 min-h-11 text-[10px] font-bold uppercase tracking-wide text-gray-400 group-hover:text-hb-gold transition-colors flex items-center gap-1">
                      Ver detalhes <ChevronRight size={10} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
