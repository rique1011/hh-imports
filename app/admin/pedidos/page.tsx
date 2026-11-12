'use client'
import Modal from '@/components/Modal'
import EtiquetaMelhorEnvio from '@/components/admin/EtiquetaMelhorEnvio'
import RetiradaPedidoInfo from '@/components/RetiradaPedido'
import EnvioAutomaticoConfig from '@/components/admin/EnvioAutomaticoConfig'
import type { ResultadoEtiqueta } from '@/types/envio'

import Image from 'next/image'
import type { Pedido, Usuario, Endereco } from '@/types/loja'
import { mensagemErro } from '@/lib/erros'
import { diaNaLoja } from '@/lib/prazo-devolucao'
import { useRecebimentoAutomatico } from '@/lib/use-recebimento-automatico'
import { FILTROS_PEDIDOS_ADMIN, filtrarPedidosAdmin, grupoPedidoAdmin, type FiltroPedidosAdmin } from '@/lib/pedidos-admin'
import { nomePagamento } from '@/lib/pagamento-pedido'
import toast from 'react-hot-toast'

import { useState, useEffect, useCallback } from 'react'
import { Search, Loader2, ShoppingBag, Eye, Truck, CheckCircle2, X, User, MapPin, Phone, FileText, RefreshCw } from 'lucide-react'
import { supabaseAdmin as supabase } from '@/lib/admin-client'

