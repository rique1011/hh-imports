'use client'
import Link from 'next/link'
import { Menu, Search, ShoppingBag, User, X, LogOut, Shield } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/store'
import { useHidratado } from '@/lib/use-hidratado'
import { travarRolagem } from '@/lib/scroll-lock'

const links = [{ href: '/', nome: 'Home' }, { href: '/colecoes', nome: 'Coleções' }, { href: '/sobre', nome: 'Sobre' }]
const alvo = 'min-h-11 min-w-11 inline-flex items-center justify-center rounded hover:text-hb-gold focus-visible:outline-2 focus-visible:outline-hb-gold'

export default function Header() {
  const { data: session } = useSession()
  const router = useRouter()
  const hidratado = useHidratado()
  const quantidade = useCart(state => state.itens.reduce((sum, item) => sum + item.quantidade, 0))
  const [menu, setMenu] = useState(false)
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
      const items = painelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
      if (!items?.length) return
      const primeiro = items[0], ultimo = items[items.length - 1]
      if (event.shiftKey && document.activeElement === primeiro) { event.preventDefault(); ultimo.focus() }
      else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primeiro.focus() }
    }
    document.addEventListener('keydown', keyboard)
    const desktop = window.matchMedia('(min-width: 1280px)')
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
  return <header className="site-header sticky top-0 z-50 border-b border-hb-gray bg-hb-black text-gray-300">
    <div className="relative max-w-6xl mx-auto h-16 px-3 sm:px-6 flex items-center gap-1 xl:gap-6">
      <button ref={abrirRef} className={`${alvo} xl:hidden shrink-0`} aria-label="Abrir menu" aria-controls="menu-mobile" aria-expanded={menu} onClick={() => setMenu(true)}><Menu size={24} /></button>
      <nav className="hidden xl:flex flex-1 min-w-0 gap-6 text-sm uppercase">{links.map(link => <Link key={link.href} href={link.href} className="min-h-11 inline-flex items-center hover:text-hb-gold">{link.nome}</Link>)}</nav>
      <Link href="/" className="min-w-0 flex-1 xl:flex-none text-center text-sm sm:text-xl font-bold tracking-wide sm:tracking-widest text-hb-gold whitespace-nowrap">H&H IMPORTS</Link>
      <div className="shrink-0 xl:flex-1 flex items-center justify-end">
        <button className={alvo} aria-label="Pesquisar" aria-expanded={busca} onClick={() => setBusca(true)}><Search size={20} /></button>
        {session ? <div className="hidden xl:flex items-center gap-1">
          {session.user?.role === 'admin' && <Link className={`${alvo} text-red-400 px-2 gap-1 text-xs`} href="/admin"><Shield size={16} /> Admin</Link>}
          <Link className={`${alvo} px-2 gap-2 text-xs`} href="/minha-conta"><User size={16} /><span className="max-w-24 truncate">Olá, {session.user?.name?.split(' ')[0]}</span></Link>
          <button className={alvo} aria-label="Sair da conta" onClick={() => signOut()}><LogOut size={18} /></button>
        </div> : <Link className={`${alvo} hidden xl:inline-flex`} href="/login" aria-label="Entrar na conta"><User size={20} /></Link>}
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
    {menu && <div className="fixed inset-0 bg-black/80 z-40 xl:hidden" onClick={fechar} />}
    <div ref={painelRef} id="menu-mobile" role={menu ? 'dialog' : undefined} aria-modal={menu || undefined} aria-label="Menu principal" inert={!menu}
      className={`fixed left-0 top-0 z-50 h-dvh w-[min(85vw,320px)] overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] bg-hb-black border-r border-gray-800 shadow-xl xl:hidden transition-transform ${menu ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="h-16 px-5 flex items-center justify-between border-b border-gray-800"><span className="text-hb-gold tracking-widest font-bold">MENU</span><button className={alvo} aria-label="Fechar menu" onClick={fechar}><X /></button></div>
      <nav className="p-5 flex flex-col gap-2 uppercase text-sm tracking-wide">
        {links.map(link => <Link key={link.href} href={link.href} onClick={fechar} className="min-h-11 flex items-center">{link.nome}</Link>)}
        <div className="border-t border-gray-800 my-3" />
        {session ? <><Link className="min-h-11 flex items-center gap-3" href="/minha-conta" onClick={fechar}><User size={18} />Minha conta</Link>
          {session.user?.role === 'admin' && <Link className="min-h-11 flex items-center gap-3 text-red-400" href="/admin" onClick={fechar}><Shield size={18} />Painel admin</Link>}
          <button className="min-h-11 flex items-center gap-3" onClick={() => { fechar(); signOut() }}><LogOut size={18} />Sair</button></> : <Link className="min-h-11 flex items-center text-hb-gold" href="/login" onClick={fechar}>Entrar / Cadastrar</Link>}
      </nav>
    </div>
  </header>
}
