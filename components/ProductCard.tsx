import Image from '@/components/ImagemOtimizada'
import Link from 'next/link'
import type { Produto } from '@/types/loja'
import BuyButton from '@/components/BuyButton'
import BotaoFavorito from '@/components/BotaoFavorito'
import { formatarPreco } from '@/lib/formatacao'

export type ProdutoCard = Pick<Produto, 'id' | 'nome' | 'slug' | 'preco' | 'fotos' | 'material' | 'estoque' | 'estoque_reservado'>

// Só os botões de compra e favoritos precisam de hidratação nas páginas do servidor.
export default function ProductCard({ produto, sizes = '(max-width: 639px) calc(50vw - 24px), (max-width: 1023px) calc(50vw - 36px), (max-width: 1375px) calc(25vw - 42px), 296px', eager = false }: {
  produto: ProdutoCard; sizes?: string; eager?: boolean
}) {
  const href = `/produto/${produto.slug}`
  return <article className="product-reveal group min-w-0" aria-label={produto.nome}>
    <div className="relative isolate overflow-hidden border border-luxury-line bg-luxury-surface transition-colors duration-300 hover:border-luxury-gold/40">
      <Link href={href} className="relative block aspect-[4/5] overflow-hidden" aria-label={`Ver ${produto.nome}`}>
        {produto.fotos?.[0] ? <Image src={produto.fotos[0]} alt={produto.nome} fill sizes={sizes} loading={eager ? 'eager' : 'lazy'} quality={75}
          className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.045]" />
          : <div className="flex h-full items-center justify-center p-4 text-center text-xs text-luxury-muted">Imagem em breve</div>}
      </Link>
      <div className="absolute right-2 top-2 sm:right-3 sm:top-3"><BotaoFavorito produto={produto} /></div>
    </div>
    <div className="pt-4 sm:pt-5">
      <p className="mb-1 min-h-4 truncate font-sans text-[9px] uppercase tracking-[0.16em] text-luxury-muted sm:text-[10px]">{produto.material || 'Seleção H&H'}</p>
      <Link href={href} className="block h-11 sm:h-14"><h3 className="line-clamp-2 break-words text-base font-normal leading-snug text-luxury-ivory transition-colors group-hover:text-luxury-gold-light sm:text-xl">{produto.nome}</h3></Link>
      <p className="mb-4 mt-2 text-sm font-medium tabular-nums text-luxury-gold-light sm:text-base">{formatarPreco(produto.preco)}</p>
      {produto.estoque !== undefined ? <BuyButton produto={produto} compact /> : <Link href={href} className="luxury-button luxury-button-outline w-full">Conhecer a peça</Link>}
    </div>
  </article>
}
