'use client'
import { Heart } from 'lucide-react'
import { useCart } from '@/lib/store'
import { useHidratado } from '@/lib/use-hidratado'
interface ProdutoFavorito { id: string; nome: string; preco: number; fotos?: string[] | null; slug: string }
export default function BotaoFavorito({ produto }: { produto: ProdutoFavorito }) {
  const hidratado = useHidratado()
  const favorito = useCart(state => state.wishlist.some(item => item.id === produto.id))
  const toggle = useCart(state => state.toggleWishlist)
  const marcado = hidratado && favorito
  const descricao = marcado ? 'Remover da lista de desejos' : 'Adicionar à lista de desejos'
  return <button type="button" aria-label={descricao} aria-pressed={marcado} title={descricao}
    onClick={event => { event.preventDefault(); event.stopPropagation(); toggle({ id: produto.id, nome: produto.nome,
      preco: produto.preco, foto: produto.fotos?.[0] || '', slug: produto.slug, quantidade: 1 }) }}
    className="min-w-11 min-h-11 grid place-items-center bg-neutral-900/80 border border-neutral-800 rounded-full hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-hb-gold">
    <Heart size={20} className={marcado ? 'fill-red-500 text-red-500' : 'text-neutral-400'} />
  </button>
}
