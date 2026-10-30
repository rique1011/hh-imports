'use client'

import { useCart } from '@/lib/store'
import { useState } from 'react'
import { ShoppingBag, Check } from 'lucide-react'

export default function BotaoAdicionar({ produto }: { produto: any }) {
  const adicionarAoCarrinho = useCart((state) => state.adicionarAoCarrinho)
  const [adicionado, setAdicionado] = useState(false)

  const handleAdicionar = () => {
    adicionarAoCarrinho({
      id: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      foto: produto.fotos && produto.fotos.length > 0 ? produto.fotos[0] : '', 
      quantidade: 1
    })
    
    setAdicionado(true)
    setTimeout(() => setAdicionado(false), 2000)
  }

  return (
    <button 
      onClick={handleAdicionar}
      disabled={adicionado}
      className={`w-full font-bold text-[11px] md:text-sm py-3 md:py-4 rounded shadow-lg transition-all duration-300 uppercase tracking-widest flex items-center justify-center gap-2 ${
        adicionado 
          ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-900/20' 
          : 'bg-hb-gold text-hb-black hover:bg-hb-goldLight shadow-hb-gold/10'
      }`}
    >
      {adicionado ? (
        <>
          <Check size={16} /> Adicionado à Sacola
        </>
      ) : (
        <>
          <ShoppingBag size={16} /> Adicionar à Sacola
        </>
      )}
    </button>
  )
}
