'use client'

import { useCart } from '@/lib/store'
import { Heart, Loader2 } from 'lucide-react'
import { useState } from 'react'

interface BotaoFavoritoProps {
  id: string;
  nome: string;
  preco: number;
  fotos: string[];
  slug: string;
}

export default function BotaoFavorito({ produto }: { produto: BotaoFavoritoProps }) {
  const { wishlist, toggleWishlist } = useCart() as any
  const [carregando, setCarregando] = useState(false)

  const isFavorito = wishlist.some((i: any) => i.id === produto.id)

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault() 
    e.stopPropagation() 
    
    setCarregando(true)
    
    await new Promise(resolve => setTimeout(resolve, 300))

    toggleWishlist({
      id: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      foto: produto.fotos?.[0] || '', 
      slug: produto.slug,
      quantidade: 1 
    })

    setCarregando(false)
  }

  return (
    <button 
      onClick={handleToggle}
      disabled={carregando}
      title={isFavorito ? "Remover da lista de desejos" : "Adicionar à lista de desejos"}
      className="p-3 bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm rounded-full shadow-lg hover:bg-neutral-800 hover:scale-105 transition-all duration-300 group disabled:opacity-70"
    >
      {carregando ? (
        <Loader2 className="animate-spin text-neutral-500" size={20} />
      ) : (
        <Heart 
          size={20} 
          className={`transition-colors duration-300 ${isFavorito ? "fill-red-500 text-red-500" : "text-neutral-400 group-hover:text-red-400"}`} 
        />
      )}
    </button>
  )
}
