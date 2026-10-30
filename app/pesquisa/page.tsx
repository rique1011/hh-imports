'use client'
import Image from 'next/image'
import type { Produto } from '@/types/loja'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {  Loader2 } from 'lucide-react'

function ResultadosPesquisa() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q')
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function buscar() {
      if (!query) return
      setCarregando(true)
      
      const { data } = await supabase
        .from('produtos')
        .select('*')
        .or(`nome.ilike.%${query}%,descricao.ilike.%${query}%`)

      setProdutos(data || [])
      setCarregando(false)
    }
    buscar()
  }, [query])

  if (carregando) return <div className="min-h-screen bg-hb-black flex items-center justify-center"><Loader2 className="animate-spin text-hb-gold" /></div>

  return (
    <main className="min-h-screen bg-hb-black">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-xl font-light text-white uppercase tracking-widest mb-8 border-b border-hb-gray pb-4">
          Resultados para: <span className="font-bold italic text-hb-gold">&quot;{query}&quot;</span>
        </h1>

        {produtos.length === 0 ? (
          <p className="text-gray-400 italic">Nenhum produto encontrado para sua busca.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {produtos.map((p) => (
              <Link href={`/produto/${p.slug}`} key={p.id} className="group">
                <div className="aspect-[4/5] bg-hb-gray rounded-xl overflow-hidden mb-4 border border-gray-800">
                  <Image width={600} height={750} sizes="(max-width: 768px) 50vw, 25vw" alt={p.nome} src={p.fotos?.[0] || '/icon.svg'} className="w-full h-full object-cover group-hover:scale-105 opacity-80 group-hover:opacity-100 transition duration-700" />
                </div>
                <h2 className="text-xs font-bold text-gray-200 uppercase truncate group-hover:text-hb-gold transition-colors">{p.nome}</h2>
                <p className="text-sm font-medium text-hb-gold mt-1">R$ {Number(p.preco).toLocaleString('pt-BR')}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

export default function PaginaPesquisa() {
  return <Suspense><ResultadosPesquisa /></Suspense>
}
