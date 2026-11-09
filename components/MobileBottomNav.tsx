'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, LayoutGrid, Search, ShoppingBag, UserRound } from 'lucide-react'
import { useCart } from '@/lib/store'
import { useHidratado } from '@/lib/use-hidratado'
import { useSession } from 'next-auth/react'
import { linkComRetorno } from '@/lib/navegacao'

const destinos = [
  { href: '/', nome: 'Início', Icon: House },
  { href: '/colecoes', nome: 'Coleções', Icon: LayoutGrid },
  { href: '/pesquisa', nome: 'Buscar', Icon: Search },
  { href: '/minha-conta', nome: 'Conta', Icon: UserRound },
  { href: '/carrinho', nome: 'Sacola', Icon: ShoppingBag },
]

export default function MobileBottomNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const hidratado = useHidratado()
  const quantidade = useCart(state => state.itens.reduce((total, item) => total + item.quantidade, 0))
  // Produto tem seu próprio CTA na thumb zone. Checkout e admin mantêm o foco no fluxo.
  if (pathname.startsWith('/produto/') || pathname.startsWith('/admin') || pathname === '/carrinho' || pathname.startsWith('/order-success/') || pathname === '/sucesso') return null
  return <nav aria-label="Navegação inferior" className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-luxury-gold/25 bg-luxury-black lg:hidden">
    <div className="mx-auto grid max-w-lg grid-cols-5">
      {destinos.map(({ href, nome, Icon }) => {
        const ativo = href === '/' ? pathname === '/' : pathname.startsWith(href) || (href === '/colecoes' && (pathname.startsWith('/categoria/') || pathname === '/produtos'))
        return <Link key={href} href={href === '/minha-conta' && !session ? linkComRetorno('/login', pathname) : href} aria-current={ativo ? 'page' : undefined} className={`relative flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1.5 text-[9px] tracking-wide ${ativo ? 'text-luxury-gold-light' : 'text-luxury-muted'}`}>
          <span className="relative"><Icon size={19} strokeWidth={1.4} aria-hidden="true" />{href === '/carrinho' && hidratado && quantidade > 0 && <span key={quantidade} className="absolute -right-2.5 -top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-luxury-gold px-1 text-[9px] font-semibold text-luxury-black motion-safe:animate-cart-pop">{quantidade}<span className="sr-only"> itens na sacola</span></span>}</span>
          {nome}<span className={`absolute top-0 h-px w-6 bg-luxury-gold ${ativo ? '' : 'hidden'}`} aria-hidden="true" />
        </Link>
      })}
    </div>
  </nav>
}
