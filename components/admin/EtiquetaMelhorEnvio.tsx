'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Loader2, Package, RefreshCw } from 'lucide-react'
import type { OpcaoFrete } from '@/lib/frete'
import type { EntregaPedido, ResultadoEtiqueta, EnvioAutomatico } from '@/types/envio'

type Consulta = ResultadoEtiqueta & { entrega?: EntregaPedido; usaCadastroAtual?: boolean; documentoFiscalSugerido?: 'nfe' | 'declaracao'; exigeNfe?: boolean; automatico?: EnvioAutomatico | null }
interface Props {
  pedidoId: string
  onAtualizado: (resultado: ResultadoEtiqueta) => void
  onOcupado: (ocupado: boolean) => void
}
const dinheiro = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const classeCampo = 'w-full min-w-0 bg-gray-900 border border-gray-700 p-3 rounded text-base text-white'
async function buscarEtiqueta(pedidoId: string, signal?: AbortSignal): Promise<Consulta> {
  const response = await fetch('/api/melhor-envio/gerar-etiqueta?pedidoId=' + encodeURIComponent(pedidoId), { cache: 'no-store', signal })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Não foi possível consultar a etiqueta.')
  return data
}

export default function EtiquetaMelhorEnvio({ pedidoId, onAtualizado, onOcupado }: Props) {
  const [resultado, setResultado] = useState<Consulta | null>(null)
  const [opcoes, setOpcoes] = useState<OpcaoFrete[]>([])
  const [freteToken, setFreteToken] = useState('')
  const [notaFiscal, setNotaFiscal] = useState('')
  const [documentoFiscal, setDocumentoFiscal] = useState<'nfe' | 'declaracao'>('nfe')
  const [confirmarDeclaracao, setConfirmarDeclaracao] = useState(false)
  const [chaveDce, setChaveDce] = useState('')
  const [agencia, setAgencia] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [tentativas, setTentativas] = useState(0)
  const [consultas, setConsultas] = useState(0)

  const aplicar = useCallback((data: Consulta) => {
    setResultado(data)
    if (data.concluido) onAtualizado(data)
  }, [onAtualizado])
  const consultar = useCallback(async (signal?: AbortSignal) => {
    const data = await buscarEtiqueta(pedidoId, signal)
    aplicar(data)
    return data
  }, [pedidoId, aplicar])

  useEffect(() => {
    const controller = new AbortController()
    buscarEtiqueta(pedidoId, controller.signal)
      .then(data => { aplicar(data); setDocumentoFiscal(data.exigeNfe ? 'nfe' : data.documentoFiscalSugerido || 'nfe') })
      .catch(error => { if (!controller.signal.aborted) setErro(error.message) })
    return () => controller.abort()
  }, [pedidoId, aplicar])

  const automatico = resultado?.automatico && !['manual','concluida'].includes(resultado.automatico.estado) ? resultado.automatico : null
  useEffect(() => {
    if (!automatico || automatico.pausada || !['pendente','processando','aguardando'].includes(automatico.estado) || consultas >= 30) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      consultar(controller.signal).then(async data => {
        if (data.automatico?.estado === 'aguardando' && ['comprando','compra_incerta','pago','gerando','aguardando_rastreio'].includes(data.estado)) {
          // Somente conferência de um ID já comprado/em confirmação; esta ação
          // é bloqueada pelo servidor para carrinhos ainda não pagos.
          await fetch('/api/admin/envio-automatico/pedido', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pedidoId, acao: 'sincronizar' }) })
        }
      }).catch(error => { if (!controller.signal.aborted) setErro(error.message) })
        .finally(() => setConsultas(value => value + 1))
    }, resultado?.urlEtiqueta ? 60000 : 8000)
    return () => { clearTimeout(timer); controller.abort() }
  }, [automatico, consultas, consultar, pedidoId, resultado?.urlEtiqueta])

  async function controlarAutomatico(acao: 'retomar' | 'documento' | 'manual') {
    setOcupado(true); onOcupado(true); setErro('')
    try {
      const response = await fetch('/api/admin/envio-automatico/pedido', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId, acao, notaFiscal }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar a automação.')
      setResultado(anterior => anterior ? { ...anterior, automatico: data.automatico } : anterior)
      setConsultas(0)
      await consultar()
    } catch (error) { setErro(error instanceof Error ? error.message : 'Falha de comunicação.') }
    finally { setOcupado(false); onOcupado(false) }
  }

  const executar = useCallback(async (acao: 'cotar' | 'gerar') => {
    setOcupado(true); onOcupado(true); setErro('')
    try {
      const response = await fetch('/api/melhor-envio/gerar-etiqueta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId, acao, freteToken, agencia, documentoFiscal,
          notaFiscal: documentoFiscal === 'nfe' ? notaFiscal : '',
          chaveDce: documentoFiscal === 'declaracao' ? chaveDce : '', confirmarDeclaracao }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível processar a etiqueta.')
      if (acao === 'cotar') {
        setOpcoes(data.opcoes); setFreteToken(data.opcoes[0]?.token || '')
        if (!data.opcoes.length) setErro('Nenhum serviço disponível para o envio contratado. Confira os dados e o painel do Melhor Envio.')
      } else {
        const atualizado = data as ResultadoEtiqueta
        setResultado(anterior => ({ ...anterior, ...atualizado }))
        if (atualizado.concluido) { setTentativas(0); onAtualizado(atualizado) }
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha de comunicação.'); setTentativas(0)
      // Depois de timeout, consultar o checkpoint antes de oferecer outra ação.
      try {
        const response = await fetch('/api/melhor-envio/gerar-etiqueta?pedidoId=' + encodeURIComponent(pedidoId), { cache: 'no-store' })
        if (response.ok) setResultado(await response.json())
      } catch {}
    } finally { setOcupado(false); onOcupado(false) }
  }, [pedidoId, freteToken, notaFiscal, agencia, documentoFiscal, chaveDce, confirmarDeclaracao, onAtualizado, onOcupado])

  useEffect(() => {
    if (automatico || !tentativas || ocupado || !resultado?.podeRetomar || !['comprando','compra_incerta','pago','gerando','aguardando_rastreio'].includes(resultado.estado)) return
    const timer = setTimeout(() => { setTentativas(value => value - 1); void executar('gerar') }, 5000)
    return () => clearTimeout(timer)
  }, [tentativas, ocupado, resultado, executar, automatico])

  const nova = resultado?.estado === 'nova'
  const selecionada = opcoes.find(opcao => opcao.token === freteToken)
  const documentoValido = documentoFiscal === 'nfe' ? notaFiscal.length === 44 : confirmarDeclaracao && (!chaveDce || chaveDce.length === 44)
  return <section aria-label="Etiqueta Melhor Envio" className="bg-hb-black p-5 rounded-xl border border-gray-800 space-y-4">
    <h3 className="text-sm text-hb-gold uppercase flex items-center gap-2"><Package size={18} /> Etiqueta Melhor Envio</h3>
    {resultado?.entrega && <div className="text-xs text-gray-300 break-words space-y-1">
      <p>{resultado.entrega.nome} — {resultado.entrega.logradouro}, {resultado.entrega.numero} {resultado.entrega.complemento}</p>
      <p>{resultado.entrega.bairro} — {resultado.entrega.cidade}/{resultado.entrega.uf} — CEP {resultado.entrega.cep}</p>
      {resultado.usaCadastroAtual && <p className="text-yellow-400">Pedido antigo: destino obtido do cadastro atual. Confira antes de gerar.</p>}
    </div>}
    {automatico && <div className="space-y-3 rounded border border-gray-700 p-3 text-sm">
      <p className="font-bold text-hb-gold">Compra automática</p>
      {automatico.pausada && <p className="text-yellow-300">A automação está pausada. Ative nas configurações para retomar.</p>}
      {automatico.estado === 'aguardando_documento' && <label className="block space-y-2">Chave da NF-e deste pedido
        <input inputMode="numeric" maxLength={44} value={notaFiscal} onChange={event => setNotaFiscal(event.target.value.replace(/\D/g, ''))} disabled={ocupado} className={classeCampo} />
      </label>}
      {automatico.estado === 'aguardando_documento' && <button type="button" disabled={ocupado || automatico.pausada || notaFiscal.length !== 44} onClick={() => void controlarAutomatico('documento')}
        className="w-full min-h-11 rounded bg-hb-gold px-4 py-3 font-bold text-black disabled:opacity-50">Salvar NF-e e continuar automaticamente</button>}
      {['atencao','aguardando'].includes(automatico.estado) && <button type="button" disabled={ocupado || automatico.pausada} onClick={() => void controlarAutomatico('retomar')}
        className="min-h-11 rounded border border-gray-600 px-4 py-3 disabled:opacity-50">Retomar após corrigir a pendência</button>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={ocupado} onClick={() => { setConsultas(0); void consultar().catch(error => setErro(error.message)) }} className="min-h-11 px-3 py-2 text-hb-gold underline disabled:opacity-50">Consultar status da etiqueta</button>
        <button type="button" disabled={ocupado} onClick={() => void controlarAutomatico('manual')} className="min-h-11 px-3 py-2 text-gray-400 underline disabled:opacity-50">Usar modo manual neste pedido</button>
      </div>
    </div>}
    {nova && !automatico && <>
      <button type="button" disabled={ocupado} onClick={() => void executar('cotar')} className="min-h-11 px-4 py-3 border border-gray-600 rounded disabled:opacity-50">
        {ocupado ? 'Consultando…' : 'Consultar fretes para este pedido'}
      </button>
      {opcoes.length > 0 && <label className="block text-sm space-y-2">Serviço e custo da etiqueta
        <select value={freteToken} onChange={event => setFreteToken(event.target.value)} disabled={ocupado} className={classeCampo}>
          {opcoes.map(opcao => <option key={opcao.servico} value={opcao.token}>{opcao.transportadora} — {opcao.nome} — {dinheiro(opcao.preco)}</option>)}
        </select>
      </label>}
      <label className="block text-sm space-y-2">Documento do envio
        <select value={documentoFiscal} onChange={event => { setDocumentoFiscal(event.target.value as 'nfe' | 'declaracao'); setConfirmarDeclaracao(false) }} disabled={ocupado} className={classeCampo}>
          <option value="nfe">Nota fiscal (NF-e)</option>
          <option value="declaracao" disabled={resultado?.exigeNfe}>Declaração de conteúdo (DC-e) — quando dispensado de NF-e</option>
        </select>
      </label>
      {resultado?.exigeNfe && <p className="text-sm text-gray-400">Compra com CNPJ: este pedido utiliza NF-e. Emita a nota e informe a chave abaixo para gerar a etiqueta.</p>}
      {documentoFiscal === 'nfe' ? <label className="block text-sm space-y-2">Chave da NF-e deste pedido
        <input inputMode="numeric" value={notaFiscal} onChange={event => setNotaFiscal(event.target.value.replace(/\D/g, '').slice(0,44))} maxLength={44} disabled={ocupado} placeholder="44 dígitos da nota fiscal" className={classeCampo} />
      </label> : <div className="space-y-3">
        <p className="text-xs text-gray-300">A DC-e utiliza os itens e valores deste pedido. Quando a chave abaixo fica vazia, a emissão é solicitada ao Melhor Envio. Imprima a declaração para acompanhar o pacote.</p>
        <label className="block text-sm space-y-2">Chave da DC-e já emitida (opcional)
          <input inputMode="numeric" value={chaveDce} onChange={event => setChaveDce(event.target.value.replace(/\D/g, '').slice(0,44))} maxLength={44} disabled={ocupado} placeholder="Deixe vazio para emitir pelo Melhor Envio" className={classeCampo} />
        </label>
        <label className="flex items-start gap-3 min-h-11 py-2 text-sm">
          <input type="checkbox" checked={confirmarDeclaracao} onChange={event => setConfirmarDeclaracao(event.target.checked)} disabled={ocupado} className="mt-1 size-5 shrink-0 accent-yellow-500" />
          Confirmo que este envio pode utilizar declaração de conteúdo e está dispensado de NF-e.
        </label>
      </div>}
      <label className="block text-sm space-y-2">ID da agência (quando exigido pela transportadora)
        <input inputMode="numeric" value={agencia} onChange={event => setAgencia(event.target.value.replace(/\D/g, ''))} disabled={ocupado} className={classeCampo} />
      </label>
      {selecionada && <p className="text-sm text-yellow-300">Ao gerar, a compra de {dinheiro(selecionada.preco)} usa o saldo da sua carteira Melhor Envio. Confira documentação, destino e medidas da embalagem.</p>}
    </>}
    {!automatico && resultado?.estado === 'carrinho' && <p className="text-sm text-yellow-300">
      Ao concluir a compra, {dinheiro(resultado.custoEtiqueta || 0)} serão debitados da sua carteira Melhor Envio.
    </p>}
    <p role="status" aria-live="polite" className="text-sm text-gray-300">{automatico?.mensagem || resultado?.mensagem || 'Consultando pedido…'}</p>
    {erro && <p role="alert" className="text-sm text-red-400">{erro}</p>}
    {!automatico && resultado?.podeRetomar && !resultado.concluido && <button type="button" disabled={ocupado || (nova && (!selecionada || !documentoValido))}
      onClick={() => { setTentativas(8); void executar('gerar') }}
      className="w-full min-h-11 px-4 py-3 rounded bg-hb-gold text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50">
      {ocupado ? <Loader2 className="animate-spin shrink-0" size={18} /> : <RefreshCw size={18} className="shrink-0" />}
      {ocupado ? 'Processando etiqueta…' : nova ? 'Gerar Etiqueta (Melhor Envio)' : resultado.estado === 'carrinho' ? 'Concluir compra da etiqueta' : 'Atualizar processamento da etiqueta'}
    </button>}
    {resultado?.urlEtiqueta && <a href={resultado.urlEtiqueta} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center gap-2 text-hb-gold underline"><Download size={18} /> Abrir etiqueta / PDF</a>}
    {resultado?.urlDeclaracao && <a href={resultado.urlDeclaracao} target="_blank" rel="noopener noreferrer" className="min-h-11 flex items-center gap-2 text-hb-gold underline"><Download size={18} /> Imprimir declaração de conteúdo (DACE)</a>}
    {resultado?.codigoRastreio && <p className="text-sm break-all">Rastreio: <strong>{resultado.codigoRastreio}</strong></p>}
  </section>
}
