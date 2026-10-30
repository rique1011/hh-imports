'use client'

import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Ticket, Loader2, ArrowUpRight, ArrowDownRight, Wallet, Receipt } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function TelaFinanceiro() {
  const [pedidos, setPedidos] = useState<any[]>([])
  const [cupons, setCupons] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregarDadosFinanceiros()
  }, [])

  async function carregarDadosFinanceiros() {
    try {
      const [resPedidos, resCupons] = await Promise.all([
        // 🚨 AQUI ESTÁ A CORREÇÃO: Filtrando apenas os status que representam pagamentos aprovados
        supabase
          .from('pedidos')
          .select('*')
          .in('status', ['pago', 'enviado', 'entregue', 'confirmado'])
          .order('created_at', { ascending: false }),
        
        supabase
          .from('cupons')
          .select('*')
          .order('criado_em', { ascending: false })
      ])

      setPedidos(resPedidos.data || [])
      setCupons(resCupons.data || [])
    } catch (error) {
      console.error("Erro ao carregar dados financeiros:", error)
    } finally {
      setCarregando(false)
    }
  }

  const faturamentoBruto = pedidos.reduce((acc, curr) => acc + Number(curr.total || 0), 0)
  const totalReembolsos = cupons.reduce((acc, curr) => acc + Number(curr.valor_fixo || 0), 0)
  const faturamentoLiquido = faturamentoBruto - totalReembolsos
  const ticketMedio = pedidos.length > 0 ? faturamentoBruto / pedidos.length : 0

  return (
    <div className="text-gray-300 bg-hb-black min-h-screen">
      <header className="mb-10">
        <h1 className="text-3xl font-light text-white uppercase tracking-widest mb-2">Visão Financeira</h1>
        <p className="text-sm text-gray-400">Acompanhe seu faturamento real, ticket médio e reembolsos gerados.</p>
      </header>

      {carregando ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-hb-gold" size={32} /></div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500">
          
          {/* CARDS DE MÉTRICAS TOP */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="bg-hb-gray p-6 rounded-xl border border-gray-800 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 text-green-500"><TrendingUp size={64} /></div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Faturamento Bruto</p>
              <h3 className="text-2xl font-black text-white mb-2">
                R$ {faturamentoBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
              <div className="flex items-center gap-1 text-[10px] font-bold text-green-400 uppercase tracking-widest">
                <ArrowUpRight size={12} /> Entradas Confirmadas
              </div>
            </div>

            <div className="bg-hb-gray p-6 rounded-xl border border-gray-800 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 text-red-500"><TrendingDown size={64} /></div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Cupons / Trocas</p>
              <h3 className="text-2xl font-black text-white mb-2">
                R$ {totalReembolsos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
              <div className="flex items-center gap-1 text-[10px] font-bold text-red-400 uppercase tracking-widest">
                <ArrowDownRight size={12} /> Saídas / Bônus
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-xl shadow-lg border border-hb-gold/20 relative overflow-hidden text-white">
              <div className="absolute top-0 right-0 p-4 opacity-5 text-hb-gold"><Wallet size={64} /></div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Faturamento Líquido</p>
              <h3 className="text-2xl font-black text-hb-gold mb-2">
                R$ {faturamentoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
              <div className="flex items-center gap-1 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                Lucro Operacional
              </div>
            </div>

            <div className="bg-hb-gray p-6 rounded-xl border border-gray-800 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 text-blue-500"><Receipt size={64} /></div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Ticket Médio</p>
              <h3 className="text-2xl font-black text-white mb-2">
                R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
              <div className="flex items-center gap-1 text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                Por Compra
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LISTA DE ÚLTIMAS VENDAS */}
            <div className="bg-hb-gray border border-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Últimas Entradas (Pagas)</h3>
                <span className="text-[10px] font-black text-green-400 uppercase bg-green-900/30 border border-green-800 px-2 py-1 rounded">Entradas</span>
              </div>
              <div className="divide-y divide-gray-800">
                {pedidos.length === 0 ? (
                  <p className="p-6 text-center text-xs text-gray-500 uppercase tracking-widest">Nenhuma venda registrada.</p>
                ) : (
                  pedidos.slice(0, 5).map(pedido => (
                    <div key={pedido.id} className="p-4 flex justify-between items-center hover:bg-gray-800/40 transition">
                      <div>
                        <p className="text-xs font-bold text-gray-200">Pedido #{pedido.id}</p>
                        <p className="text-[10px] text-gray-500">{new Date(pedido.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <p className="text-xs font-black text-green-400">+ R$ {Number(pedido.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* LISTA DE CUPONS GERADOS */}
            <div className="bg-hb-gray border border-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Cupons de Troca Gerados</h3>
                <span className="text-[10px] font-black text-red-400 uppercase bg-red-900/20 border border-red-800 px-2 py-1 rounded">Saídas</span>
              </div>
              <div className="divide-y divide-gray-800">
                {cupons.length === 0 ? (
                  <p className="p-6 text-center text-xs text-gray-500 uppercase tracking-widest">Nenhum cupom gerado.</p>
                ) : (
                  cupons.slice(0, 5).map(cupom => (
                    <div key={cupom.id} className="p-4 flex justify-between items-center hover:bg-gray-800/40 transition">
                      <div className="flex items-center gap-3">
                        <div className="bg-hb-black border border-gray-700 p-2 rounded text-hb-gold"><Ticket size={16} /></div>
                        <div>
                          <p className="text-xs font-bold text-gray-200 uppercase">{cupom.codigo}</p>
                          <p className="text-[10px] text-gray-500">Cupom de Crédito</p>
                        </div>
                      </div>
                      <p className="text-xs font-black text-red-400">- R$ {Number(cupom.valor_fixo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