export default function TelaPedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroPedidosAdmin>('a_enviar')
  const [erro, setErro] = useState('')

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
        setErro('')
      })
      .catch(() => setErro('Não foi possível carregar os pedidos. Atualize a lista para tentar novamente.'))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => { void carregarPedidos() }, [carregarPedidos])
  useRecebimentoAutomatico(!carregando && pedidos.some(p => p.status === 'enviado'), carregarPedidos)

  // 🚨 ATUALIZADO: Agora ele busca os dados do cliente ao abrir a modal
  const abrirDetalhes = async (pedido: Pedido) => {
    setPedidoSelecionado(pedido)
    setNovoStatus((pedido.status || 'pendente').trim().toLowerCase())
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
    if (!pedidoSelecionado || !podeOperarSelecionado) return
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
      toast.success(notificacao.ok
        ? "Pedido atualizado. A notificacao foi registrada para envio."
        : "Pedido atualizado. A notificacao sera retomada pela fila automatica.")
      setModalAberta(false)
      carregarPedidos() 
    } catch (error) {
      toast.error("Erro ao atualizar pedido: " + mensagemErro(error))
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

  const pedidosFiltrados = filtrarPedidosAdmin(pedidos, filtro, busca)
  const filtroAtual = FILTROS_PEDIDOS_ADMIN.find(f => f.id === filtro)!
  const podeOperarSelecionado = !!pedidoSelecionado && ['a_enviar', 'enviados', 'entregues'].includes(grupoPedidoAdmin(pedidoSelecionado))
  const quantidades: Record<FiltroPedidosAdmin, number> = { a_enviar: 0, retiradas: 0, enviados: 0, entregues: 0, aguardando: 0, revisao: 0, todos: pedidos.length }
  for (const pedido of pedidos) { const grupo = grupoPedidoAdmin(pedido); if (grupo !== 'historico') quantidades[grupo]++ }

  const formatarZapParaLink = (numero: string) => {
    if (!numero) return ''
    return numero.replace(/\D/g, '') // Remove tudo que não for número
  }

  return (
    <div className="text-gray-300 bg-hb-black min-h-screen">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl break-words font-light text-white uppercase tracking-widest mb-2">Pedidos</h1>
          <p className="text-sm text-gray-400">Comece pelos pedidos pagos que precisam ser preparados e enviados.</p>
        </div>
        <div className="bg-hb-gray border border-gray-800 rounded-full px-4 py-2 flex items-center gap-2 shadow-sm w-full md:w-64">
          <Search size={16} className="text-gray-500" />
          <input 
            type="search" aria-label="Buscar pedido, cliente ou e-mail"
            placeholder="Pedido, cliente ou e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="outline-none text-sm text-white bg-transparent w-full placeholder-gray-600" 
          />
        </div>
      </header>

      <EnvioAutomaticoConfig onAbrirPedido={id => { const pedido = pedidos.find(item => String(item.id) === id); if (pedido) void abrirDetalhes(pedido) }} />

      <nav aria-label="Filtrar pedidos" className="mb-5 flex flex-wrap gap-2">
        {FILTROS_PEDIDOS_ADMIN.map(f => <button key={f.id} type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-hb-gold ${filtro === f.id ? 'border-hb-gold bg-hb-gold/10 text-hb-goldLight' : 'border-gray-800 bg-hb-gray text-gray-400 hover:border-hb-gold/50 hover:text-white'}`}>
          {f.nome}<span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] tabular-nums">{carregando ? '…' : quantidades[f.id]}</span>
        </button>)}
      </nav>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-serif text-xl text-luxury-ivory">{filtroAtual.nome}</h2><p className="mt-2 max-w-2xl text-xs leading-6 text-gray-400">{filtroAtual.descricao}</p>
          {!carregando && !erro && <p role="status" className="mt-1 text-xs text-gray-500">{pedidosFiltrados.length} pedido(s){busca.trim() ? ' nesta busca' : ' nesta visão'}.</p>}</div>
        <button type="button" disabled={carregando} onClick={() => { setCarregando(true); void carregarPedidos() }} className="inline-flex min-h-11 items-center gap-2 text-xs text-hb-gold hover:text-hb-goldLight disabled:opacity-50"><RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />Atualizar pedidos</button>
      </div>

      {erro ? <p role="alert" className="rounded-xl border border-red-800 bg-red-950/20 p-5 text-sm text-red-200">{erro}</p> : carregando ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-hb-gold" size={32} /></div>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="bg-hb-gray p-12 rounded-2xl border border-gray-800 text-center shadow-sm">
          <ShoppingBag size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-300 uppercase tracking-widest text-sm font-bold mb-2">{busca.trim() ? 'Nenhum pedido corresponde à busca nesta visão.' : filtroAtual.vazio}</p>
          <p className="text-xs leading-6 text-gray-500">{busca.trim() ? 'Confira outro filtro ou limpe a busca.' : filtro === 'a_enviar' ? 'Novos pagamentos confirmados aparecerão aqui. Consulte pendentes e histórico nos filtros acima.' : filtroAtual.descricao}</p>
          {busca.trim() && <button type="button" onClick={() => setBusca('')} className="mt-4 min-h-11 text-xs text-hb-gold underline">Limpar busca</button>}
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
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${getStatusColor(grupoPedidoAdmin(pedido) === 'revisao' ? 'pagamento_em_analise' : pedido.status)}`}>
                        {grupoPedidoAdmin(pedido) === 'revisao' ? 'Revisão financeira' : pedido.status || 'Pendente'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button onClick={() => abrirDetalhes(pedido)} className="inline-flex min-h-11 min-w-11 items-center justify-center p-2 text-gray-500 hover:text-hb-gold bg-hb-black border border-gray-800 rounded transition" title="Ver Detalhes" aria-label={`Ver detalhes do pedido ${pedido.id}`}>
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
                          <p className="text-xs font-medium text-gray-400">{pedidoSelecionado.entrega?.documento || dadosCliente.cpf_cnpj || '-'}</p>
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
              <div className={`rounded-xl border p-4 text-sm leading-6 ${podeOperarSelecionado ? 'border-hb-gold/30 bg-hb-gold/5 text-gray-300' : 'border-amber-900 bg-amber-950/20 text-amber-200'}`}>
                <p className="font-medium">Pagamento: {nomePagamento(pedidoSelecionado)}</p>
                <p className="mt-1 text-xs">{pedidoSelecionado.retirada ? 'Retirada presencial. Use as ações abaixo para avisar o cliente e confirmar a entrega com o código.' : podeOperarSelecionado ? 'Pagamento confirmado. Confira os dados da entrega e acompanhe a etiqueta abaixo.' : grupoPedidoAdmin(pedidoSelecionado) === 'revisao' ? 'Confira a pendência financeira antes de preparar ou postar este pedido.' : 'Este pedido não está liberado para envio. A liberação depende da confirmação do pagamento.'}</p>
              </div>
              {pedidoSelecionado.retirada && <RetiradaPedidoInfo pedido={pedidoSelecionado} admin onAtualizado={async()=>{await carregarPedidos();setModalAberta(false)}}/>}
              {!pedidoSelecionado.retirada && podeOperarSelecionado && <EtiquetaMelhorEnvio
                key={pedidoSelecionado.id} pedidoId={String(pedidoSelecionado.id)} onAtualizado={etiquetaAtualizada} onOcupado={setGerandoEtiqueta} />}
              {!pedidoSelecionado.retirada && <form id="form-pedido" onSubmit={handleSalvarAlteracoes} className="bg-hb-black p-5 rounded-xl border border-gray-800 space-y-4">
                <h3 className="text-[10px] font-black text-hb-gold uppercase tracking-widest mb-4 flex items-center gap-2"><Truck size={14}/> Logística e Status</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="status-pedido" className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Status do Pedido</label>
                    <select id="status-pedido"
                      value={novoStatus} disabled={gerandoEtiqueta || !podeOperarSelecionado}
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
                      value={novoRastreio} disabled={gerandoEtiqueta || !podeOperarSelecionado}
                      onChange={(e) => setNovoRastreio(e.target.value.toUpperCase())} 
                      className="w-full bg-gray-900 border border-gray-800 text-white p-3 rounded text-sm outline-none focus:border-hb-gold uppercase placeholder-gray-600" 
                      placeholder="Ex: QQ123456789BR" 
                    />
                  </div>
                </div>
                {novoStatus === 'entregue' && <div>
                  <label htmlFor="data-recebimento" className="mb-2 block text-xs text-gray-300">Data real de recebimento pelo cliente</label>
                  <input id="data-recebimento" type="date" required max={diaNaLoja()} value={dataEntrega} disabled={gerandoEtiqueta || !podeOperarSelecionado} onChange={e => setDataEntrega(e.target.value)} className="w-full border border-gray-800 bg-gray-900 p-3 text-base text-white rounded" />
                  <p className="mt-2 text-xs leading-5 text-gray-400">Pedidos com etiqueta vinculada ao Melhor Envio recebem esta data automaticamente após a confirmação da transportadora. O prazo de 7 dias parte do recebimento real. Para pedidos antigos ou correções, confira a data antes de salvar.</p>
                </div>}
              </form>}

            </div>

            <div className="p-6 border-t border-gray-800 bg-gray-900/50 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total do Pedido</p>
                <p className="text-xl font-black text-hb-gold">R$ {Number(pedidoSelecionado.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              {!pedidoSelecionado.retirada && <button type="submit" form="form-pedido" disabled={salvando || gerandoEtiqueta || !podeOperarSelecionado} className="bg-hb-gold text-hb-black px-4 sm:px-8 py-3 rounded font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-hb-goldLight transition disabled:opacity-50">
                {salvando ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Salvar Alterações</>}
              </button>}
            </div>

        </Modal>
      )}
    </div>
  )
}
