'use client'
import Link from '@/components/LinkNavegacao'
import { Menu, Search, ShoppingBag, User, X, LogOut, Shield, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import { useCart } from '@/lib/store'
import { useHidratado } from '@/lib/use-hidratado'
import { travarRolagem } from '@/lib/scroll-lock'
import { linkComRetorno } from '@/lib/navegacao'
import { MENSAGEM_FRETE_GRATIS } from '@/lib/politica-frete'
import { SELECOES } from '@/lib/selecoes'
import { CATEGORIAS } from '@/lib/categorias'

const links = SELECOES.map(s => ({ href: '/selecao/' + s.slug, nome: s.nome }))
const alvo = 'min-h-11 min-w-11 inline-flex items-center justify-center transition-colors hover:text-hb-goldLight focus-visible:outline-2 focus-visible:outline-hb-gold'

export default function Header({ marca, categorias = CATEGORIAS }: { marca: ReactNode; categorias?: readonly { slug: string; nome: string }[] }) {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const hidratado = useHidratado()
  const quantidade = useCart(state => state.itens.reduce((sum, item) => sum + item.quantidade, 0))
  const [menu, setMenu] = useState(false)
  const [joias, setJoias] = useState(false)
  const [joiasMobile, setJoiasMobile] = useState(false)
  const joiasRef = useRef<HTMLButtonElement>(null)
  const [busca, setBusca] = useState(false)
  const [termo, setTermo] = useState('')
  const abrirRef = useRef<HTMLButtonElement>(null)
  const painelRef = useRef<HTMLDivElement>(null)
  const fechar = useCallback(() => { setMenu(false); abrirRef.current?.focus() }, [])
  useEffect(() => {
    if (!menu) return
    const restaurarRolagem = travarRolagem()
    painelRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') fechar()
      if (event.key !== 'Tab') return
      const items = Array.from(painelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') || []).filter(el => el.offsetParent !== null)
      if (!items?.length) return
      const primeiro = items[0], ultimo = items[items.length - 1]
      if (event.shiftKey && document.activeElement === primeiro) { event.preventDefault(); ultimo.focus() }
      else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primeiro.focus() }
    }
    document.addEventListener('keydown', keyboard)
    const desktop = window.matchMedia('(min-width: 1024px)')
    const mudarTela = () => { if (desktop.matches) setMenu(false) }
    desktop.addEventListener('change', mudarTela)
    return () => {
      restaurarRolagem()
      document.removeEventListener('keydown', keyboard)
      desktop.removeEventListener('change', mudarTela)
    }
  }, [menu, fechar])
  function pesquisar(event: React.FormEvent) {
    event.preventDefault()
    if (!termo.trim()) return
    router.push('/pesquisa?q=' + encodeURIComponent(termo.trim()))
    setBusca(false); setTermo('')
  }
  return <header className="site-header sticky top-0 z-50 border-b border-luxury-gold/20 bg-luxury-black text-luxury-ivory">
    <Link href="/fretes-e-entregas" className="block border-b border-luxury-line bg-luxury-surface px-4 py-2 text-center text-[9px] leading-4 tracking-[0.08em] text-luxury-gold-light sm:text-[10px]">{MENSAGEM_FRETE_GRATIS}</Link>
    <div className="relative luxury-container flex h-[72px] items-center gap-1 lg:h-24 lg:gap-6">
      <button ref={abrirRef} className={`${alvo} lg:hidden shrink-0`} aria-label="Abrir menu" aria-controls="menu-mobile" aria-expanded={menu} onClick={() => setMenu(true)}><Menu size={24} /></button>
      <Link href="/colecoes" className="hidden min-h-11 flex-1 items-center text-[10px] uppercase tracking-[0.18em] text-luxury-muted hover:text-luxury-gold-light lg:flex">Joias para a sua história</Link>
      <Link href="/" aria-label="H&H IMPORTS — Início" className="flex min-w-0 flex-1 justify-center text-center lg:flex-none lg:px-6">{marca}</Link>
      <div className="shrink-0 lg:flex-1 flex items-center justify-end">
        <button className={alvo} aria-label="Pesquisar" aria-expanded={busca} onClick={() => setBusca(true)}><Search size={20} /></button>
        {session ? <div className="hidden lg:flex items-center gap-1">
          {session.user?.role === 'admin' && <Link className={`${alvo} text-hb-goldLight px-2 gap-1 text-xs`} href="/admin"><Shield size={16} /> Admin</Link>}
          <Link className={`${alvo} px-2 gap-2 text-xs`} href="/minha-conta"><User size={16} /><span className="max-w-24 truncate">Olá, {session.user?.name?.split(' ')[0]}</span></Link>
          <button className={alvo} aria-label="Sair da conta" onClick={() => signOut()}><LogOut size={18} /></button>
        </div> : <Link className={`${alvo} max-lg:hidden`} href={linkComRetorno('/login', pathname)} aria-label="Entrar na conta"><User size={20} /></Link>}
        <Link className={`${alvo} relative`} href="/carrinho" aria-label={`Sacola de compras${hidratado ? `, ${quantidade} itens` : ''}`}><ShoppingBag size={20} />
          {hidratado && quantidade > 0 && <span className="absolute right-0 top-1 grid place-items-center min-w-4 h-4 px-1 rounded-full bg-hb-gold text-hb-black text-[10px] font-bold">{quantidade}</span>}
        </Link>
      </div>
      {busca && <form onSubmit={pesquisar} className="absolute inset-0 z-10 bg-hb-black flex items-center gap-1 px-3 sm:px-6" onKeyDown={e => { if (e.key === 'Escape') setBusca(false) }}>
        <Search size={20} className="shrink-0" />
        <input autoFocus type="search" aria-label="Pesquisar joias" placeholder="Pesquisar joias..." value={termo} onChange={e => setTermo(e.target.value)} className="flex-1 min-w-0 bg-transparent border-b border-hb-gold py-3 text-base outline-none" />
        <button type="submit" className={`${alvo} text-xs px-2`}>Buscar</button>
        <button type="button" className={alvo} aria-label="Fechar pesquisa" onClick={() => setBusca(false)}><X size={22} /></button>
      </form>}
    </div>
    <nav aria-label="Navegação principal" className="hidden border-t border-luxury-line lg:block">
      <div className="luxury-container flex items-center justify-center gap-12 text-[11px] uppercase tracking-[0.18em]">
        {links.map(link => link.nome === 'Joias' ? <div key={link.href} className="relative" onMouseEnter={() => setJoias(true)} onMouseLeave={e => { if (!e.currentTarget.contains(document.activeElement)) setJoias(false) }}
          onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setJoias(false) }}
          onKeyDown={e => { if (e.key === 'Escape') { setJoias(false); joiasRef.current?.focus() } }}>
          <button ref={joiasRef} aria-expanded={joias} aria-controls="categorias-desktop" onClick={() => setJoias(!joias)} className={`${alvo} min-h-12 gap-2 uppercase tracking-[0.18em]`}>Joias <ChevronDown size={12} className={joias ? 'rotate-180' : ''} /></button>
          <div id="categorias-desktop" hidden={!joias} className="absolute left-1/2 top-full max-h-[65dvh] w-60 -translate-x-1/2 overflow-y-auto border border-luxury-gold/30 bg-luxury-black p-4 shadow-2xl">
            <Link href="/selecao/joias" onClick={() => setJoias(false)} className="flex min-h-11 items-center text-luxury-gold-light hover:underline">Ver todas as joias</Link>
            {categorias.map(c => <Link key={c.slug} href={'/categoria/' + c.slug} onClick={() => setJoias(false)} className="flex min-h-11 items-center text-luxury-muted hover:text-luxury-ivory">{c.nome}</Link>)}
            <Link href="/produtos" onClick={() => setJoias(false)} className="flex min-h-11 items-center border-t border-luxury-line text-luxury-muted hover:text-luxury-ivory">Catálogo completo</Link>
          </div>
        </div> : <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined} className={`${alvo} min-h-12 ${pathname === link.href ? 'text-luxury-gold-light' : 'text-luxury-muted'}`}>{link.nome}</Link>)}
        <Link href="/colecoes" className={`${alvo} min-h-12 text-luxury-muted`}>Coleções</Link>
      </div>
    </nav>
    {menu && <div className="fixed inset-0 bg-black/80 z-60 lg:hidden" onClick={fechar} />}
    <div ref={painelRef} id="menu-mobile" role={menu ? 'dialog' : undefined} aria-modal={menu || undefined} aria-label="Menu principal" inert={!menu}
      className={`fixed left-0 top-0 z-70 h-dvh w-[min(85vw,320px)] overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] bg-hb-black border-r border-luxury-gold/25 shadow-xl lg:hidden transition-transform ${menu ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="h-16 px-5 flex items-center justify-between border-b border-gray-800"><span className="text-hb-gold tracking-widest font-bold">MENU</span><button className={alvo} aria-label="Fechar menu" onClick={fechar}><X /></button></div>
      <nav className="p-5 flex flex-col gap-2 uppercase text-sm tracking-wide">
        {links.map(link => link.nome === 'Joias' ? <div key={link.href}>
          <button aria-expanded={joiasMobile} aria-controls="categorias-mobile" className="flex min-h-12 w-full items-center justify-between uppercase" onClick={() => setJoiasMobile(!joiasMobile)}>Joias <ChevronDown size={16} className={joiasMobile ? 'rotate-180' : ''} /></button>
          <div id="categorias-mobile" hidden={!joiasMobile} className="border-l border-luxury-gold/40 pl-4 text-xs normal-case text-luxury-muted">
            <Link href="/selecao/joias" onClick={fechar} className="flex min-h-11 items-center text-luxury-gold-light">Ver todas as joias</Link>
            {categorias.map(c => <Link key={c.slug} href={'/categoria/' + c.slug} onClick={fechar} className="flex min-h-11 items-center">{c.nome}</Link>)}
          </div>
        </div> : <Link key={link.href} href={link.href} onClick={fechar} className="min-h-12 flex items-center">{link.nome}</Link>)}
        <Link href="/produtos" onClick={fechar} className="min-h-11 flex items-center">Todas as peças</Link>
        <Link href="/colecoes" onClick={fechar} className="min-h-11 flex items-center">Coleções</Link>
        <Link href="/sobre" onClick={fechar} className="min-h-11 flex items-center">A H&H</Link>
        <div className="border-t border-gray-800 my-3" />
        {session ? <><Link className="min-h-11 flex items-center gap-3" href="/minha-conta" onClick={fechar}><User size={18} />Minha conta</Link>
          {session.user?.role === 'admin' && <Link className="min-h-11 flex items-center gap-3 text-hb-goldLight" href="/admin" onClick={fechar}><Shield size={18} />Painel admin</Link>}
          <button className="min-h-11 flex items-center gap-3" onClick={() => { fechar(); signOut() }}><LogOut size={18} />Sair</button></> : <Link className="min-h-11 flex items-center text-hb-gold" href={linkComRetorno('/login', pathname)} onClick={fechar}>Entrar / Cadastrar</Link>}
      </nav>
    </div>
  </header>
}
