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
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gray-50 py-16 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h1 className="text-4xl font-light text-gray-900 uppercase tracking-widest">
            {tituloCategoria}
          </h1>
          <div className="w-12 h-[1px] bg-black mx-auto mt-6"></div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row gap-12">
        
        {/* BARRA LATERAL DE FILTROS */}
        <aside className="w-full md:w-56 flex-shrink-0 space-y-10">
          <div className="flex items-center gap-2 border-b border-gray-900 pb-4">
            <SlidersHorizontal size={16} />
            <span className="text-xs font-black uppercase tracking-widest">Filtros</span>
          </div>

          {/* Filtro de Material */}
          {materiaisDisponiveis.length > 0 && (
            <div>
              <h3 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Material</h3>
              <div className="flex flex-col gap-2">
                {materiaisDisponiveis.map((m) => (
                  <button
                    key={m}
                    onClick={() => setFiltroMaterial(filtroMaterial === m ? '' : m)}
                    className={`text-left text-xs py-1 transition-all flex items-center gap-2 ${
                      filtroMaterial === m ? 'text-black font-bold translate-x-1' : 'text-gray-500 hover:text-black'
                    }`}
                  >
                    {filtroMaterial === m && <div className="w-1 h-1 bg-black rounded-full" />}
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
              className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-black"
            />
          </div>

          {/* Limpar Filtros */}
          {(filtroMaterial || filtroPreco < 10000) && (
            <button 
              onClick={() => { setFiltroMaterial(''); setFiltroPreco(10000); }}
              className="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase hover:text-red-700 transition"
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
                className="text-xs font-bold uppercase border-b border-black text-black pb-1"
              >
                Resetar Filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
              {produtosFiltrados.map((produto) => (
                <Link 
                  href={`/produto/${produto.slug}`} 
                  key={produto.id} 
                  className="group flex flex-col min-w-0"
                >
                  <div className="relative w-full aspect-square bg-gray-50 overflow-hidden mb-4 border border-gray-100">
                    {produto.fotos && produto.fotos.length > 0 ? (
                      <Image width={600} height={750} sizes="(max-width: 768px) 50vw, 25vw"
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
                    <h2 className="text-sm max-w-full break-words font-medium text-gray-700 uppercase tracking-wide group-hover:text-black transition">
                      {produto.nome}
                    </h2>
                    <p className="text-base font-bold text-gray-900 mt-2">
                      R$ {Number(produto.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <span className="mt-3 text-[9px] font-bold uppercase tracking-[0.2em] text-black opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1">
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
