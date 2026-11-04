'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Loader2, Package, RefreshCw } from 'lucide-react'
import type { OpcaoFrete } from '@/lib/frete'
import type { EntregaPedido, ResultadoEtiqueta } from '@/types/envio'

type Consulta = ResultadoEtiqueta & { entrega?: EntregaPedido; usaCadastroAtual?: boolean }
interface Props {
  pedidoId: string
  onAtualizado: (resultado: ResultadoEtiqueta) => void
  onOcupado: (ocupado: boolean) => void
}
const dinheiro = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const classeCampo = 'w-full min-w-0 bg-gray-900 border border-gray-700 p-3 rounded text-base text-white'

export default function EtiquetaMelhorEnvio({ pedidoId, onAtualizado, onOcupado }: Props) {
  const [resultado, setResultado] = useState<Consulta | null>(null)
  const [opcoes, setOpcoes] = useState<OpcaoFrete[]>([])
  const [freteToken, setFreteToken] = useState('')
  const [notaFiscal, setNotaFiscal] = useState('')
  const [agencia, setAgencia] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [tentativas, setTentativas] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/melhor-envio/gerar-etiqueta?pedidoId=' + encodeURIComponent(pedidoId), { cache: 'no-store', signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data as Consulta })
      .then(setResultado).catch(error => { if (!controller.signal.aborted) setErro(error.message) })
    return () => controller.abort()
  }, [pedidoId])

  const executar = useCallback(async (acao: 'cotar' | 'gerar') => {
    setOcupado(true); onOcupado(true); setErro('')
    try {
      const response = await fetch('/api/melhor-envio/gerar-etiqueta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId, acao, freteToken, notaFiscal, agencia }),
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
  }, [pedidoId, freteToken, notaFiscal, agencia, onAtualizado, onOcupado])

  useEffect(() => {
    if (!tentativas || ocupado || !resultado?.podeRetomar || !['comprando','compra_incerta','pago','gerando','aguardando_rastreio'].includes(resultado.estado)) return
    const timer = setTimeout(() => { setTentativas(value => value - 1); void executar('gerar') }, 5000)
    return () => clearTimeout(timer)
  }, [tentativas, ocupado, resultado, executar])

  const nova = resultado?.estado === 'nova'
  const selecionada = opcoes.find(opcao => opcao.token === freteToken)
  return <section aria-label="Etiqueta Melhor Envio" className="bg-hb-black p-5 rounded-xl border border-gray-800 space-y-4">
    <h3 className="text-sm text-hb-gold uppercase flex items-center gap-2"><Package size={18} /> Etiqueta Melhor Envio</h3>
    {resultado?.entrega && <div className="text-xs text-gray-300 break-words space-y-1">
      <p>{resultado.entrega.nome} — {resultado.entrega.logradouro}, {resultado.entrega.numero} {resultado.entrega.complemento}</p>
      <p>{resultado.entrega.bairro} — {resultado.entrega.cidade}/{resultado.entrega.uf} — CEP {resultado.entrega.cep}</p>
      {resultado.usaCadastroAtual && <p className="text-yellow-400">Pedido antigo: destino obtido do cadastro atual. Confira antes de gerar.</p>}
    </div>}
    {nova && <>
      <button type="button" disabled={ocupado} onClick={() => void executar('cotar')} className="min-h-11 px-4 py-3 border border-gray-600 rounded disabled:opacity-50">
        {ocupado ? 'Consultando…' : 'Consultar fretes para este pedido'}
      </button>
      {opcoes.length > 0 && <label className="block text-sm space-y-2">Serviço e custo da etiqueta
        <select value={freteToken} onChange={event => setFreteToken(event.target.value)} disabled={ocupado} className={classeCampo}>
          {opcoes.map(opcao => <option key={opcao.servico} value={opcao.token}>{opcao.transportadora} — {opcao.nome} — {dinheiro(opcao.preco)}</option>)}
        </select>
      </label>}
      <label className="block text-sm space-y-2">Chave da NF-e deste pedido
        <input inputMode="numeric" value={notaFiscal} onChange={event => setNotaFiscal(event.target.value.replace(/\D/g, '').slice(0,44))} maxLength={44} disabled={ocupado} placeholder="44 dígitos da nota fiscal" className={classeCampo} />
      </label>
      <label className="block text-sm space-y-2">ID da agência (quando exigido pela transportadora)
        <input inputMode="numeric" value={agencia} onChange={event => setAgencia(event.target.value.replace(/\D/g, ''))} disabled={ocupado} className={classeCampo} />
      </label>
      {selecionada && <p className="text-sm text-yellow-300">Ao gerar, a compra de {dinheiro(selecionada.preco)} usa o saldo da sua carteira Melhor Envio. Confira nota fiscal, destino e medidas da embalagem.</p>}
    </>}
    {resultado?.estado === 'carrinho' && <p className="text-sm text-yellow-300">
      Ao concluir a compra, {dinheiro(resultado.custoEtiqueta || 0)} serão debitados da sua carteira Melhor Envio.
    </p>}
    <p role="status" aria-live="polite" className="text-sm text-gray-300">{resultado?.mensagem || 'Consultando pedido…'}</p>
    {erro && <p role="alert" className="text-sm text-red-400">{erro}</p>}
    {resultado?.podeRetomar && !resultado.concluido && <button type="button" disabled={ocupado || (nova && (!selecionada || notaFiscal.length !== 44))}
      onClick={() => { setTentativas(8); void executar('gerar') }}
      className="w-full min-h-11 px-4 py-3 rounded bg-hb-gold text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50">
      {ocupado ? <Loader2 className="animate-spin shrink-0" size={18} /> : <RefreshCw size={18} className="shrink-0" />}
      {ocupado ? 'Processando etiqueta…' : nova ? 'Gerar Etiqueta (Melhor Envio)' : resultado.estado === 'carrinho' ? 'Concluir compra da etiqueta' : 'Atualizar processamento da etiqueta'}
    </button>}
    {resultado?.urlEtiqueta && <a href={resultado.urlEtiqueta} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center gap-2 text-hb-gold underline"><Download size={18} /> Abrir etiqueta / PDF</a>}
    {resultado?.codigoRastreio && <p className="text-sm break-all">Rastreio: <strong>{resultado.codigoRastreio}</strong></p>}
  </section>
}
