'use client'
import Modal from '@/components/Modal'
import EtiquetaMelhorEnvio from '@/components/admin/EtiquetaMelhorEnvio'
import EnvioAutomaticoConfig from '@/components/admin/EnvioAutomaticoConfig'
import type { ResultadoEtiqueta } from '@/types/envio'

import Image from 'next/image'
import type { Pedido, Usuario, Endereco } from '@/types/loja'
import { mensagemErro } from '@/lib/erros'
import { diaNaLoja } from '@/lib/prazo-devolucao'
import { useRecebimentoAutomatico } from '@/lib/use-recebimento-automatico'

import { useState, useEffect, useCallback } from 'react'
import { Search, Loader2, ShoppingBag, Eye, Truck, CheckCircle2, X, User, MapPin, Phone, FileText } from 'lucide-react'
import { supabaseAdmin as supabase } from '@/lib/admin-client'

export default function TelaPedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')

  const [modalAberta, setModalAberta] = useState(false)
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null)
  
  // 🚨 NOVOS ESTADOS PARA OS DADOS DO CLIENTE
  const [dadosCliente, setDadosCliente] = useState<(Usuario & { enderecoParsed: Endereco | null }) | null>(null)
  const [carregandoCliente, setCarregandoCliente] = useState(false)

  const [novoStatus, setNovoStatus] = useState('')
  const [novoRastreio, setNovoRastreio] = useState('')
  const [dataEntrega, setDataEntrega] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [gerandoEtiqueta, setGerandoEtiqueta] = useState(false)
  const etiquetaAtualizada = useCallback((resultado: ResultadoEtiqueta) => {
    const atualizar = (pedido: Pedido) => String(pedido.id) === resultado.pedidoId
      ? { ...pedido, codigo_rastreio: resultado.codigoRastreio, status: pedido.status === 'entregue' ? pedido.status : 'enviado' } : pedido
    setPedidos(atuais => atuais.map(atualizar))
    setPedidoSelecionado(atual => atual ? atualizar(atual) : atual)
    setNovoStatus('enviado'); setNovoRastreio(resultado.codigoRastreio || '')
  }, [])

  const carregarPedidos = useCallback(async () => {
    await Promise.resolve(supabase
      .from('pedidos')
      .select('*')
      .order('created_at', { ascending: false }))
      .then(({ data, error }) => {
        if (error) throw error
        setPedidos(data || [])
      })
      .catch(error => console.error('Erro ao carregar pedidos:', error))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => { void carregarPedidos() }, [carregarPedidos])
  useRecebimentoAutomatico(!carregando && pedidos.some(p => p.status === 'enviado'), carregarPedidos)

  // 🚨 ATUALIZADO: Agora ele busca os dados do cliente ao abrir a modal
  const abrirDetalhes = async (pedido: Pedido) => {
    setPedidoSelecionado(pedido)
    setNovoStatus(pedido.status || 'pendente')
    setNovoRastreio(pedido.codigo_rastreio || '')
    setDataEntrega(pedido.data_entrega || '')
    setDadosCliente(null)
    setModalAberta(true)
    setCarregandoCliente(true)

    if (pedido.cliente_email) {
      try {
        const { data: usuarioDb } = await supabase
          .from('usuarios')
          .select('*')
          .eq('email', pedido.cliente_email)
          .single()

        if (usuarioDb) {
          let enderecoParsed = null
          if (usuarioDb.endereco) {
            try { enderecoParsed = JSON.parse(usuarioDb.endereco) } 
            catch { enderecoParsed = { logradouro: usuarioDb.endereco } }
          }
          setDadosCliente({ ...usuarioDb, enderecoParsed: pedido.entrega || enderecoParsed })
        }
      } catch (error) {
        console.error("Erro ao buscar dados adicionais do cliente", error)
      }
    }
    setCarregandoCliente(false)
  }

  const handleSalvarAlteracoes = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pedidoSelecionado) return
    setSalvando(true)

    try {
      const { error } = await supabase
        .from('pedidos')
        .update({
          status: novoStatus,
          codigo_rastreio: novoRastreio || null,
          ...(novoStatus === 'entregue' ? { data_entrega: dataEntrega } : {})
        })
        .eq('id', pedidoSelecionado.id)

      if (error) throw error

      const notificacao = await fetch('/api/notificacoes/pedido', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId: pedidoSelecionado.id })
      })
      alert(notificacao.ok
        ? "Pedido atualizado. A notificacao foi registrada para envio."
        : "Pedido atualizado. A notificacao sera retomada pela fila automatica.")
      setModalAberta(false)
      carregarPedidos() 
    } catch (error) {
      alert("Erro ao atualizar pedido: " + mensagemErro(error))
    } finally {
      setSalvando(false)
    }
  }

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase() || ''
    if (s === 'entregue' || s === 'confirmado' || s === 'pago') return 'bg-green-900/30 text-green-400 border border-green-800'
    if (s === 'enviado') return 'bg-blue-900/30 text-blue-400 border border-blue-800'
    if (s === 'cancelado') return 'bg-red-900/20 text-red-500 border border-red-800/30'
    return 'bg-yellow-900/30 text-yellow-400 border border-yellow-800'
  }

  const pedidosFiltrados = pedidos.filter(p => 
    p.id.toString().includes(busca) || 
    (p.cliente_email && p.cliente_email.toLowerCase().includes(busca.toLowerCase()))
  )

  const formatarZapParaLink = (numero: string) => {
    if (!numero) return ''
    return numero.replace(/\D/g, '') // Remove tudo que não for número
  }

  return (
    <div className="text-gray-300 bg-hb-black min-h-screen">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl break-words font-light text-white uppercase tracking-widest mb-2">Pedidos Realizados</h1>
          <p className="text-sm text-gray-400">Gerencie as vendas, atualize status e insira códigos de rastreio.</p>
        </div>
        <div className="bg-hb-gray border border-gray-800 rounded-full px-4 py-2 flex items-center gap-2 shadow-sm w-full md:w-64">
          <Search size={16} className="text-gray-500" />
          <input 
            type="text" 
            placeholder="Buscar pedido ou email..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="outline-none text-sm text-white bg-transparent w-full placeholder-gray-600" 
          />
        </div>
      </header>

      <EnvioAutomaticoConfig onAbrirPedido={id => { const pedido = pedidos.find(item => String(item.id) === id); if (pedido) void abrirDetalhes(pedido) }} />

      {carregando ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-hb-gold" size={32} /></div>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="bg-hb-gray p-12 rounded-2xl border border-gray-800 text-center shadow-sm">
          <ShoppingBag size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400 uppercase tracking-widest text-sm font-bold mb-2">Nenhum pedido encontrado.</p>
          <p className="text-xs text-gray-500">Assim que você fizer a primeira venda, ela aparecerá aqui.</p>
        </div>
      ) : (
        <div className="bg-hb-gray border border-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-900/50 border-b border-gray-800 text-[10px] uppercase tracking-widest text-gray-500">
                  <th className="p-4 font-bold">Nº Pedido</th>
                  <th className="p-4 font-bold">Data</th>
                  <th className="p-4 font-bold">Cliente</th>
                  <th className="p-4 font-bold">Total</th>
                  <th className="p-4 font-bold">Status</th>
                  <th className="p-4 font-bold text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {pedidosFiltrados.map((pedido) => (
                  <tr key={pedido.id} className="hover:bg-gray-800/40 transition">
                    <td className="p-4 text-xs font-bold text-white">#{pedido.id}</td>
                    <td className="p-4 text-xs text-gray-400">
                      {new Date(pedido.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-4">
                      <p className="text-xs font-bold text-gray-200 truncate max-w-[150px]">{pedido.cliente_nome || 'Cliente não informado'}</p>
                      <p className="text-[10px] text-gray-500 truncate max-w-[150px]">{pedido.cliente_email || '-'}</p>
                    </td>
                    <td className="p-4 text-xs font-black text-hb-gold">
                      R$ {Number(pedido.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${getStatusColor(pedido.status)}`}>
                        {pedido.status || 'Pendente'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button onClick={() => abrirDetalhes(pedido)} className="p-2 text-gray-500 hover:text-hb-gold bg-hb-black border border-gray-800 rounded transition" title="Ver Detalhes">
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES DO PEDIDO (AGORA COM OS DADOS DO CLIENTE) */}
      {modalAberta && pedidoSelecionado && (
        <Modal onClose={() => setModalAberta(false)} labelledBy="titulo-pedido" className="bg-hb-gray border border-gray-800 rounded-2xl max-w-3xl p-0 shadow-2xl relative flex flex-col text-white">
            
            <div className="p-4 sm:p-6 shrink-0 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
              <div>
                <h2 id="titulo-pedido" className="text-lg font-light text-white uppercase tracking-widest flex items-center gap-2">
                  Pedido #{pedidoSelecionado.id}
                </h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                  {new Date(pedidoSelecionado.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <button onClick={() => setModalAberta(false)} aria-label="Fechar janela" className="min-w-11 min-h-11 grid place-items-center p-2 bg-hb-black rounded-full text-gray-400 hover:text-white border border-gray-700 shadow-sm transition"><X size={16} /></button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-8">
              
              {/* 🚨 NOVA SESSÃO: DADOS COMPLETOS DO CLIENTE */}
              {carregandoCliente ? (
                <div className="flex justify-center items-center py-6"><Loader2 className="animate-spin text-hb-gold" size={24} /></div>
              ) : dadosCliente ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-900/30 p-5 rounded-xl border border-gray-800">
                  <div>
                    <h3 className="text-[10px] font-black text-hb-gold uppercase tracking-widest mb-4 flex items-center gap-2"><User size={14}/> Contato do Cliente</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Nome Completo</p>
                        <p className="text-xs font-bold text-gray-200">{pedidoSelecionado.cliente_nome || dadosCliente.nome || 'Não informado'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">E-mail</p>
                        <p className="text-xs font-medium text-gray-400">{pedidoSelecionado.cliente_email}</p>
                      </div>
                      <div className="flex gap-4">
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-1"><Phone size={10}/> WhatsApp</p>
                          {dadosCliente.whatsapp ? (
                            <a 
                              href={`https://wa.me/55${formatarZapParaLink(dadosCliente.whatsapp)}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-xs font-bold text-green-400 hover:underline"
                            >
                              {dadosCliente.whatsapp}
                            </a>
                          ) : (
                            <p className="text-xs text-gray-600">-</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-1"><FileText size={10}/> Documento (CPF/CNPJ)</p>
                          <p className="text-xs font-medium text-gray-400">{dadosCliente.cpf_cnpj || '-'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t md:border-t-0 md:border-l border-gray-800 pt-4 md:pt-0 md:pl-6">
                    <h3 className="text-[10px] font-black text-hb-gold uppercase tracking-widest mb-4 flex items-center gap-2"><MapPin size={14}/> Endereço de Entrega</h3>
                    {dadosCliente.enderecoParsed ? (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-200">{dadosCliente.enderecoParsed.logradouro}, {dadosCliente.enderecoParsed.numero}</p>
                        <p className="text-xs text-gray-400">Bairro: {dadosCliente.enderecoParsed.bairro}</p>
                        <p className="text-xs text-gray-400">{dadosCliente.enderecoParsed.cidade} - {dadosCliente.enderecoParsed.uf}</p>
                        <p className="text-[10px] font-bold text-gray-500 mt-2">CEP: {dadosCliente.enderecoParsed.cep}</p>
                        {dadosCliente.enderecoParsed.complemento && (
                          <p className="text-[10px] text-yellow-500 mt-1">Ref: {dadosCliente.enderecoParsed.complemento}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic">Endereço não cadastrado.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-red-900/20 p-4 border border-red-900/30 rounded text-center">
                  <p className="text-xs text-red-400 font-bold uppercase tracking-widest">Os dados adicionais do cliente não foram encontrados.</p>
                </div>
              )}

              {/* Itens do Pedido */}
              <div>
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Itens Comprados</h3>
                <div className="space-y-4">
                  {pedidoSelecionado.itens && Array.isArray(pedidoSelecionado.itens) ? (
                    pedidoSelecionado.itens.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-4 border border-gray-800 p-3 rounded-lg bg-hb-black">
                        <Image width={48} height={48} sizes="48px" src={item.foto || '/icon.svg'} className="w-12 h-12 object-cover rounded border border-gray-700 bg-neutral-900" alt="Produto" />
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-200 uppercase">{item.nome}</p>
                          <p className="text-[10px] text-gray-500 font-medium mt-1">Quantidade: {item.quantidade || 1}</p>
                        </div>
                        <p className="text-xs font-black text-hb-gold">
                          R$ {Number(item.preco * (item.quantidade || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500 italic">Detalhes dos itens não encontrados.</p>
                  )}
                </div>
              </div>

              {/* Formulário de Atualização */}
              {['pago','confirmado','processando','enviado','entregue'].includes(pedidoSelecionado.status) && <EtiquetaMelhorEnvio
                key={pedidoSelecionado.id} pedidoId={String(pedidoSelecionado.id)} onAtualizado={etiquetaAtualizada} onOcupado={setGerandoEtiqueta} />}
              <form id="form-pedido" onSubmit={handleSalvarAlteracoes} className="bg-hb-black p-5 rounded-xl border border-gray-800 space-y-4">
                <h3 className="text-[10px] font-black text-hb-gold uppercase tracking-widest mb-4 flex items-center gap-2"><Truck size={14}/> Logística e Status</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="status-pedido" className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Status do Pedido</label>
                    <select id="status-pedido"
                      value={novoStatus} disabled={gerandoEtiqueta}
                      onChange={(e) => setNovoStatus(e.target.value)} 
                      className="w-full bg-gray-900 border border-gray-800 text-white p-3 rounded text-sm outline-none focus:border-hb-gold font-medium"
                    >
                      <option value="pendente" disabled>Pendente / Aguardando</option>
                      <option value="confirmado" disabled>Pagamento confirmado</option>
                      <option value="pago" disabled>Pago</option>
                      <option value="processando">Processando (Separando)</option>
                      <option value="enviado">Enviado (Em trânsito)</option>
                      <option value="entregue">Entregue</option>
                      <option value="cancelado" disabled>Cancelado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Código de Rastreio</label>
                    <input 
                      type="text" 
                      value={novoRastreio} disabled={gerandoEtiqueta}
                      onChange={(e) => setNovoRastreio(e.target.value.toUpperCase())} 
                      className="w-full bg-gray-900 border border-gray-800 text-white p-3 rounded text-sm outline-none focus:border-hb-gold uppercase placeholder-gray-600" 
                      placeholder="Ex: QQ123456789BR" 
                    />
                  </div>
                </div>
                {novoStatus === 'entregue' && <div>
                  <label htmlFor="data-recebimento" className="mb-2 block text-xs text-gray-300">Data real de recebimento pelo cliente</label>
                  <input id="data-recebimento" type="date" required max={diaNaLoja()} value={dataEntrega} disabled={gerandoEtiqueta} onChange={e => setDataEntrega(e.target.value)} className="w-full border border-gray-800 bg-gray-900 p-3 text-base text-white rounded" />
                  <p className="mt-2 text-xs leading-5 text-gray-400">Pedidos com etiqueta vinculada ao Melhor Envio recebem esta data automaticamente após a confirmação da transportadora. O prazo de 7 dias parte do recebimento real. Para pedidos antigos ou correções, confira a data antes de salvar.</p>
                </div>}
              </form>

            </div>

            <div className="p-6 border-t border-gray-800 bg-gray-900/50 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total do Pedido</p>
                <p className="text-xl font-black text-hb-gold">R$ {Number(pedidoSelecionado.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <button type="submit" form="form-pedido" disabled={salvando || gerandoEtiqueta} className="bg-hb-gold text-hb-black px-8 py-3 rounded font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-hb-goldLight transition disabled:opacity-50">
                {salvando ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Salvar Alterações</>}
              </button>
            </div>

        </Modal>
      )}
    </div>
  )
}
