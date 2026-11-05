'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ShoppingBag } from 'lucide-react'
import { useCart } from '@/lib/store'
import { useHidratado } from '@/lib/use-hidratado'

export interface ProdutoCompra {
  id: string
  nome: string
  preco: number
  fotos?: string[] | null
  estoque?: number | null
  estoque_reservado?: number
  slug?: string
}

export default function BuyButton({ produto, compact = false }: { produto: ProdutoCompra; compact?: boolean }) {
  const adicionar = useCart(state => state.adicionarAoCarrinho)
  const quantidade = useCart(state => state.itens.find(item => item.id === produto.id)?.quantidade || 0)
  const hidratado = useHidratado()
  const [adicionado, setAdicionado] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const disponivel = Math.max(0, Number(produto.estoque || 0) - Number(produto.estoque_reservado || 0))
  const esgotado = !disponivel || (hidratado && quantidade >= disponivel)

  function comprar() {
    if (!hidratado || esgotado || adicionado) return
    adicionar({ id: produto.id, nome: produto.nome, preco: Number(produto.preco), foto: produto.fotos?.[0] || '', slug: produto.slug, quantidade: 1 })
    setAdicionado(true)
    timer.current = setTimeout(() => setAdicionado(false), 1800)
  }

  const texto = adicionado ? 'Adicionado' : esgotado ? disponivel ? 'Limite na sacola' : 'Indisponível' : compact ? 'Adicionar' : 'Adicionar à sacola'
  return <>
    <button type="button" onClick={comprar} disabled={!hidratado || esgotado || adicionado}
      aria-label={adicionado ? `${produto.nome} adicionado à sacola` : esgotado ? `${produto.nome}: ${texto}` : `Adicionar ${produto.nome} à sacola`}
      data-added={adicionado} className={`luxury-button w-full ${compact ? 'px-2 text-[10px] sm:text-[11px]' : ''}`}>
      {adicionado ? <Check size={16} strokeWidth={1.5} className="shrink-0 motion-safe:animate-cart-pop" aria-hidden="true" /> : <ShoppingBag size={16} strokeWidth={1.5} className="shrink-0" aria-hidden="true" />}
      <span>{texto}</span>
    </button>
    <span className="sr-only" role="status" aria-live="polite">{adicionado ? `${produto.nome} adicionado à sacola.` : ''}</span>
  </>
}
