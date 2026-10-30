'use client'

import { useState, useEffect } from 'react'
import { ShieldAlert, RefreshCcw, Search, Image as ImageIcon, Truck, Ticket, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function TelaDevolucoes() {
  const [solicitacoes, setSolicitacoes] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [rastreioInput, setRastreioInput] = useState<{ [key: string]: string }>({})
  const [enviandoEmailId, setEnviandoEmailId] = useState<string | null>(null) // Para o ícone de carregando do botão

  useEffect(() => {
    carregarTrocas()
  }, [])

  async function carregarTrocas() {
    try {
      // Puxamos a troca e cruzamos com a tabela de usuários para pegar nome e e-mail reais
      const { data, error } = await supabase
        .from('trocas')
        .select('*, usuarios(nome, email)')
        .order('criado_em', { ascending: false })

      if (error) throw error

      const trocasCompletas = (data || []).map(troca => ({
        ...troca,
        cliente: { 
          nome: troca.usuarios?.nome || 'Cliente H&H IMPORTS',
          email: troca.usuarios?.email || '',
          historico_trocas: 0 // (Opcional) Podemos cruzar dados reais depois
        },
        produto: { nome: 'Produto H&H IMPORTS', preco: 199.90 } // Preço genérico para a troca
      }))

      setSolicitacoes(trocasCompletas)
    } catch (error) {
      console.error("Erro ao carregar trocas:", error)
    } finally {
      setCarregando(false)
    }
  }

  const atualizarStatus = async (id: string, novoStatus: string) => {
    try {
      const { error } = await supabase.from('trocas').update({ status: novoStatus }).eq('id', id)
      if (error) throw error
      setSolicitacoes(solicitacoes.map(s => s.id === id ? { ...s, status: novoStatus } : s))
      alert(`Status atualizado para: ${novoStatus.toUpperCase()}`)
    } catch (error) {
      alert("Erro ao atualizar status.")
    }
  }

  // 🚨 NOVA FUNÇÃO DE RASTREIO QUE ENVIA O E-MAIL 🚨
  const salvarRastreioReverso = async (id: string, emailCliente: string, nomeCliente: string) => {
    const codigo = rastreioInput[id]
    if (!codigo || codigo.length < 5) {
      alert("Digite um código de rastreio válido (Ex: QQ123456789BR)")
      return
    }

    setEnviandoEmailId(id)

    try {
      // 1. Muda status no banco
      const { error } = await supabase.from('trocas').update({ status: 'aguardando_retorno' }).eq('id', id)
      if (error) throw error
      
      // 2. Dispara o E-mail Elegante
      if (emailCliente) {
        await fetch('/api/trocas/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailCliente, nome: nomeCliente, codigoRastreio: codigo })
        })
      }
      
      setSolicitacoes(solicitacoes.map(s => s.id === id ? { ...s, status: 'aguardando_retorno' } : s))
      alert(`Logística Reversa gerada! O código foi enviado para o e-mail do cliente.`)
    } catch (error) {
      alert("Erro ao salvar rastreio e notificar cliente.")
    } finally {
      setEnviandoEmailId(null)
    }
  }

  const gerarCupomReembolso = async (id: string, valorProduto: number) => {
    if (!confirm("Gerar cupom de crédito com 10% de bônus e encerrar a troca?")) return

    const valorComBonus = valorProduto * 1.10
    const codigoCupom = `TROCA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    try {
      const { error: erroCupom } = await supabase.from('cupons').insert([{
        codigo: codigoCupom,
        desconto: 0,
        valor_fixo: valorComBonus,
        ativo: true
      }])
      if (erroCupom) throw erroCupom

      const { error: erroTroca } = await supabase.from('trocas').update({ status: 'concluido' }).eq('id', id)
      if (erroTroca) throw erroTroca

      setSolicitacoes(solicitacoes.map(s => s.id === id ? { ...s, status: 'concluido' } : s))
      alert(`Cupom ${codigoCupom} no valor de R$ ${valorComBonus.toFixed(2)} gerado com sucesso!`)
      
    } catch (error) {
      alert("Erro ao gerar cupom.")
    }
  }

  return (
    <div className="text-gray-300 bg-hb-black min-h-screen">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-light text-white uppercase tracking-widest mb-2">Central de Trocas</h1>
          <p className="text-sm text-gray-400">Aprove devoluções, gere logística reversa e emita cupons de crédito.</p>
        </div>
        <div className="bg-hb-gray border border-gray-800 rounded-full px-4 py-2 flex items-center gap-2 shadow-sm w-full md:w-auto">
          <Search size={16} className="text-gray-500" />
          <input type="text" placeholder="Buscar pedido..." className="outline-none text-sm text-white bg-transparent w-full placeholder-gray-600" />
        </div>
      </header>

      {carregando ? (
        <div className="flex justify-center py-20"><RefreshCcw className="animate-spin text-hb-gold" /></div>
      ) : solicitacoes.length === 0 ? (
        <div className="bg-hb-gray p-12 rounded-2xl border border-gray-800 text-center shadow-sm">
          <p className="text-gray-400 uppercase tracking-widest text-sm font-bold">Nenhuma solicitação pendente.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {solicitacoes.map((solicitacao) => (
            <div key={solicitacao.id} className="bg-hb-gray p-6 rounded-xl border border-gray-800 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center">
              
              <div className="w-full md:w-1/4">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Cliente</p>
                <p className="text-sm font-bold text-white mb-2">{solicitacao.cliente.nome}</p>
                {solicitacao.cliente.historico_trocas >= 3 && (
                  <div className="inline-flex items-center gap-1 bg-red-950/40 text-red-400 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest border border-red-800/30">
                    <ShieldAlert size={12} /> Cliente Problemático ({solicitacao.cliente.historico_trocas} trocas)
                  </div>
                )}
              </div>

              <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Pedido / ID</p>
                <p className="text-xs text-white font-medium break-all">{solicitacao.pedido_id}</p>
                <div className="mt-3 inline-block bg-hb-black px-3 py-1 rounded-full border border-gray-800">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Motivo: {solicitacao.motivo}
                  </span>
                </div>
              </div>

              <div className="w-full md:w-auto flex justify-center">
                {solicitacao.foto_url ? (
                  <a href={solicitacao.foto_url} target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-2 cursor-pointer">
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-700 bg-hb-black relative flex items-center justify-center">
                      <img src={solicitacao.foto_url} alt="Item" className="w-full h-full object-cover group-hover:opacity-40 transition duration-300" />
                      <ImageIcon size={16} className="absolute m-auto text-hb-gold opacity-0 group-hover:opacity-100 transition" />
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-hb-gold group-hover:text-hb-goldLight">Ver Foto</span>
                  </a>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-hb-black border border-gray-800 flex items-center justify-center text-gray-600">
                    <span className="text-[9px] font-bold uppercase text-center px-1">Sem Foto</span>
                  </div>
                )}
              </div>

              <div className="w-full md:w-1/3 flex flex-col items-end gap-3 border-l border-gray-800 md:border-t-0 border-t md:pl-6 pt-4 md:pt-0">
                <span className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                  solicitacao.status === 'concluido' || solicitacao.status === 'aprovado_automatico' ? 'bg-green-900/30 text-green-400 border border-green-800/30' :
                  solicitacao.status === 'aguardando_retorno' ? 'bg-blue-900/30 text-blue-400 border border-blue-800/30' :
                  solicitacao.status === 'aprovado' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-800/30' :
                  solicitacao.status === 'recusado' ? 'bg-red-900/20 text-red-500 border border-red-800/30' :
                  'bg-neutral-800 text-gray-400'
                }`}>
                  {solicitacao.status.replace('_', ' ')}
                </span>

                {solicitacao.status === 'analise_pendente' && (
                  <div className="flex gap-2 w-full mt-2">
                    <button onClick={() => atualizarStatus(solicitacao.id, 'aprovado')} className="flex-1 bg-green-600 text-white text-xs py-2 rounded font-bold uppercase hover:bg-green-700 transition">Aprovar</button>
                    <button onClick={() => atualizarStatus(solicitacao.id, 'recusado')} className="flex-1 bg-red-600 text-white text-xs py-2 rounded font-bold uppercase hover:bg-red-700 transition">Recusar</button>
                  </div>
                )}

                {solicitacao.status === 'aprovado' && (
                   <div className="flex flex-col gap-2 w-full mt-2">
                     <input 
                       type="text" 
                       placeholder="Cód. Postagem (Ex: QQ123BR)" 
                       className="bg-hb-black border border-gray-700 rounded p-2 text-xs text-white w-full uppercase outline-none focus:border-hb-gold placeholder-gray-600"
                       value={rastreioInput[solicitacao.id] || ''}
                       onChange={(e) => setRastreioInput({...rastreioInput, [solicitacao.id]: e.target.value.toUpperCase()})}
                     />
                     <button 
                        onClick={() => salvarRastreioReverso(solicitacao.id, solicitacao.cliente.email, solicitacao.cliente.nome)} 
                        disabled={enviandoEmailId === solicitacao.id}
                        className="w-full bg-hb-black border border-gray-700 text-white text-[10px] py-2 rounded font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:border-hb-gold hover:text-hb-gold transition disabled:opacity-50"
                     >
                       {enviandoEmailId === solicitacao.id ? <Loader2 size={14} className="animate-spin text-hb-gold" /> : <Truck size={14} className="text-hb-gold" />} 
                       Enviar Reversa
                     </button>
                   </div>
                )}

                {solicitacao.status === 'aguardando_retorno' && (
                  <button onClick={() => gerarCupomReembolso(solicitacao.id, solicitacao.produto.preco)} className="w-full mt-2 bg-hb-gold text-hb-black text-[10px] py-3 rounded font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-hb-goldLight transition shadow-md">
                    <Ticket size={14} /> Gerar Cupom (+10%)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
