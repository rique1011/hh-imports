'use client'
import Modal from '@/components/Modal'

import Image from 'next/image'

import { useSession, signOut } from 'next-auth/react' 
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link' 
import { 
  User, Package, Heart, Loader2, Lock, 
  ShoppingBag, Trash2, LogOut, RefreshCcw, X, Upload, 
  AlertCircle, CheckCircle2, Truck, DollarSign, Sparkles, MapPin, CreditCard, Receipt, Gift
} from 'lucide-react'
import { useCart } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { uploadImagem } from '@/lib/upload-imagem'
import type { Identificador, Pedido, ItemPedido } from '@/types/loja'
import { mensagemErro } from '@/lib/erros'

function ConteudoMinhaConta() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [abaAtiva, setAbaAtiva] = useState(() => searchParams.get('aba') || 'pedidos')
  
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [carregandoPedidos, setCarregandoPedidos] = useState(true)
  const { wishlist, toggleWishlist, adicionarAoCarrinho } = useCart(useShallow(state => ({ wishlist: state.wishlist, toggleWishlist: state.toggleWishlist, adicionarAoCarrinho: state.adicionarAoCarrinho })))
  
  const [form, setForm] = useState({ cpf_cnpj: '', whatsapp: '', data_nascimento: '' })
  const [endereco, setEndereco] = useState({ cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' })
  
  const [saldoCashback, setSaldoCashback] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false) 

  const [podeEditarCPF, setPodeEditarCPF] = useState(true)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  
  const [carregandoPagamentoId, setCarregandoPagamentoId] = useState<Identificador | null>(null)
  const [pedidoExpandido, setPedidoExpandido] = useState<Identificador | null>(null)

  const [modalAberta, setModalAberta] = useState(false)
  const [itemSelecionado, setItemSelecionado] = useState<ItemPedido | null>(null)
  const [pedidoIdSelecionado, setPedidoIdSelecionado] = useState<Identificador>('')
  const [motivo, setMotivo] = useState('arrependimento')
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null)
  const [carregandoTroca, setCarregandoTroca] = useState(false)
  const [mensagemSucesso, setMensagemSucesso] = useState('')
  const [erroTroca, setErroTroca] = useState('')

  const [mostrarErros] = useState(() => searchParams.get('alerta') === 'campos_vazios')

  // Novo estado para controlar itens que já tiveram troca solicitada na sessão atual
  const [itensComTrocaSolicitada, setItensComTrocaSolicitada] = useState<string[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      const controller = new AbortController()
      fetch('/api/usuario', { signal: controller.signal })
        .then(res => {
          if (!res.ok) throw new Error('Não foi possível carregar seu cadastro.')
          return res.json()
        })
        .then(data => {
          setForm({ 
            cpf_cnpj: data.cpf_cnpj || '', 
            whatsapp: data.whatsapp || '', 
            data_nascimento: data.data_nascimento || '' 
          })
          
          if (data && data.saldo_cashback) setSaldoCashback(Number(data.saldo_cashback))
          if (data.cpf_cnpj) setPodeEditarCPF(false)
          
          if (data && data.role === 'admin') {
            setIsAdmin(true)
          }
          
          if (data.endereco) {
            try { 
              const endParsed = JSON.parse(data.endereco)
              setEndereco(endParsed) 
            } catch {
              setEndereco(prev => ({ ...prev, logradouro: data.endereco })) 
            }
          }
        })
        .catch(error => { if (!controller.signal.aborted) console.error(error) })
        .finally(() => { if (!controller.signal.aborted) setCarregando(false) })

      fetch('/api/pedidos', { signal: controller.signal })
        .then(res => {
          if (!res.ok) throw new Error('Não foi possível carregar seus pedidos.')
          return res.json()
        })
        .then(data => {
          setPedidos(Array.isArray(data) ? data : [])
        })
        .catch(error => { if (!controller.signal.aborted) console.error(error) })
        .finally(() => { if (!controller.signal.aborted) setCarregandoPedidos(false) })
      return () => controller.abort()
    }
  }, [status, router])

  const buscarCep = async (valor: string) => {
    const cepLimpo = valor.replace(/\D/g, "")
    setEndereco(prev => ({ ...prev, cep: valor }))
    if (cepLimpo.length === 8) {
      setBuscandoCep(true)
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setEndereco(prev => ({ ...prev, logradouro: data.logradouro, bairro: data.bairro, cidade: data.localidade, uf: data.uf }))
        }
      } finally {
        setBuscandoCep(false)
      }
    }
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (mostrarErros) {
      if (!form.cpf_cnpj || !form.whatsapp || !endereco.cep || !endereco.logradouro || !endereco.numero || !endereco.bairro) {
        alert("Por favor, preencha todos os campos obrigatórios.")
        return
      }
    }

    setSalvando(true)
    try {
      const response = await fetch('/api/usuario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, endereco: JSON.stringify(endereco) }) })
      if (!response.ok) throw new Error('Não foi possível salvar seu cadastro.')
      if (form.cpf_cnpj) setPodeEditarCPF(false)
      
      alert("Perfil atualizado com sucesso!")
      
      if (mostrarErros) {
        router.push('/carrinho')
      }
      
    } catch {
      alert("Erro ao salvar dados.")
    } finally {
      setSalvando(false)
    }
  }

  const pagarPedidoPendente = async (pedidoId: Identificador) => {
    setCarregandoPagamentoId(pedidoId)
    try {
      const res = await fetch('/api/pedidos/pagar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pedidoId })
      })
      const dados = await res.json()
      if (!res.ok) throw new Error(dados.error || "Erro ao gerar link de pagamento")
      if (dados.urlPagamento) window.location.assign(dados.urlPagamento)
    } catch (error) {
      alert(mensagemErro(error, "Erro ao abrir o pagamento."))
    } finally {
      setCarregandoPagamentoId(null)
    }
  }

  const getStatusFormatado = (status: string) => {
    const s = status?.toLowerCase()
    if (s === 'pendente') return { titulo: 'AGUARDANDO PAGAMENTO', cor: 'text-yellow-500' }
    if (s === 'pago' || s === 'confirmado') return { titulo: 'PREPARANDO PEDIDO', cor: 'text-green-400' }
    if (s === 'enviado') return { titulo: 'PEDIDO ENVIADO', cor: 'text-blue-400' }
    if (s === 'entregue') return { titulo: 'PEDIDO ENTREGUE', cor: 'text-hb-gold' }
    return { titulo: status?.toUpperCase(), cor: 'text-gray-300' }
  }

  const getProgressoStepper = (status: string) => {
    const s = status?.toLowerCase()
    let nivel = 1
    if (s === 'pago' || s === 'confirmado') nivel = 3
    if (s === 'enviado') nivel = 4
    if (s === 'entregue') nivel = 5
    return nivel
  }

  const toggleDetalhes = (id: Identificador) => {
    setPedidoExpandido(prev => prev === id ? null : id)
  }

  const abrirModalTroca = (pedidoId: Identificador, item: ItemPedido) => {
    setPedidoIdSelecionado(pedidoId); setItemSelecionado(item); setMotivo('arrependimento');
    setFotoArquivo(null); setMensagemSucesso(''); setErroTroca(''); setModalAberta(true);
  }

  const enviarSolicitacaoTroca = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemSelecionado) return
    setCarregandoTroca(true); setErroTroca('')

    if (motivo === 'defeito' && !fotoArquivo) {
      setErroTroca('Para defeitos de fábrica, é obrigatório enviar uma foto.')
      setCarregandoTroca(false)
      return
    }

    try {
      let urlFoto = null
      if (fotoArquivo) {
        urlFoto = await uploadImagem(fotoArquivo, 'trocas')
      }

      // Adicionamos o ID do produto real aqui
      const response = await fetch('/api/trocas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pedidoId: pedidoIdSelecionado, 
          produtoId: itemSelecionado.id, 
          motivo, 
          // 👇 A MÁGICA AQUI: Se não tem foto do defeito, manda a foto do produto!
          fotoUrl: urlFoto || itemSelecionado.foto, 
          precoProduto: itemSelecionado.preco || 0 
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setMensagemSucesso(data.mensagem)
      
      // Adiciona o item à lista de itens com troca solicitada
      setItensComTrocaSolicitada(prev => [...prev, `${pedidoIdSelecionado}-${itemSelecionado.id}`])

      setTimeout(() => { setModalAberta(false); setMensagemSucesso(''); }, 5000)
    } catch (err) {
      setErroTroca(mensagemErro(err, 'Ocorreu um erro ao processar sua solicitação.'))
    } finally {
      setCarregandoTroca(false)
    }
  }

  if (status === 'loading' || carregando) return <div className="min-h-[70vh] bg-hb-black flex items-center justify-center"><Loader2 className="animate-spin text-hb-gold" size={32} /></div>

  return (
    <main className="min-h-screen bg-hb-black text-gray-300 pb-12 md:pb-20">
      
      {/* HEADER LUXO */}
      <div className="bg-gray-950 border-b border-gray-900 py-6 md:py-8 px-4 md:px-6 mb-6 md:mb-8">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-light text-white uppercase tracking-widest italic">Minha Conta</h1>
          <button onClick={() => signOut({ callbackUrl: '/' })} className="flex items-center gap-1 md:gap-2 text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-widest hover:text-red-400 transition">
            <LogOut size={14} className="md:w-4 md:h-4" /> <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-4 md:px-6 flex flex-col lg:flex-row gap-6 md:gap-12">
        
        {/* MENU LATERAL / SUPERIOR NO MOBILE */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <nav className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-col gap-2 lg:gap-1 lg:sticky lg:top-24">
            <button onClick={() => setAbaAtiva('pedidos')} className={`flex items-center justify-center lg:justify-start gap-2 px-4 py-3 md:py-4 text-xs font-bold uppercase tracking-wide transition border lg:border-0 lg:border-b border-gray-900 rounded-full lg:rounded-none min-w-0 min-h-12 whitespace-normal leading-relaxed ${abaAtiva === 'pedidos' ? 'text-hb-gold border-hb-gold lg:border-l-2 lg:border-l-hb-gold lg:border-t-0 lg:border-r-0 lg:border-b-gray-900 bg-hb-gold/10 lg:bg-gray-900/50' : 'text-gray-500 hover:text-white hover:bg-gray-900/30'}`}><Package size={14} className="md:w-4 md:h-4" /> Meus Pedidos</button>
            <button onClick={() => setAbaAtiva('dados')} className={`flex items-center justify-center lg:justify-start gap-2 px-4 py-3 md:py-4 text-xs font-bold uppercase tracking-wide transition border lg:border-0 lg:border-b border-gray-900 rounded-full lg:rounded-none min-w-0 min-h-12 whitespace-normal leading-relaxed ${abaAtiva === 'dados' ? 'text-hb-gold border-hb-gold lg:border-l-2 lg:border-l-hb-gold lg:border-t-0 lg:border-r-0 lg:border-b-gray-900 bg-hb-gold/10 lg:bg-gray-900/50' : 'text-gray-500 hover:text-white hover:bg-gray-900/30'}`}><User size={14} className="md:w-4 md:h-4" /> Meus Dados</button>
            <button onClick={() => setAbaAtiva('trocas')} className={`flex items-center justify-center lg:justify-start gap-2 px-4 py-3 md:py-4 text-xs font-bold uppercase tracking-wide transition border lg:border-0 lg:border-b border-gray-900 rounded-full lg:rounded-none min-w-0 min-h-12 whitespace-normal leading-relaxed ${abaAtiva === 'trocas' ? 'text-hb-gold border-hb-gold lg:border-l-2 lg:border-l-hb-gold lg:border-t-0 lg:border-r-0 lg:border-b-gray-900 bg-hb-gold/10 lg:bg-gray-900/50' : 'text-gray-500 hover:text-white hover:bg-gray-900/30'}`}><RefreshCcw size={14} className="md:w-4 md:h-4" /> Trocas e Devoluções</button>
            <button onClick={() => setAbaAtiva('desejos')} className={`flex items-center justify-center lg:justify-start gap-2 px-4 py-3 md:py-4 text-xs font-bold uppercase tracking-wide transition border lg:border-0 lg:border-b border-gray-900 rounded-full lg:rounded-none min-w-0 min-h-12 whitespace-normal leading-relaxed ${abaAtiva === 'desejos' ? 'text-hb-gold border-hb-gold lg:border-l-2 lg:border-l-hb-gold lg:border-t-0 lg:border-r-0 lg:border-b-gray-900 bg-hb-gold/10 lg:bg-gray-900/50' : 'text-gray-500 hover:text-white hover:bg-gray-900/30'}`}><Heart size={14} className="md:w-4 md:h-4" /> Desejos</button>
            
            {isAdmin && (
              <Link 
                href="/admin" 
                className="flex items-center justify-center lg:justify-start gap-2 px-4 py-3 md:py-4 text-xs font-black uppercase tracking-wide text-black bg-hb-gold hover:bg-yellow-600 transition-all lg:mt-6 rounded-full lg:rounded min-w-0 min-h-12 whitespace-normal leading-relaxed"
              >
                <Lock size={14} className="md:w-4 md:h-4" /> <span className="hidden lg:inline">Painel Admin</span><span className="lg:hidden">Admin</span>
              </Link>
            )}
          </nav>
        </aside>

        {/* CONTEÚDO */}
        <section className="flex-1 min-w-0">
          
          {/* ABA: DADOS PESSOAIS */}
          {abaAtiva === 'dados' && (
            <div className="space-y-8 md:space-y-10 animate-in fade-in duration-500">
              
              {mostrarErros && (
                <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-lg flex items-start md:items-center gap-3 shadow-md animate-bounce">
                  <AlertCircle size={20} className="shrink-0 mt-0.5 md:mt-0" />
                  <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest leading-relaxed">Atenção: Preencha os campos em vermelho para finalizar sua compra.</p>
                </div>
              )}

              <div className="bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white rounded-xl p-6 md:p-8 shadow-2xl border border-gray-800 relative overflow-hidden group">
                <div className="absolute -right-10 -bottom-10 bg-hb-gold/10 w-32 h-32 md:w-40 md:h-40 rounded-full group-hover:scale-110 transition-transform duration-700"></div>
                <div className="flex justify-between items-start relative z-10">
                  <div className="space-y-1">
                    <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-hb-gold flex items-center gap-1"><Sparkles size={10} className="md:w-3 md:h-3" /> Cliente VIP H&H IMPORTS</p>
                    <h3 className="text-lg md:text-xl font-light tracking-wide text-gray-200">Créditos</h3>
                  </div>
                  <div className="p-2 md:p-3 bg-hb-gold/10 text-hb-gold rounded-full"><DollarSign size={16} className="md:w-5 md:h-5" /></div>
                </div>
                <div className="mt-6 md:mt-8 relative z-10">
                  <p className="text-2xl md:text-3xl font-black tracking-tight text-white">R$ {saldoCashback.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p className="text-[9px] md:text-[10px] text-gray-400 uppercase tracking-wider mt-2 leading-relaxed">
                    {saldoCashback > 0 ? '✨ Seus créditos estão disponíveis para sua próxima joia!' : 'Compre joias e acumule 5% de volta para a próxima compra.'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSalvar} className="space-y-8 md:space-y-10">
                <div>
                  <h2 className="text-[11px] md:text-xs font-bold text-white mb-5 md:mb-6 uppercase tracking-[0.2em] border-b border-gray-800 pb-3 md:pb-4">Dados Pessoais</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-gray-400 mb-2 uppercase">Nome Completo</label>
                      <input value={session?.user?.name || ''} disabled className="w-full border border-gray-800 p-3 rounded bg-gray-900/50 text-gray-500 text-base md:text-sm" />
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-gray-400 mb-2 uppercase">E-mail</label>
                      <input value={session?.user?.email || ''} disabled className="w-full border border-gray-800 p-3 rounded bg-gray-900/50 text-gray-500 text-base md:text-sm" />
                    </div>
                    
                    <div>
                      <label className="text-[9px] md:text-[10px] font-bold text-gray-400 mb-2 uppercase flex justify-between">
                        <span>CPF / CNPJ {!podeEditarCPF && <Lock size={10} className="inline md:w-3 md:h-3 ml-1"/>}</span>
                        {mostrarErros && !form.cpf_cnpj && <span className="text-red-500">* Obrigatório</span>}
                      </label>
                      <input 
                        inputMode="numeric" autoComplete="off" aria-label="CPF ou CNPJ" value={form.cpf_cnpj}
                        onChange={(e) => setForm({...form, cpf_cnpj: e.target.value})} 
                        disabled={!podeEditarCPF} 
                        className={`w-full border p-3 rounded text-base md:text-sm bg-transparent text-white focus:outline-none focus:border-hb-gold transition-colors ${!podeEditarCPF ? 'bg-gray-900/50 text-gray-500 border-gray-800' : (mostrarErros && !form.cpf_cnpj ? 'border-red-500 bg-red-900/10' : 'border-gray-700')}`} 
                      />
                    </div>
                    
                    <div>
                      <label className="text-[9px] md:text-[10px] font-bold text-gray-400 mb-2 uppercase flex justify-between">
                        <span>WhatsApp</span>
                        {mostrarErros && !form.whatsapp && <span className="text-red-500">* Obrigatório</span>}
                      </label>
                      <input 
                        type="tel" inputMode="tel" autoComplete="tel" aria-label="WhatsApp" value={form.whatsapp}
                        onChange={(e) => setForm({...form, whatsapp: e.target.value})} 
                        className={`w-full border p-3 rounded text-base md:text-sm bg-transparent text-white focus:outline-none focus:border-hb-gold transition-colors ${mostrarErros && !form.whatsapp ? 'border-red-500 bg-red-900/10' : 'border-gray-700'}`} 
                        placeholder="(00) 00000-0000" 
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-[11px] md:text-xs font-bold text-white mb-5 md:mb-6 uppercase tracking-[0.2em] border-b border-gray-800 pb-3 md:pb-4">Endereço de Entrega</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                    
                    <div className="relative">
                      <label className="text-[9px] md:text-[10px] font-bold text-gray-400 mb-2 uppercase flex justify-between">
                        <span>CEP</span>
                        {mostrarErros && !endereco.cep && <span className="text-red-500">* Obrigatório</span>}
                      </label>
                      <input 
                        inputMode="numeric" autoComplete="postal-code" aria-label="CEP" value={endereco.cep}
                        onChange={(e) => buscarCep(e.target.value)} 
                        className={`w-full border p-3 rounded text-base md:text-sm bg-transparent text-white focus:outline-none focus:border-hb-gold transition-colors ${mostrarErros && !endereco.cep ? 'border-red-500 bg-red-900/10' : 'border-gray-700'}`} 
                        placeholder="00000-000" 
                      />
                      {buscandoCep && <Loader2 size={16} className="absolute right-3 top-9 animate-spin text-hb-gold" />}
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="text-[9px] md:text-[10px] font-bold text-gray-400 mb-2 uppercase flex justify-between">
                        <span>Rua</span>
                        {mostrarErros && !endereco.logradouro && <span className="text-red-500">* Obrigatório</span>}
                      </label>
                      <input 
                        value={endereco.logradouro} 
                        onChange={(e) => setEndereco({...endereco, logradouro: e.target.value})} 
                        className={`w-full border p-3 rounded text-base md:text-sm bg-transparent text-white focus:outline-none focus:border-hb-gold transition-colors ${mostrarErros && !endereco.logradouro ? 'border-red-500 bg-red-900/10' : 'border-gray-700'}`} 
                      />
                    </div>
                    
                    <div>
                      <label className="text-[9px] md:text-[10px] font-bold text-gray-400 mb-2 uppercase flex justify-between">
                        <span>Número</span>
                        {mostrarErros && !endereco.numero && <span className="text-red-500">* Obrigatório</span>}
                      </label>
                      <input 
                        inputMode="numeric" autoComplete="address-line2" value={endereco.numero}
                        onChange={(e) => setEndereco({...endereco, numero: e.target.value})} 
                        className={`w-full border p-3 rounded text-base md:text-sm bg-transparent text-white focus:outline-none focus:border-hb-gold transition-colors ${mostrarErros && !endereco.numero ? 'border-red-500 bg-red-900/10' : 'border-gray-700'}`} 
                      />
                    </div>
                    
                    <div>
                      <label className="text-[9px] md:text-[10px] font-bold text-gray-400 mb-2 uppercase flex justify-between">
                        <span>Bairro</span>
                        {mostrarErros && !endereco.bairro && <span className="text-red-500">* Obrigatório</span>}
                      </label>
                      <input 
                        value={endereco.bairro} 
                        onChange={(e) => setEndereco({...endereco, bairro: e.target.value})} 
                        className={`w-full border p-3 rounded text-base md:text-sm bg-transparent text-white focus:outline-none focus:border-hb-gold transition-colors ${mostrarErros && !endereco.bairro ? 'border-red-500 bg-red-900/10' : 'border-gray-700'}`} 
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-bold text-gray-400 mb-2 uppercase">Cidade / UF</label>
                      <input 
                        value={`${endereco.cidade} - ${endereco.uf}`} 
                        disabled 
                        className={`w-full border p-3 rounded bg-gray-900/50 text-gray-500 text-base md:text-sm ${mostrarErros && (!endereco.cidade || !endereco.uf) ? 'border-red-500 border-dashed' : 'border-gray-800'}`} 
                      />
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={salvando} className="w-full md:w-auto bg-hb-gold text-black px-8 md:px-12 py-4 font-bold uppercase tracking-widest text-[10px] md:text-xs hover:bg-yellow-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                  {salvando ? <><Loader2 size={16} className="animate-spin"/> Salvando...</> : 'Salvar e Voltar Para Sacola'}
                </button>
              </form>
            </div>
          )}

          {/* ABA: MEUS PEDIDOS */}
          {abaAtiva === 'pedidos' && (
            <div className="animate-in fade-in duration-500">
              <h2 className="text-[11px] md:text-xs font-bold text-white mb-6 md:mb-8 uppercase tracking-[0.2em] border-b border-gray-800 pb-3 md:pb-4">Histórico de Compras</h2>
              
              {carregandoPedidos ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-500" size={32} /></div>
              ) : pedidos.length === 0 ? (
                <div className="text-center py-12 text-gray-500 uppercase text-[10px] font-bold tracking-widest">Nenhum pedido encontrado.</div>
              ) : (
                <div className="space-y-6 md:space-y-8">
                  {pedidos.map((pedido) => {
                    const statusInfo = getStatusFormatado(pedido.status)
                    const expandido = pedidoExpandido === pedido.id

                    return (
                      <div key={pedido.id} className="border border-gray-800 rounded-xl overflow-hidden shadow-sm">
                        
                        {/* CABEÇALHO DO PEDIDO */}
                        <div className="bg-gray-900/40 p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800">
                          <div className="flex w-full md:w-auto justify-between md:justify-start gap-4 md:gap-12">
                            <div>
                              <p className="text-[9px] md:text-[10px] text-gray-500 font-medium mb-1 uppercase">Data do pedido</p>
                              <p className="text-xs md:text-sm font-medium text-white">{new Date(pedido.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                            </div>
                            <div className="text-right md:text-left">
                              <p className="text-[9px] md:text-[10px] text-gray-500 font-medium mb-1 uppercase">Total</p>
                              <p className="text-xs md:text-sm font-medium text-white">R$ {Number(pedido.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                          </div>
                          <div className="w-full md:w-auto flex justify-between md:flex-col items-center md:items-end mt-2 md:mt-0 pt-3 md:pt-0 border-t border-gray-800 md:border-0">
                            <p className="text-[9px] md:text-[10px] text-gray-500 font-medium md:mb-1 uppercase tracking-widest"># {String(pedido.id).split('-')[0]}</p>
                            <p className={`text-[10px] md:text-xs font-black uppercase tracking-widest ${statusInfo.cor}`}>{statusInfo.titulo}</p>
                          </div>
                        </div>
                        
                        {/* CORPO DO PEDIDO */}
                        <div className="p-4 md:p-6 bg-hb-black">
                          {pedido.itens?.map((item, idx) => (
                            <div key={idx} className="flex flex-col sm:flex-row gap-4 md:gap-6 border-b border-gray-800 pb-5 md:pb-6 mb-5 md:mb-6 last:border-0 last:pb-0 last:mb-0">
                              <Image width={96} height={96} sizes="96px" alt={item.nome} src={item.foto || '/icon.svg'} className="w-20 h-20 md:w-24 md:h-24 object-cover border border-gray-800 rounded shrink-0" />
                              <div className="flex-1">
                                <h3 className="text-xs md:text-sm font-medium text-white uppercase tracking-wide leading-relaxed line-clamp-2">{item.nome}</h3>
                                <p className="text-[10px] md:text-xs text-gray-400 mt-1 md:mt-2">{item.quantidade} un - R$ {Number(item.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-hb-gold mt-2 md:mt-3 flex items-center gap-1"><Gift size={10} className="md:w-3 md:h-3" /> Joia Exclusiva</p>
                              </div>
                              <div className="w-full sm:w-40 md:w-48 shrink-0 flex flex-col gap-2 md:gap-3 mt-2 sm:mt-0">
                                <button 
                                  onClick={() => adicionarAoCarrinho(item)} 
                                  className="w-full border border-hb-gold text-hb-gold text-[9px] font-black uppercase tracking-widest py-3 rounded hover:bg-hb-gold hover:text-black transition"
                                >
                                  Comprar Novamente
                                </button>
                                
                                {pedido.status?.toLowerCase() === 'pendente' && (
                                  <button 
                                    onClick={() => pagarPedidoPendente(pedido.id)}
                                    disabled={carregandoPagamentoId === pedido.id}
                                    className="w-full bg-hb-gold text-black text-[9px] font-black uppercase tracking-widest py-3 rounded hover:bg-yellow-600 transition flex justify-center items-center gap-2"
                                  >
                                    {carregandoPagamentoId === pedido.id ? <Loader2 size={12} className="animate-spin" /> : 'Pagar Agora'}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}

                          <div className="pt-2 md:pt-4 flex justify-end">
                            <button 
                              onClick={() => toggleDetalhes(pedido.id)} 
                              className="w-full md:w-56 bg-gray-800 text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest py-3 md:py-4 rounded hover:bg-gray-700 transition shadow-sm"
                            >
                              {expandido ? 'Ocultar Detalhes' : 'Ver Detalhes do Pedido'}
                            </button>
                          </div>
                        </div>

                        {/* DETALHES EXPANSÍVEIS (Rastreio) */}
                        {expandido && (
                          <div className="bg-gray-900/50 p-4 md:p-8 border-t border-gray-800 animate-in slide-in-from-top-2">
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 border-b border-gray-800 pb-6 md:pb-8 mb-6 md:mb-8">
                              <div>
                                <h4 className="text-[11px] md:text-sm font-light text-white uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-2"><MapPin size={14} className="text-gray-500 md:w-4 md:h-4" /> Endereço</h4>
                                <p className="text-[10px] md:text-xs text-white font-bold mb-1">{endereco.logradouro || 'Endereço cadastrado'}</p>
                                <p className="text-[10px] md:text-xs text-gray-400 leading-relaxed">
                                  {endereco.numero && `Número: ${endereco.numero}`} <br/>
                                  {endereco.bairro && `Bairro: ${endereco.bairro}`} <br/>
                                  {endereco.cidade && `${endereco.cidade} - ${endereco.uf}`} <br/>
                                  {endereco.cep}
                                </p>
                              </div>
                              <div>
                                <h4 className="text-[11px] md:text-sm font-light text-white uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-2"><CreditCard size={14} className="text-gray-500 md:w-4 md:h-4" /> Pagamento</h4>
                                <p className="text-[10px] md:text-xs text-gray-400 flex items-center gap-2">
                                  <span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded text-[9px] md:text-[10px] font-bold border border-blue-800">Mercado Pago</span>
                                </p>
                              </div>
                              <div className="sm:col-span-2 md:col-span-1">
                                <h4 className="text-[11px] md:text-sm font-light text-white uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-2"><Receipt size={14} className="text-gray-500 md:w-4 md:h-4" /> Resumo</h4>
                                <div className="space-y-2 text-[10px] md:text-xs text-gray-400">
                                  <div className="flex justify-between"><span>Subtotal</span><span>R$ {Number(pedido.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                                  <div className="flex justify-between font-bold text-white pt-2 mt-2 border-t border-gray-800"><span>Total</span><span className="text-hb-gold">R$ {Number(pedido.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                                </div>
                              </div>
                            </div>

                            {/* LINHA DO TEMPO (STEPPER) */}
                            <div>
                              <h4 className="text-[11px] md:text-sm font-light text-white uppercase tracking-widest mb-6 md:mb-8 text-center md:text-left">Status do Pedido</h4>
                              
                              <div className="overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                                <div className="min-w-[500px] md:min-w-full relative flex justify-between items-center max-w-2xl mx-auto">
                                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-gray-800 z-0"></div>
                                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-hb-gold z-0 transition-all duration-1000" style={{ width: `${(getProgressoStepper(pedido.status) - 1) * 25}%` }}></div>
                                  
                                  {/* Passo 1 */}
                                  <div className="relative z-10 flex flex-col items-center gap-2 md:gap-3">
                                    <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center border-2 bg-hb-black ${getProgressoStepper(pedido.status) >= 1 ? 'border-hb-gold text-hb-gold' : 'border-gray-700 text-gray-700'}`}><CheckCircle2 size={12} className="md:w-4 md:h-4" /></div>
                                    <span className={`text-[8px] md:text-[9px] uppercase font-bold tracking-widest text-center w-16 md:w-20 ${getProgressoStepper(pedido.status) >= 1 ? 'text-white' : 'text-gray-600'}`}>Realizado</span>
                                  </div>
                                  {/* Passo 2 */}
                                  <div className="relative z-10 flex flex-col items-center gap-2 md:gap-3">
                                    <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center border-2 bg-hb-black ${getProgressoStepper(pedido.status) >= 3 ? 'border-hb-gold text-hb-gold' : 'border-gray-700 text-gray-700'}`}><CheckCircle2 size={12} className="md:w-4 md:h-4" /></div>
                                    <span className={`text-[8px] md:text-[9px] uppercase font-bold tracking-widest text-center w-16 md:w-20 ${getProgressoStepper(pedido.status) >= 3 ? 'text-white' : 'text-gray-600'}`}>Aprovado</span>
                                  </div>
                                  {/* Passo 3 */}
                                  <div className="relative z-10 flex flex-col items-center gap-2 md:gap-3">
                                    <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center border-2 bg-hb-black ${getProgressoStepper(pedido.status) >= 3 ? 'border-hb-gold text-hb-gold' : 'border-gray-700 text-gray-700'}`}><Package size={12} className="md:w-4 md:h-4" /></div>
                                    <span className={`text-[8px] md:text-[9px] uppercase font-bold tracking-widest text-center w-16 md:w-20 ${getProgressoStepper(pedido.status) >= 3 ? 'text-white' : 'text-gray-600'}`}>Preparando</span>
                                  </div>
                                  {/* Passo 4 */}
                                  <div className="relative z-10 flex flex-col items-center gap-2 md:gap-3">
                                    <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center border-2 bg-hb-black ${getProgressoStepper(pedido.status) >= 4 ? 'border-hb-gold text-hb-gold' : 'border-gray-700 text-gray-700'}`}><Truck size={12} className="md:w-4 md:h-4" /></div>
                                    <span className={`text-[8px] md:text-[9px] uppercase font-bold tracking-widest text-center w-16 md:w-20 ${getProgressoStepper(pedido.status) >= 4 ? 'text-white' : 'text-gray-600'}`}>Enviado</span>
                                  </div>
                                  {/* Passo 5 */}
                                  <div className="relative z-10 flex flex-col items-center gap-2 md:gap-3">
                                    <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center border-2 bg-hb-black ${getProgressoStepper(pedido.status) >= 5 ? 'border-hb-gold text-hb-gold' : 'border-gray-700 text-gray-700'}`}><MapPin size={12} className="md:w-4 md:h-4" /></div>
                                    <span className={`text-[8px] md:text-[9px] uppercase font-bold tracking-widest text-center w-16 md:w-20 ${getProgressoStepper(pedido.status) >= 5 ? 'text-white' : 'text-gray-600'}`}>Entregue</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ABA: TROCAS E DEVOLUÇÕES */}
          {abaAtiva === 'trocas' && (
            <div className="animate-in fade-in duration-500">
              <h2 className="text-[11px] md:text-xs font-bold text-white mb-6 md:mb-8 uppercase tracking-[0.2em] border-b border-gray-800 pb-3 md:pb-4">Troca ou Devolução</h2>
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 md:p-6 mb-6 md:mb-8">
                <p className="text-[10px] md:text-xs text-gray-400 leading-relaxed text-center md:text-left">
                  Você pode solicitar a troca de itens <span className="font-bold text-white">Entregues</span> em até 7 dias corridos após o recebimento (Arrependimento) ou para defeitos de fábrica.
                </p>
              </div>
              
              {carregandoPedidos ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-500" size={32} /></div>
              ) : pedidos.filter(p => p.status?.toLowerCase() === 'entregue').length === 0 ? (
                <div className="text-center py-12 text-gray-500 uppercase text-[10px] font-bold tracking-widest">Nenhum pedido entregue disponível para troca.</div>
              ) : (
                <div className="space-y-4 md:space-y-6">
                  {pedidos.filter(p => p.status?.toLowerCase() === 'entregue').map((pedido) => (
                    <div key={`troca-${pedido.id}`} className="border border-gray-800 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-gray-900/80 p-3 md:p-4 flex justify-between items-center">
                        <div>
                          <p className="text-[8px] md:text-[9px] text-gray-500 uppercase font-black tracking-widest">Pedido Entregue</p>
                          <p className="text-[10px] md:text-xs font-bold text-white">#{pedido.id}</p>
                        </div>
                      </div>
                      <div className="p-4 md:p-5">
                        <div className="space-y-4">
                          {pedido.itens?.map((item, idx) => {
                            // 🚨 NOVA TRAVA VISUAL: Verifica se a troca já foi solicitada
                            const jaSolicitouTroca = item.troca_solicitada || itensComTrocaSolicitada.includes(`${pedido.id}-${item.id}`)

                            return (
                              <div key={`troca-item-${idx}`} className="flex items-center gap-3 md:gap-4 border-b border-gray-800 pb-4 last:border-0 last:pb-0">
                                <Image width={96} height={96} sizes="96px" alt={item.nome} src={item.foto || '/icon.svg'} className="w-10 h-10 md:w-12 md:h-12 object-cover rounded border border-gray-800 shrink-0" />
                                <div className="flex-1 min-w-0"><p className="text-[10px] md:text-xs font-bold text-gray-200 uppercase tracking-tight truncate">{item.nome}</p></div>
                                
                                {jaSolicitouTroca ? (
                                  <span className="text-[8px] md:text-[9px] font-bold uppercase border border-gray-600 bg-transparent text-gray-500 px-3 md:px-4 py-2 rounded flex items-center justify-center gap-1 shrink-0 cursor-not-allowed">
                                    Solicitada
                                  </span>
                                ) : (
                                  <button onClick={() => abrirModalTroca(pedido.id, item)} className="text-[8px] md:text-[9px] font-bold uppercase border border-hb-gold bg-transparent text-hb-gold px-3 md:px-4 py-2 rounded hover:bg-hb-gold hover:text-black transition flex items-center justify-center gap-1 shrink-0">
                                    <RefreshCcw size={10} className="md:w-3 md:h-3" /> Solicitar
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ABA: DESEJOS */}
          {abaAtiva === 'desejos' && (
            <div className="animate-in fade-in duration-500">
              <h2 className="text-[11px] md:text-xs font-bold text-white mb-6 md:mb-8 uppercase tracking-[0.2em] border-b border-gray-800 pb-3 md:pb-4">Lista de Desejos</h2>
              {wishlist.length === 0 ? (
                <div className="text-center py-12"><Heart size={40} className="mx-auto text-gray-800 mb-4 md:w-12 md:h-12" /><p className="text-gray-500 uppercase text-[10px] font-bold tracking-widest">Sua lista está vazia.</p></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  {wishlist.map((item) => (
                    <div key={item.id} className="flex gap-3 md:gap-4 p-3 md:p-4 border border-gray-800 rounded-xl hover:border-gray-700 transition">
                      <Image width={96} height={96} sizes="96px" alt={item.nome} src={item.foto || '/icon.svg'} className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg border border-gray-800 shrink-0" />
                      <div className="flex flex-col justify-between flex-1 min-w-0">
                        <div>
                          <h3 className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-white truncate">{item.nome}</h3>
                          <p className="text-xs md:text-sm font-black text-gray-300 mt-1">R$ {item.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => adicionarAoCarrinho(item)} className="flex-1 bg-hb-gold text-black text-[8px] md:text-[9px] font-black py-2 rounded uppercase flex items-center justify-center gap-1 hover:bg-yellow-600 transition"><ShoppingBag size={10} className="md:w-3 md:h-3" /> Comprar</button>
                          <button onClick={() => toggleWishlist(item)} className="px-3 py-2 border border-gray-700 rounded text-gray-400 hover:text-red-500 hover:border-red-500 transition"><Trash2 size={12} className="md:w-4 md:h-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* --- MODAL DE TROCA --- */}
      {modalAberta && (
        <Modal onClose={() => setModalAberta(false)} labelledBy="titulo-troca" className="bg-gray-950 border border-gray-800 rounded-2xl max-w-md p-5 sm:p-8 shadow-2xl relative">
            <button onClick={() => setModalAberta(false)} aria-label="Fechar janela" className="absolute top-3 right-3 min-w-11 min-h-11 grid place-items-center text-gray-400 hover:text-white transition"><X size={20} /></button>
            <h2 id="titulo-troca" className="text-base md:text-lg font-light uppercase tracking-widest text-white mb-5 md:mb-6 flex items-center gap-2"><RefreshCcw size={16} className="text-hb-gold md:w-5 md:h-5" /> Solicitar Troca</h2>
            {mensagemSucesso ? (
              <div className="bg-green-900/20 text-green-400 p-5 md:p-6 rounded-xl border border-green-900/50 text-center space-y-3 md:space-y-4"><CheckCircle2 size={32} className="mx-auto md:w-10 md:h-10" /><p className="text-xs md:text-sm font-medium">{mensagemSucesso}</p></div>
            ) : (
              <form onSubmit={enviarSolicitacaoTroca} className="space-y-5 md:space-y-6">
                {erroTroca && <div className="p-3 bg-red-900/20 text-red-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest rounded flex items-center gap-2 border border-red-900/50 leading-relaxed"><AlertCircle size={14} className="shrink-0" /> {erroTroca}</div>}
                <div>
                  <p className="text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Item</p>
                  <div className="flex items-center gap-3 p-3 bg-gray-900 rounded border border-gray-800">
                    <Image width={96} height={96} sizes="96px" alt={itemSelecionado?.nome || "Produto"} src={itemSelecionado?.foto || '/icon.svg'} className="w-10 h-10 object-cover rounded border border-gray-700 shrink-0" />
                    <p className="text-[10px] md:text-xs font-bold text-white uppercase truncate">{itemSelecionado?.nome}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Motivo</label>
                  <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full bg-gray-900 border border-gray-800 text-white p-3 rounded text-sm md:text-sm outline-none focus:border-hb-gold">
                    <option value="arrependimento">Arrependimento (7 dias)</option>
                    <option value="defeito">Defeito de Fabricação</option>
                    <option value="tamanho">Tamanho Incorreto</option>
                  </select>
                </div>
                {motivo === 'defeito' && (
                  <div className="animate-in fade-in duration-300">
                    <label className="flex items-center gap-2 text-[9px] md:text-[10px] font-bold text-red-500 uppercase tracking-widest mb-2"><Upload size={12} className="md:w-3 md:h-3" /> Foto do Defeito (Obrigatório)</label>
                    <input type="file" accept="image/*" required onChange={(e) => setFotoArquivo(e.target.files?.[0] || null)} className="w-full text-[10px] md:text-xs text-gray-400 border border-gray-800 p-2 bg-gray-900 rounded" />
                  </div>
                )}
                <button type="submit" disabled={carregandoTroca} className="w-full bg-hb-gold text-black py-3 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-widest hover:bg-yellow-600 transition disabled:opacity-50 flex items-center justify-center gap-2 rounded">
                  {carregandoTroca ? <Loader2 size={16} className="animate-spin" /> : 'ENVIAR SOLICITAÇÃO'}
                </button>
              </form>
            )}
        </Modal>
      )}
    </main>
  )
}

export default function MinhaConta() {
  return <Suspense fallback={<div className="min-h-[70vh] grid place-items-center"><Loader2 className="animate-spin text-hb-gold" /></div>}><ConteudoMinhaConta /></Suspense>
}
