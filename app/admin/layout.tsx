import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { LayoutDashboard, Package, ShoppingBag, ArrowLeftRight, DollarSign, Ticket } from 'lucide-react'
import { exigirAdmin, ErroHttp } from '@/lib/autorizacao'
const links = [
  { href: '/admin', titulo: 'Dashboard', Icon: LayoutDashboard },
  { href: '/admin/pedidos', titulo: 'Pedidos', Icon: ShoppingBag },
  { href: '/admin/estoque', titulo: 'Estoque', Icon: Package },
  { href: '/admin/devolucoes', titulo: 'Devoluções', Icon: ArrowLeftRight },
  { href: '/admin/cupons', titulo: 'Cupons', Icon: Ticket },
  { href: '/admin/financeiro', titulo: 'Financeiro', Icon: DollarSign },
]
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try { await exigirAdmin(new Request('https://hh.local/admin', { headers: await headers() })) }
  catch (error) { if (error instanceof ErroHttp) redirect(error.status === 401 ? '/login' : '/minha-conta'); throw error }
  return <div className="min-h-screen flex flex-col lg:flex-row bg-hb-black">
    <aside className="w-full lg:w-64 shrink-0 self-start lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] flex flex-col bg-hb-gray border-b lg:border-r border-gray-800">
      <div className="p-4 lg:p-6 border-b border-gray-800"><h2 className="text-lg text-hb-gold tracking-wide">H&H IMPORTS Admin</h2><p className="text-[10px] uppercase text-gray-400 mt-2">Painel de controle</p></div>
      <nav aria-label="Administração" className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-col gap-1 p-3 lg:flex-1 overflow-y-auto">
        {links.map(({ href, titulo, Icon }) => <Link key={href} href={href} className="min-h-11 min-w-0 flex items-center gap-2 rounded-lg px-3 py-3 text-xs text-gray-300 hover:bg-gray-800 hover:text-hb-gold"><Icon size={18} className="shrink-0" />{titulo}</Link>)}
      </nav>
    </aside>
    <div className="flex-1 min-w-0 p-4 sm:p-6 xl:p-10">{children}</div>
  </div>
}
