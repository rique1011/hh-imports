'use client'
import { useEffect, useRef, useState } from 'react'
import { ShoppingBag, Check } from 'lucide-react'
import { useCart } from '@/lib/store'
interface ProdutoCompra { id: string; nome: string; preco: number; fotos?: string[] | null; estoque?: number | null; estoque_reservado?: number; slug?: string }
export default function BotaoAdicionar({ produto }: { produto: ProdutoCompra }) {
  const adicionar = useCart(state => state.adicionarAoCarrinho)
  const quantidade = useCart(state => state.itens.find(item => item.id === produto.id)?.quantidade || 0)
  const [adicionado, setAdicionado] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const disponivel = Math.max(0, Number(produto.estoque || 0) - Number(produto.estoque_reservado || 0))
  const esgotado = quantidade >= disponivel
  function comprar() {
    if (esgotado || adicionado) return
    adicionar({ id: produto.id, nome: produto.nome, preco: produto.preco, foto: produto.fotos?.[0] || '', slug: produto.slug, quantidade: 1 })
    setAdicionado(true)
    timer.current = setTimeout(() => setAdicionado(false), 2000)
  }
  const botao = (mobile: boolean) => <button onClick={comprar} disabled={esgotado || adicionado} aria-label={mobile ? 'Adicionar à sacola pelo rodapé' : 'Adicionar à sacola'} className={`min-h-12 px-4 py-3 w-full rounded font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-60 ${adicionado ? 'bg-green-700 text-white' : 'bg-hb-gold text-hb-black'}`}>
    {adicionado ? <Check size={18} /> : <ShoppingBag size={18} />}{adicionado ? 'Adicionado à sacola' : esgotado ? disponivel ? 'Limite na sacola' : 'Sem estoque' : 'Adicionar à sacola'}
  </button>
  return <>
    <div className="hidden md:block">{botao(false)}</div>
    <p className="mt-3 text-xs text-gray-400" aria-live="polite">{disponivel ? `${disponivel} unidade(s) disponível(is).` : 'Produto indisponível no momento.'}</p>
    <div className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-hb-black border-t border-gray-700 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-xl">
      <div className="max-w-6xl mx-auto flex items-center gap-3"><span className="shrink-0 text-hb-gold text-sm font-bold">R$ {Number(produto.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span><div className="flex-1 min-w-0">{botao(true)}</div></div>
    </div>
  </>
}
