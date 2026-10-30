'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  TrendingUp, DollarSign, ShoppingBag, Eye, 
  Package, Loader2, ArrowUpRight, Clock, CheckCircle2 
} from 'lucide-react'

export default function AdminDashboard() {
  const [carregando, setCarregando] = useState(true)
  
  const [pedidos, setPedidos] = useState<any[]>([])
  const [produtosPopulares, setProdutosPopulares] = useState<any[]>([])
  const [receitaTotal, setReceitaTotal] = useState(0)
  const [vendasConcluidas, setVendasConcluidas] = useState(0)

  useEffect(() => {
    async function carregarDashboard() {
      try {
        const { data: dadosPedidos, error: erroPedidos } = await supabase
          .from('pedidos')
          .select('*')
          .order('created_at', { ascending: false })

        if (!erroPedidos && dadosPedidos) {
          setPedidos(dadosPedidos)
          
          const receita = dadosPedidos
            .filter(p => ['pago', 'confirmado', 'processando', 'enviado', 'entregue'].includes(p.status))
            .reduce((acc, pedido) => acc + Number(pedido.total), 0)
          
          const concluidas = dadosPedidos.filter(p => ['pago', 'confirmado', 'processando', 'enviado', 'entregue'].includes(p.status)).length

          setReceitaTotal(receita)
          setVendasConcluidas(concluidas)
        }

        const { data: dadosProdutos, error: erroProdutos } = await supabase
          .from('produtos')
          .select('*')
          .order('visitas', { ascending: false })
          .limit(5)

        if (!erroProdutos && dadosProdutos) {
          setProdutosPopulares(dadosProdutos)
        }

      } catch (error) {
        console.error("Erro ao carregar dashboard:", error)
      } finally {
        setCarregando(false)
      }
    }

    carregarDashboard()
  }, [])

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase()
    if (s === 'entregue' || s === 'pago' || s === 'confirmado') return 'bg-green-900/30 text-green-400 border-green-800'
    if (s === 'enviado') return 'bg-blue-900/30 text-blue-400 border-blue-800'
    if (s === 'processando' || s === 'pendente') return 'bg-yellow-900/30 text-yellow-400 border-yellow-800'
    return 'bg-gray-800 text-gray-300 border-gray-700'
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center bg-hb-black"><Loader2 className="animate-spin text-hb-gold" size={32} /></div>
  }

  return (
    <main className="min-h-screen bg-hb-black py-6 md:py-8 px-4 md:px-8">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        
        {/* CABEÇALHO */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-light text-white uppercase tracking-widest italic mb-1 md:mb-2">Visão Geral</h1>
            <p className="text-[10px] md:text-sm text-gray-400 uppercase tracking-widest font-medium">Acompanhe o desempenho da loja</p>
          </div>
          <div className="text-[9px] md:text-[10px] font-bold text-gray-300 uppercase tracking-widest flex items-center gap-2 bg-gray-900 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-gray-800 shadow-sm">
            <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500 animate-pulse"></span> Sistema Online
          </div>
        </div>

        {/* CARDS DE MÉTRICAS GERAIS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-hb-gray p-5 md:p-6 rounded-2xl border border-gray-800 shadow-sm relative overflow-hidden group hover:border-hb-gold transition-colors">
            <div className="absolute -right-6 -top-6 bg-hb-gold/10 w-24 h-24 rounded-full group-hover:scale-110 transition-transform"></div>
            <div className="flex justify-between items-start mb-3 md:mb-4 relative z-10">
              <div className="p-2 md:p-3 bg-hb-gold/10 text-hb-gold rounded-xl"><DollarSign size={18} className="md:w-5 md:h-5"/></div>
              <span className="text-[9px] md:text-[10px] font-bold text-green-400 bg-green-900/30 border border-green-800 px-2 py-1 rounded flex items-center gap-1"><TrendingUp size={10} className="md:w-3 md:h-3"/> +12%</span>
            </div>
            <h3 className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 relative z-10">Receita Total</h3>
            <p className="text-xl md:text-2xl font-black text-white relative z-10">R$ {receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>

          <div className="bg-hb-gray p-5 md:p-6 rounded-2xl border border-gray-800 shadow-sm hover:border-hb-gold transition-colors">
            <div className="flex justify-between items-start mb-3 md:mb-4">
              <div className="p-2 md:p-3 bg-gray-800 text-gray-300 rounded-xl"><ShoppingBag size={18} className="md:w-5 md:h-5"/></div>
            </div>
            <h3 className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Vendas Concluídas</h3>
            <p className="text-xl md:text-2xl font-black text-white">{vendasConcluidas}</p>
          </div>

          <div className="bg-hb-gray p-5 md:p-6 rounded-2xl border border-gray-800 shadow-sm hover:border-hb-gold transition-colors">
            <div className="flex justify-between items-start mb-3 md:mb-4">
              <div className="p-2 md:p-3 bg-gray-800 text-gray-300 rounded-xl"><Package size={18} className="md:w-5 md:h-5"/></div>
            </div>
            <h3 className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total de Pedidos</h3>
            <p className="text-xl md:text-2xl font-black text-white">{pedidos.length}</p>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-black p-5 md:p-6 rounded-2xl shadow-sm border border-hb-gold/30 text-white hover:border-hb-gold transition-colors">
            <div className="flex justify-between items-start mb-3 md:mb-4">
              <div className="p-2 md:p-3 bg-hb-gold/20 text-hb-gold rounded-xl"><CheckCircle2 size={18} className="md:w-5 md:h-5"/></div>
            </div>
            <h3 className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Taxa de Sucesso</h3>
            <p className="text-xl md:text-2xl font-black text-white">
              {pedidos.length > 0 ? Math.round((vendasConcluidas / pedidos.length) * 100) : 0}%
            </p>
          </div>
        </div>

        {/* ÁREA INFERIOR */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          
          <div className="bg-hb-gray rounded-2xl border border-gray-800 shadow-sm flex flex-col">
            <div className="p-4 md:p-6 border-b border-gray-800 flex justify-between items-center">
              <h2 className="text-[11px] md:text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Eye size={16} className="text-hb-gold md:w-[18px] md:h-[18px]" /> Top Joias Acessadas
              </h2>
            </div>
            <div className="p-4 md:p-6 flex-1">
              {produtosPopulares.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-[10px] uppercase tracking-widest">Nenhum produto cadastrado</div>
              ) : (
                <div className="space-y-5 md:space-y-6">
                  {produtosPopulares.map((produto, index) => (
                    <div key={produto.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3 md:gap-4 min-w-0">
                        <div className="relative shrink-0">
                          <img src={produto.fotos?.[0] || 'https://via.placeholder.com/100'} className="w-10 h-10 md:w-12 md:h-12 rounded object-cover border border-gray-700" />
                          <div className="absolute -top-2 -left-2 w-4 h-4 md:w-5 md:h-5 bg-hb-gold text-hb-black text-[9px] md:text-[10px] font-bold flex items-center justify-center rounded-full shadow-md">
                            {index + 1}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] md:text-xs font-bold text-gray-200 uppercase truncate group-hover:text-hb-gold transition-colors">{produto.nome}</p>
                          <p className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-widest">{produto.visitas || 0} visitas</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-[11px] md:text-xs font-black text-white">R$ {Number(produto.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-hb-gray rounded-2xl border border-gray-800 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 md:p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
              <h2 className="text-[11px] md:text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Clock size={16} className="text-hb-gold md:w-[18px] md:h-[18px]" /> Últimos Pedidos
              </h2>
              <button className="text-[9px] md:text-[10px] font-bold text-hb-gold uppercase tracking-widest flex items-center gap-1 hover:text-hb-goldLight transition-colors">
                Ver Todos <ArrowUpRight size={10} className="md:w-3 md:h-3" />
              </button>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-gray-900/30 border-b border-gray-800">
                    <th className="p-3 md:p-4 text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest">Pedido</th>
                    <th className="p-3 md:p-4 text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest">Cliente</th>
                    <th className="p-3 md:p-4 text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest">Data</th>
                    <th className="p-3 md:p-4 text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
                    <th className="p-3 md:p-4 text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {pedidos.slice(0, 7).map((pedido) => (
                    <tr key={pedido.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="p-3 md:p-4 text-[10px] md:text-xs font-bold text-white">#{String(pedido.id).split('-')[0]}</td>
                      <td className="p-3 md:p-4 text-[10px] md:text-xs text-gray-300 truncate max-w-[120px]">{pedido.cliente_email || 'Não informado'}</td>
                      <td className="p-3 md:p-4 text-[10px] md:text-xs text-gray-500">{new Date(pedido.created_at).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3 md:p-4">
                        <span className={`px-2 py-1 md:px-3 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest border ${getStatusColor(pedido.status)}`}>
                          {pedido.status}
                        </span>
                      </td>
                      <td className="p-3 md:p-4 text-[10px] md:text-xs font-black text-hb-gold text-right whitespace-nowrap">R$ {Number(pedido.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  {pedidos.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 md:p-8 text-center text-[10px] md:text-xs text-gray-500 uppercase tracking-widest">
                        Nenhum pedido recebido ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </main>
  )
}
