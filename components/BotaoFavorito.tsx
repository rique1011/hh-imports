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
    className="min-w-11 min-h-11 grid place-items-center bg-luxury-black/85 border border-luxury-gold/25 rounded-full transition-colors hover:border-luxury-gold hover:bg-luxury-surface focus-visible:outline-2 focus-visible:outline-hb-gold">
    <Heart size={18} strokeWidth={1.5} aria-hidden="true" className={marcado ? 'fill-luxury-gold text-luxury-gold' : 'text-luxury-gold-light'} />
  </button>
}
