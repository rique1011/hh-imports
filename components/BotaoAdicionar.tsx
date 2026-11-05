import BuyButton, { type ProdutoCompra } from '@/components/BuyButton'
import { formatarPreco } from '@/lib/formatacao'

export default function BotaoAdicionar({ produto }: { produto: ProdutoCompra }) {
  const disponivel = Math.max(0, Number(produto.estoque || 0) - Number(produto.estoque_reservado || 0))
  return <>
    <div className="hidden lg:block"><BuyButton produto={produto} /></div>
    <p className="mt-3 text-xs leading-relaxed text-luxury-muted">{disponivel ? 'Disponível. Escolha o frete para o seu endereço abaixo.' : 'Produto indisponível no momento.'}</p>
    <div className="mobile-purchase-bar fixed inset-x-0 bottom-0 z-40 border-t border-luxury-gold/25 bg-luxury-black pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] pt-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <div className="shrink-0"><p className="mb-1 text-[9px] uppercase tracking-[0.16em] text-luxury-muted">Sua escolha</p><span className="text-base font-medium tabular-nums text-luxury-gold-light">{formatarPreco(produto.preco)}</span></div>
        <div className="min-w-0 flex-1"><BuyButton produto={produto} /></div>
      </div>
    </div>
  </>
}
