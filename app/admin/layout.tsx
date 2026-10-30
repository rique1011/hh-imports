import Link from 'next/link'
import { LayoutDashboard, Package, ShoppingBag, ArrowLeftRight, DollarSign, LogOut, Ticket } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-hb-black flex font-sans">
      
      {/* MENU LATERAL ESCURO */}
      <aside className="w-64 bg-hb-gray border-r border-gray-800 text-white flex flex-col fixed h-full z-10 shadow-xl">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold tracking-widest uppercase text-hb-gold">H&H IMPORTS Admin</h2>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Painel de Controle</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link href="/admin" className="flex items-center gap-3 p-3 rounded-lg bg-hb-gold text-hb-black font-bold uppercase text-xs tracking-widest transition shadow-md">
            <LayoutDashboard size={18} /> Dashboard
          </Link>
          <Link href="/admin/pedidos" className="flex items-center gap-3 p-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white uppercase text-xs tracking-widest transition">
            <ShoppingBag size={18} /> Pedidos
          </Link>
          <Link href="/admin/estoque" className="flex items-center gap-3 p-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white uppercase text-xs tracking-widest transition">
            <Package size={18} /> Estoque
          </Link>
          <Link href="/admin/devolucoes" className="flex items-center gap-3 p-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white uppercase text-xs tracking-widest transition">
            <ArrowLeftRight size={18} /> Devoluções
          </Link>
          
          <Link href="/admin/cupons" className="flex items-center gap-3 p-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white uppercase text-xs tracking-widest transition">
            <Ticket size={18} /> Cupons Promocionais
          </Link>

          <Link href="/admin/financeiro" className="flex items-center gap-3 p-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white uppercase text-xs tracking-widest transition">
            <DollarSign size={18} /> Financeiro
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button className="flex items-center gap-3 p-3 w-full rounded-lg text-red-400 hover:bg-red-900/20 hover:text-red-300 uppercase text-xs tracking-widest transition">
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      {/* ÁREA CENTRAL ONDE O CONTEÚDO APARECE */}
      <main className="flex-1 ml-64 p-8 md:p-12 bg-hb-black min-h-screen">
        {children}
      </main>
      
    </div>
  )
}
