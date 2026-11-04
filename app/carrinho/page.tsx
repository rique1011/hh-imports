'use client'
import Modal from '@/components/Modal'

import Image from 'next/image'
import type { ProdutoCarrinho } from '@/lib/store'
import type { OpcaoFrete } from '@/lib/frete'
import { mensagemErro } from '@/lib/erros'

import { useCart } from '@/lib/store'
import Link from 'next/link'
import { Trash2, Loader2, Ticket, CheckCircle2, X, Truck, Sparkles, Plus, Gift, AlertCircle, DollarSign } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react' 
import { useRouter } from 'next/navigation' 
import { useShallow } from 'zustand/react/shallow'

export default function PaginaCarrinho() {
  const router = useRouter()
  const { data: session } = useSession() 
  
  // 1. ESTADOS (HOOKS)
  const { itens, cupom, adicionarAoCarrinho, removerDoCarrinho, atualizarQuantidade, aplicarCupom, removerCupom } = useCart(useShallow(state => ({
    itens: state.itens, cupom: state.cupom, adicionarAoCarrinho: state.adicionarAoCarrinho,
    removerDoCarrinho: state.removerDoCarrinho, atualizarQuantidade: state.atualizarQuantidade,
    aplicarCupom: state.aplicarCupom, removerCupom: state.removerCupom,
  })))
  const idsNaSacola = itens.map(item => item.id).join('|')
  
  const [inputCupom, setInputCupom] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [validandoCupom, setValidandoCupom] = useState(false)

  const [cep, setCep] = useState('')
  const [opcoesFrete, setOpcoesFrete] = useState<OpcaoFrete[]>([])
  const [freteSelecionado, setFreteSelecionado] = useState<number>(0)
  const [freteToken, setFreteToken] = useState('')
  const [baseCotacao, setBaseCotacao] = useState('')
  const contextoFrete = cep.replace(/\D/g, '') + JSON.stringify(itens.map(({ id, quantidade, preco }) => ({ id, quantidade, preco })))
  const cotacaoAtual = baseCotacao === contextoFrete
  const [carregandoFrete, setCarregandoFrete] = useState(false)
  const [erroFrete, setErroFrete] = useState('')
  
  const [embalagemPresente, setEmbalagemPresente] = useState(false)

  const [mostrarPopUpSaida, setMostrarPopUpSaida] = useState(false)
  const [popUpJaMostrado, setPopUpJaMostrado] = useState(false)
  const [produtoBump, setProdutoBump] = useState<(ProdutoCarrinho & { preco_original: number }) | null>(null)
  
  const [elegivelBoasVindas, setElegivelBoasVindas] = useState(false)
  const [saldoCashback, setSaldoCashback] = useState(0)
  const [usarCashback, setUsarCashback] = useState(false)

  const [perfilCompleto, setPerfilCompleto] = useState(true)

  // 2. CÁLCULOS GERAIS
  const subtotal = itens.reduce((acc, item) => acc + (item.preco * item.quantidade), 0)
  const freteGratis = subtotal >= 100 
  const freteFinal = freteGratis || !cotacaoAtual ? 0 : freteSelecionado
  const valorDesconto = cupom ? (subtotal * (cupom.desconto / 100)) : 0
  const valorEmbalagem = embalagemPresente ? 15.00 : 0
  
  const subtotalComDesconto = subtotal + freteFinal + valorEmbalagem - valorDesconto
  const valorCashbackAplicado = usarCashback ? Math.min(saldoCashback, subtotalComDesconto) : 0
  const totalGeral = subtotalComDesconto - valorCashbackAplicado

  const descontoAtual = cupom ? cupom.desconto : 0
  const novoDescontoRetencao = descontoAtual + 5
  const codigoRetencao = cupom ? `OFERTA${novoDescontoRetencao}` : 'NAOVAEMBORA'

  // 3. EFEITOS (USE_EFFECTS)
  useEffect(() => {
    removerCupom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function carregarDadosUsuario() {
      if (!session?.user?.email) return

      try {
        const response = await fetch('/api/usuario', { cache: 'no-store' })
        if (!response.ok) throw new Error('Falha ao carregar cadastro.')
        const usuarioDb = await response.json()

        if (usuarioDb) {
          if (usuarioDb.saldo_cashback) {
            setSaldoCashback(Number(usuarioDb.saldo_cashback))
          }

          const temDocumento = Boolean(usuarioDb.cpf_cnpj && usuarioDb.whatsapp)
          
          let temEndereco = false
          if (usuarioDb.endereco) {
            try {
              const endParsed = JSON.parse(usuarioDb.endereco)
              temEndereco = Boolean(endParsed.cep && endParsed.logradouro && endParsed.numero && endParsed.bairro)
            } catch {
              temEndereco = usuarioDb.endereco.length > 10
            }
          }
          
          setPerfilCompleto(temEndereco && temDocumento)
        }

        if (usuarioDb.possui_pedidos) return

        if (usuarioDb && usuarioDb.created_at) {
          const diasDeConta = (new Date().getTime() - new Date(usuarioDb.created_at).getTime()) / (1000 * 3600 * 24)
          if (diasDeConta <= 7) {
            setElegivelBoasVindas(true)
          }
        } else {
          setElegivelBoasVindas(true)
        }
      } catch (e) {
        console.error("Erro ao buscar dados do usuário", e)
      }
    }
    carregarDadosUsuario()
  }, [session])

  useEffect(() => {
    const controller = new AbortController()
    async function buscarSugestaoDaLoja() {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data, error } = await supabase.from('produtos').select('id,nome,preco,fotos').limit(10).abortSignal(controller.signal)
        if (!controller.signal.aborted && !error && data && data.length > 0) {
          const idsNoCarrinho = idsNaSacola.split('|')
          const produtosDisponiveis = data.filter(p => !idsNoCarrinho.includes(p.id))

          if (produtosDisponiveis.length > 0) {
            const sorteado = produtosDisponiveis[Math.floor(Math.random() * produtosDisponiveis.length)]
            setProdutoBump({
              id: sorteado.id,
              nome: sorteado.nome,
              foto: sorteado.fotos?.[0] || '/icon.svg',
              preco_original: Number(sorteado.preco),
              preco: Number(sorteado.preco) * 0.80, 
              quantidade: 1
            })
          } else {
            setProdutoBump(null)
          }
        }
      } catch (err) {
        console.error("Erro ao buscar sugestão", err)
      }
    }
    if (idsNaSacola) buscarSugestaoDaLoja()
    return () => controller.abort()
  }, [idsNaSacola])

  useEffect(() => {
    let timerPopUp: NodeJS.Timeout

    const rastrearSaida = (e: MouseEvent) => {
      if (e.clientY <= 10 && !popUpJaMostrado && itens.length > 0) {
        timerPopUp = setTimeout(() => {
          setMostrarPopUpSaida(true)
          setPopUpJaMostrado(true)
        }, 1000)
      }
    }

    const cancelarSaida = () => {
      if (timerPopUp) clearTimeout(timerPopUp)
    }

    const delayInicial = setTimeout(() => {
      document.addEventListener('mouseleave', rastrearSaida)
      document.addEventListener('mouseenter', cancelarSaida)
    }, 5000)

    return () => {
      clearTimeout(delayInicial)
      if (timerPopUp) clearTimeout(timerPopUp)
      document.removeEventListener('mouseleave', rastrearSaida)
      document.removeEventListener('mouseenter', cancelarSaida)
    }
  }, [popUpJaMostrado, itens.length])

  useEffect(() => {
    const emailDoCliente = session?.user?.email
    if (emailDoCliente) {
      const timeoutId = setTimeout(() => {
        fetch('/api/carrinho/salvar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailDoCliente,
            itens: itens,
            total: subtotal
          })
        }).catch(err => console.error("Falha ao salvar carrinho", err))
      }, 2000)

      return () => clearTimeout(timeoutId)
    }
  }, [itens, session, subtotal])

  // 4. FUNÇÕES DE AÇÃO
  const aplicarDescontoRetencao = () => {
    aplicarCupom(codigoRetencao, novoDescontoRetencao)
    setMostrarPopUpSaida(false)
  }

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length > 5) value = value.replace(/^(\d{5})(\d)/, '$1-$2')
    setCep(value)
  }

  const calcularFrete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cep.length < 9) return

    setCarregandoFrete(true)
    setErroFrete('')
    setOpcoesFrete([])
    setFreteSelecionado(0)
    setFreteToken('')

    try {
      const response = await fetch('/api/frete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cepDestino: cep, itens: itens.map(({ id, quantidade }) => ({ id: String(id), quantidade })) })
      })
      const data = await response.json()

      if (!response.ok) {
        setErroFrete(data.error || 'Erro ao calcular frete.')
      } else {
        const opcoesOrdenadas = data.opcoes.sort((a: OpcaoFrete, b: OpcaoFrete) => Number(a.preco) - Number(b.preco))
        setOpcoesFrete(opcoesOrdenadas)
        setBaseCotacao(contextoFrete)
        if (opcoesOrdenadas.length > 0) {
          setFreteSelecionado(Number(opcoesOrdenadas[0].preco))
          setFreteToken(opcoesOrdenadas[0].token || '')
        }
      }
    } catch {
      setErroFrete('Erro de conexão ao calcular frete.')
    } finally {
      setCarregandoFrete(false)
    }
  }

  const validarCupom = async () => {
    const codigo = inputCupom.toUpperCase().trim()
    if (!codigo) return

    setValidandoCupom(true)

    if (codigo === 'BEMVINDO10' && !elegivelBoasVindas) {
      alert("Este cupom é exclusivo para contas criadas há menos de 7 dias em sua primeira compra.")
      setValidandoCupom(false)
      return
    }

    try {
      const response = await fetch('/api/cupons/validar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Cupom indisponível.')
      aplicarCupom(data.codigo, data.desconto)
      setInputCupom('')
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao verificar cupom. Tente novamente.")
    } finally {
      setValidandoCupom(false)
    }
  }

  const finalizarCompra = async () => {
    if (!session) { router.push('/login'); return; }

    if (!perfilCompleto) {
      alert("Quase lá! Para podermos enviar suas joias, precisamos do seu Endereço e CPF.\n\nVamos te redirecionar para você preencher os dados.")
      router.push('/minha-conta?aba=dados&alerta=campos_vazios')
      return;
    }

    if (freteFinal === 0 && !freteGratis) { alert("Por favor, calcule e selecione um frete para a entrega."); return; }

    setCarregando(true)
    try {
      const resposta = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          itens, 
          frete: freteFinal,
          freteToken: cotacaoAtual ? freteToken : '',
          codigoCupom: cupom?.codigo || null,
          embalagemPresente,
          cashbackUsado: valorCashbackAplicado
        })
      })
      
      const dados = await resposta.json()
      
      if (!resposta.ok) throw new Error(dados.error || "Erro ao gerar pagamento")
      
      if (dados.urlPagamento) window.location.href = dados.urlPagamento
    } catch (error) {
      alert(mensagemErro(error, "Erro ao processar. Tente novamente."))
    } finally { 
      setCarregando(false) 
    }
  }

  // 5. RETORNO CONDICIONAL (CARRINHO VAZIO)
  if (itens.length === 0) {
    return (
      <main className="min-h-[70vh] flex flex-col items-center justify-center bg-hb-black px-4 md:px-6">
        <h1 className="text-xl md:text-2xl font-light text-white uppercase tracking-widest mb-4 italic text-center">Sua sacola está vazia</h1>
        <Link href="/" className="text-[10px] md:text-xs font-bold uppercase tracking-widest border-b border-hb-gold text-hb-gold pb-1 hover:text-hb-goldLight transition">
          Explorar Coleções
        </Link>
      </main>
    )
  }

  // 6. RETORNO PRINCIPAL
  return (
    <main className="min-h-screen bg-hb-black py-8 md:py-16 relative">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <h1 className="text-xl md:text-2xl font-light text-white uppercase tracking-widest mb-8 md:mb-12 text-center italic">Sua Sacola de Luxo</h1>
        
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-12">
          
          {/* LADO ESQUERDO (ITENS E FRETE) */}
          <div className="flex-1 min-w-0 space-y-6">
            <div className="bg-hb-gray p-4 md:p-6 rounded-xl border border-gray-800 shadow-sm">
                {itens.map((item) => (
                  <div key={item.id} className="flex gap-4 md:gap-6 py-4 md:py-6 border-b border-gray-800 last:border-0">
                    <Image width={96} height={96} sizes="96px" src={item.foto || '/icon.svg'} alt={item.nome} loading="lazy" decoding="async" className="w-20 h-20 md:w-24 md:h-24 object-cover rounded border border-gray-700 shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-200 line-clamp-2">{item.nome}</h3>
                        <button onClick={() => removerDoCarrinho(item.id)} aria-label={`Remover ${item.nome} da sacola`} className="text-gray-500 hover:text-red-500 transition shrink-0 min-w-11 min-h-11 grid place-items-center -mt-2 -mr-2"><Trash2 size={16} /></button>
                      </div>
                      
                      <div className="flex flex-wrap justify-between items-center gap-3 w-full">
                        <div className="flex items-center border border-gray-700 rounded overflow-hidden min-h-11">
                          <button aria-label={`Diminuir quantidade de ${item.nome}`} onClick={() => atualizarQuantidade(item.id, Math.max(1, item.quantidade - 1))} className="min-w-11 min-h-11 px-2 py-1 h-full bg-hb-black text-gray-400 hover:text-white transition text-xs flex items-center justify-center">-</button>
                          <span className="px-3 py-1 text-xs font-bold text-white flex items-center justify-center h-full border-x border-gray-700">{item.quantidade}</span>
                          <button aria-label={`Aumentar quantidade de ${item.nome}`} onClick={() => atualizarQuantidade(item.id, item.quantidade + 1)} className="min-w-11 min-h-11 px-2 py-1 h-full bg-hb-black text-gray-400 hover:text-white transition text-xs flex items-center justify-center">+</button>
                        </div>
                        <p className="text-xs md:text-sm font-bold text-hb-gold ml-auto">
                          R$ {(item.preco * item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="bg-hb-gray p-4 md:p-6 rounded-xl border border-gray-800 shadow-sm">
              <div className="flex justify-between items-center mb-5 md:mb-6">
                <p className="text-[10px] font-bold text-hb-gold uppercase tracking-widest flex items-center gap-2">
                  <Truck size={16} /> Opções de Entrega
                </p>
                {freteGratis && (
                  <span className="flex items-center gap-1 text-[8px] md:text-[10px] font-bold text-green-400 bg-green-900/30 border border-green-800 px-2 py-1 rounded">
                    <CheckCircle2 size={12} /> FRETE GRÁTIS
                  </span>
                )}
              </div>

              {!freteGratis ? (
                <>
                  <form onSubmit={calcularFrete} className="flex gap-2 mb-5 md:mb-6">
                    <input
                      type="text" inputMode="numeric" autoComplete="postal-code" aria-label="CEP de entrega"
                      value={cep}
                      onChange={handleCepChange}
                      maxLength={9}
                      placeholder="00000-000"
                      className="flex-1 px-3 py-3 md:px-4 text-xs md:text-sm bg-hb-black text-white border border-gray-700 rounded outline-none focus:border-hb-gold transition placeholder-gray-600 min-w-0"
                      required
                    />
                    <button 
                      type="submit" 
                      disabled={carregandoFrete || cep.length < 9}
                      className="bg-hb-gold text-hb-black px-4 md:px-6 py-3 text-[9px] md:text-[10px] font-bold uppercase tracking-widest hover:bg-hb-goldLight transition disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 rounded"
                    >
                      {carregandoFrete ? <Loader2 size={14} className="animate-spin" /> : 'Calcular'}
                    </button>
                  </form>

                  {erroFrete && <p className="text-red-500 text-[10px] md:text-xs mt-2 font-medium mb-4">{erroFrete}</p>}

                  {cotacaoAtual && opcoesFrete.length > 0 && (
                    <div className="space-y-3">
                      {opcoesFrete.map((opcao, index) => (
                        <label 
                          key={index} 
                          className={`flex items-center justify-between p-3 md:p-4 rounded-lg border cursor-pointer transition-all ${
                            freteSelecionado === Number(opcao.preco) ? 'border-hb-gold bg-hb-black' : 'border-gray-700 hover:border-hb-gold'
                          }`}
                        >
                          <div className="flex items-center gap-3 md:gap-4">
                            <input 
                              type="radio" 
                              name="frete" 
                              value={opcao.preco} 
                              checked={freteSelecionado === Number(opcao.preco)}
                              onChange={() => { setFreteSelecionado(Number(opcao.preco)); setFreteToken(opcao.token || '') }}
                              className="w-4 h-4 text-hb-gold focus:ring-hb-gold accent-hb-gold cursor-pointer shrink-0"
                            />
                            <div>
                              <p className="text-[10px] md:text-xs font-bold text-white uppercase">{opcao.nome}</p>
                              <p className="text-[9px] md:text-[10px] text-gray-400 uppercase tracking-widest mt-1">
                                Até {opcao.prazo} dias
                              </p>
                            </div>
                          </div>
                          <p className="text-xs md:text-sm font-black text-hb-gold shrink-0">
                            R$ {Number(opcao.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </label>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs md:text-sm text-gray-400 italic">O frete é por nossa conta nesta compra! Sua joia será enviada com segurança.</p>
              )}
            </div>
          </div>

          {/* LADO DIREITO (RESUMO E EXTRAS) */}
          <div className="w-full lg:w-96 space-y-4 lg:space-y-6 flex-shrink-0">
            {saldoCashback > 0 && (
              <div className="bg-gradient-to-r from-hb-gray to-hb-black border border-hb-gold/30 text-white p-4 md:p-5 rounded-xl shadow-sm flex items-center justify-between animate-in fade-in duration-500">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="bg-hb-gold/20 p-2 md:p-2.5 rounded-full text-hb-gold shrink-0">
                    <DollarSign size={16} className="md:w-[18px] md:h-[18px]" />
                  </div>
                  <div>
                    <h3 className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-hb-gold">Créditos H&H IMPORTS</h3>
                    <p className="text-xs md:text-sm font-black text-white mt-0.5">R$ {saldoCashback.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    aria-label="Usar saldo de cashback" checked={usarCashback}
                    onChange={() => setUsarCashback(!usarCashback)} 
                  />
                  <div className="w-10 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-hb-black after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hb-gold"></div>
                </label>
              </div>
            )}

            {elegivelBoasVindas && !cupom && (
              <div className="bg-green-900/20 p-4 md:p-5 rounded-xl border border-green-800 shadow-sm animate-in fade-in duration-500">
                <h3 className="text-[9px] md:text-[10px] font-bold text-green-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Gift size={14} /> Presente de Boas-Vindas
                </h3>
                <p className="text-[10px] md:text-xs text-green-100 mb-4 leading-relaxed">
                  Como sua conta é nova, você tem <strong className="font-black text-green-400">10% OFF</strong> na sua primeira compra!
                </p>
                <button 
                  onClick={() => { setInputCupom('BEMVINDO10'); validarCupom(); }} 
                  className="bg-transparent border border-green-500 text-green-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest py-3 px-4 rounded hover:bg-green-800 transition w-full"
                >
                  Ativar BEMVINDO10
                </button>
              </div>
            )}

            {produtoBump && (
              <div className="bg-gradient-to-r from-hb-gold to-hb-goldDark p-[1px] rounded-xl shadow-md animate-in fade-in duration-500">
                <div className="bg-hb-gray p-4 md:p-5 rounded-[10px]">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles size={14} className="text-hb-gold md:w-4 md:h-4" />
                    <p className="text-[9px] md:text-[10px] font-bold text-hb-gold uppercase tracking-widest">
                      Complete o Look (Oferta Especial)
                    </p>
                  </div>
                  
                  <div className="flex gap-3 md:gap-4 items-center">
                    <Image width={96} height={96} sizes="96px"
                      src={produtoBump.foto} 
                      alt={produtoBump.nome} 
                      className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg border border-gray-700 shrink-0" 
                    />
                    <div>
                      <h4 className="text-[10px] md:text-xs font-bold text-white uppercase leading-tight mb-1 line-clamp-2">
                        {produtoBump.nome}
                      </h4>
                      <p className="text-[9px] md:text-[10px] text-gray-500 line-through">De: R$ {produtoBump.preco_original.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs md:text-sm font-black text-hb-gold">Por: R$ {produtoBump.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => adicionarAoCarrinho(produtoBump)}
                    className="w-full mt-4 bg-hb-black text-white border border-gray-700 py-3 rounded text-[9px] md:text-[10px] font-bold uppercase tracking-widest hover:bg-hb-gold hover:text-hb-black transition flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> Adicionar à Sacola
                  </button>
                </div>
              </div>
            )}

            <div className="bg-hb-gray p-4 md:p-6 rounded-xl border border-gray-800 shadow-sm">
              <p className="text-[9px] md:text-[10px] font-bold text-hb-gold uppercase tracking-widest mb-3 md:mb-4">Cupom de Desconto</p>
              {cupom ? (
                <div className="flex items-center justify-between bg-green-900/30 p-3 rounded border border-green-800">
                  <div className="flex items-center gap-2 text-green-400">
                    <Ticket size={14} className="md:w-4 md:h-4" />
                    <span className="text-[10px] md:text-xs font-bold uppercase">{cupom.codigo} (-{cupom.desconto}%)</span>
                  </div>
                  <button onClick={removerCupom} className="text-green-400 hover:text-red-500 p-1"><X size={14} /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={inputCupom}
                    onChange={(e) => setInputCupom(e.target.value)}
                    placeholder="CÓDIGO" 
                    className="flex-1 bg-hb-black border border-gray-700 p-3 rounded text-[10px] md:text-xs text-white uppercase outline-none focus:border-hb-gold placeholder-gray-600 min-w-0" 
                  />
                  <button onClick={validarCupom} disabled={validandoCupom} className="bg-hb-gold text-hb-black px-3 md:px-4 py-3 rounded text-[9px] md:text-[10px] font-bold uppercase disabled:opacity-50 flex justify-center items-center hover:bg-hb-goldLight transition shrink-0 min-w-[70px]">
                    {validandoCupom ? <Loader2 size={14} className="animate-spin" /> : 'Aplicar'}
                  </button>
                </div>
              )}
            </div>

            <div className={`border rounded-xl p-4 md:p-5 flex items-center justify-between gap-3 md:gap-4 transition-all duration-300 ${embalagemPresente ? 'bg-hb-black border-hb-gold shadow-[0_0_15px_rgba(212,175,55,0.15)]' : 'bg-hb-gray border-gray-800 shadow-sm'}`}>
              <div className="flex items-center gap-3 md:gap-4">
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${embalagemPresente ? 'bg-hb-gold' : 'bg-hb-black border border-gray-700'}`}>
                  <Gift size={14} className={embalagemPresente ? 'text-hb-black' : 'text-gray-500 md:w-4 md:h-4'} />
                </div>
                <div>
                  <h3 className="text-[10px] md:text-xs font-bold text-white uppercase tracking-widest">Presente</h3>
                  <p className="text-[8px] md:text-[10px] text-gray-400 mt-1 uppercase">Caixa Veludo + Laço</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="text-[10px] md:text-xs font-black text-hb-gold">+ R$ 15</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    aria-label="Embalagem para presente" checked={embalagemPresente}
                    onChange={() => setEmbalagemPresente(!embalagemPresente)} 
                  />
                  <div className="w-8 h-4 md:w-9 md:h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-hb-black after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 md:after:h-4 md:after:w-4 after:transition-all peer-checked:bg-hb-gold"></div>
                </label>
              </div>
            </div>

            <div className="bg-hb-gray p-4 md:p-6 rounded-xl border border-gray-800 shadow-sm lg:sticky lg:top-24">
              <h2 className="text-[10px] md:text-xs font-bold text-white uppercase tracking-widest mb-4 md:mb-6">Resumo do Pedido</h2>
              <div className="space-y-3 md:space-y-4 text-[10px] md:text-xs font-medium text-gray-400 mb-5 md:mb-6 border-b border-gray-700 pb-5 md:pb-6">
                <div className="flex justify-between"><span>Subtotal</span><span className="text-white">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                
                <div className="flex justify-between">
                  <span>Frete</span>
                  <span className={freteGratis ? "text-green-400 font-bold" : "text-white"}>
                    {freteGratis ? 'GRÁTIS' : (freteSelecionado > 0 ? `R$ ${freteSelecionado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '--')}
                  </span>
                </div>

                {embalagemPresente && (
                   <div className="flex justify-between text-hb-gold font-bold">
                     <span>Caixa de Presente</span>
                     <span>+ R$ 15,00</span>
                   </div>
                )}

                {cupom && (
                  <div className="flex justify-between text-green-400">
                    <span>Desconto ({cupom.codigo})</span>
                    <span>- R$ {valorDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                {usarCashback && valorCashbackAplicado > 0 && (
                  <div className="flex justify-between text-hb-gold font-bold p-2 bg-hb-gold/10 rounded border border-hb-gold/20">
                    <span>Saldo Utilizado</span>
                    <span>- R$ {valorCashbackAplicado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
              
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <span className="font-bold text-white text-xs md:text-sm uppercase">Total</span>
                <span className="text-lg md:text-xl font-bold text-hb-gold">R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              
              <button 
                onClick={finalizarCompra} 
                disabled={carregando || (freteFinal === 0 && !freteGratis)} 
                className="w-full bg-hb-gold text-hb-black py-3 md:py-4 rounded font-bold text-[10px] md:text-xs uppercase tracking-widest hover:bg-hb-goldLight transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {carregando ? <Loader2 className="animate-spin" size={16} /> : 'Finalizar Compra'}
              </button>
              
              {freteFinal === 0 && !freteGratis && (
                <p className="text-[8px] md:text-[9px] text-red-400 font-bold uppercase tracking-widest mt-3 text-center">Calcule o frete para continuar</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {mostrarPopUpSaida && (
        <Modal onClose={() => setMostrarPopUpSaida(false)} labelledBy="titulo-oferta" className="bg-hb-gray border border-gray-700 rounded-2xl max-w-lg shadow-2xl relative">
            <button onClick={() => setMostrarPopUpSaida(false)} aria-label="Fechar oferta" className="absolute top-3 md:top-4 right-3 md:right-4 min-w-11 min-h-11 grid place-items-center text-gray-400 hover:text-white z-10 bg-hb-black/50 rounded-full p-1 md:p-1.5 transition"><X size={18} /></button>
            <div className="h-32 md:h-40 bg-black relative flex items-center justify-center overflow-hidden border-b border-hb-gold/30">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1599643477877-530eb83abc8e?q=80&w=800')] bg-cover bg-center opacity-30"></div>
              <div className="relative z-10 flex flex-col items-center">
                <AlertCircle size={32} className="text-hb-gold mb-2 animate-bounce md:w-10 md:h-10" />
                <h2 id="titulo-oferta" className="text-xl md:text-2xl font-light text-white uppercase tracking-widest">Espere!</h2>
              </div>
            </div>
            <div className="p-5 md:p-8 text-center">
              <h3 className="text-sm md:text-lg font-bold text-hb-gold uppercase tracking-widest mb-2 md:mb-3">Não vá embora de mãos vazias</h3>
              <p className="text-[11px] md:text-sm text-gray-300 leading-relaxed mb-5 md:mb-6">
                Notamos que você ia sair, mas não queremos que você perca essas peças exclusivas. Finalize sua compra agora e ganhe <strong className="text-white">{novoDescontoRetencao}% DE DESCONTO</strong> no carrinho todo.
              </p>
              <div className="bg-hb-black border border-hb-gold border-dashed rounded-lg p-3 md:p-4 mb-5 md:mb-6">
                <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Seu Cupom Exclusivo</p>
                <p className="text-lg md:text-xl font-black text-hb-gold tracking-[0.2em]">{codigoRetencao}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                <button onClick={aplicarDescontoRetencao} className="flex-1 bg-hb-gold text-hb-black py-3 md:py-4 rounded text-[10px] md:text-xs font-bold uppercase tracking-widest hover:bg-hb-goldLight transition shadow-lg">Aplicar {novoDescontoRetencao}% Off</button>
                <button onClick={() => setMostrarPopUpSaida(false)} className="flex-1 bg-hb-black border border-gray-700 text-gray-300 py-3 md:py-4 rounded text-[10px] md:text-xs font-bold uppercase tracking-widest hover:bg-gray-800 hover:text-white transition">Talvez Depois</button>
              </div>
            </div>
        </Modal>
      )}
    </main>
  )
}
