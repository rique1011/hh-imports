'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Truck } from 'lucide-react'
import type { ConfigEnvioAutomatico } from '@/types/envio'

interface Pendente { pedido_id: string | number; mensagem: string }
const campo = 'w-full min-w-0 rounded border border-gray-700 bg-gray-900 p-3 text-base text-white'
async function buscarConfig(signal?: AbortSignal): Promise<{ config: ConfigEnvioAutomatico; pendentes: Pendente[] }> {
  const response = await fetch('/api/admin/envio-automatico', { cache: 'no-store', signal })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Não foi possível consultar a expedição.')
  return data
}

export default function EnvioAutomaticoConfig({ onAbrirPedido }: { onAbrirPedido: (id: string) => void }) {
  const [config, setConfig] = useState<ConfigEnvioAutomatico | null>(null)
  const [limite, setLimite] = useState('')
  const [documento, setDocumento] = useState<'nfe' | 'declaracao'>('nfe')
  const [declaracao, setDeclaracao] = useState(false)
  const [agencia, setAgencia] = useState('')
  const [pendentes, setPendentes] = useState<Pendente[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  const aplicar = useCallback((data: { config: ConfigEnvioAutomatico; pendentes: Pendente[] }) => {
    const atual = data.config
    setConfig(atual); setLimite(atual.limiteReais?.toString() || '')
    setDocumento(atual.documentoFiscal); setDeclaracao(atual.declaracaoConfirmada)
    setAgencia(atual.agencia?.toString() || ''); setPendentes(data.pendentes || [])
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    buscarConfig(controller.signal).then(aplicar).catch(error => { if (!controller.signal.aborted) setErro(error.message) })
    return () => controller.abort()
  }, [aplicar])

  async function salvar(ativa: boolean) {
    setOcupado(true); setErro(''); setMensagem('')
    try {
      const response = await fetch('/api/admin/envio-automatico', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativa, limiteReais: limite.replace(',', '.') || null, documentoFiscal: documento,
          declaracaoConfirmada: declaracao, agencia: agencia || null }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar a configuração.')
      setConfig(data.config)
      setMensagem(ativa ? 'Compra automática ativada para os próximos pagamentos confirmados.' : 'Compra automática pausada. Operações já iniciadas podem concluir.')
    } catch (error) { setErro(error instanceof Error ? error.message : 'Falha de comunicação.') }
    finally { setOcupado(false) }
  }
  async function atualizar() {
    setOcupado(true); setErro('')
    try { aplicar(await buscarConfig()) }
    catch (error) { setErro(error instanceof Error ? error.message : 'Falha de comunicação.') }
    finally { setOcupado(false) }
  }
  return <section aria-label="Expedição automática" className="mb-8 min-w-0 space-y-4 rounded-xl border border-gray-800 bg-hb-gray p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg text-white"><Truck className="shrink-0 text-hb-gold" size={22} /> Expedição automática</h2>
      <span className={config?.ativa ? 'text-sm text-green-400' : 'text-sm text-yellow-300'}>{config ? config.ativa ? 'Ativa' : 'Desativada' : 'Consultando…'}</span>
    </div>
    <p className="text-sm text-gray-400">Após o pagamento confirmado, a loja compra a etiqueta com seu saldo do Melhor Envio e disponibiliza o PDF nos detalhes do pedido.</p>
    {config && <details open={!config.ativa}>
      <summary className="min-h-11 cursor-pointer py-3 text-sm text-hb-gold">Configurar compra de etiquetas</summary>
      <form onSubmit={event => { event.preventDefault(); void salvar(true) }} className="space-y-4 pt-3">
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="block min-w-0 space-y-2 text-sm">Limite por etiqueta (R$)
            <input required inputMode="decimal" value={limite} onChange={event => setLimite(event.target.value)} placeholder="Ex.: 35,00" disabled={ocupado} className={campo} />
          </label>
          <label className="block min-w-0 space-y-2 text-sm">Documento dos envios
            <select value={documento} onChange={event => { setDocumento(event.target.value as 'nfe' | 'declaracao'); setDeclaracao(false) }} disabled={ocupado} className={campo}>
              <option value="nfe">NF-e — informar chave por pedido</option>
              <option value="declaracao">Declaração de conteúdo (quando permitida)</option>
            </select>
          </label>
        </div>
        {documento === 'declaracao' ? <label className="flex items-start gap-3 text-sm text-yellow-200">
          <input type="checkbox" required checked={declaracao} onChange={event => setDeclaracao(event.target.checked)} disabled={ocupado} className="mt-1 size-5 shrink-0 accent-yellow-500" />
          Confirmo que os envios automáticos estão dispensados de NF-e e podem usar declaração de conteúdo. Ter CPF, por si só, não confirma essa dispensa.
        </label> : <p className="text-sm text-gray-400">Os pedidos aguardam a chave da NF-e no painel. Depois de informada, a compra e a geração continuam automaticamente.</p>}
        <p className="text-sm text-gray-400">O serviço escolhido pelo cliente é mantido. No frete grátis sem serviço escolhido, a loja usa o menor preço disponível entre PAC e SEDEX. Valores acima do limite ficam para sua revisão.</p>
        <label className="block space-y-2 text-sm">ID da agência (opcional, quando a transportadora exigir)
          <input inputMode="numeric" value={agencia} onChange={event => setAgencia(event.target.value.replace(/\D/g, ''))} disabled={ocupado} className={campo} />
        </label>
        <p className="text-sm text-gray-400">Confira o saldo, os dados do remetente e o peso e medidas reais das embalagens antes de ativar. As novas configurações também são aplicadas quando você retoma uma pendência.</p>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={ocupado} className="min-h-11 rounded bg-hb-gold px-4 py-3 font-bold text-black disabled:opacity-50">
            {ocupado ? 'Salvando…' : config.ativa ? 'Salvar configurações' : 'Ativar compra automática'}
          </button>
          {config.ativa && <button type="button" disabled={ocupado} onClick={() => void salvar(false)} className="min-h-11 rounded border border-gray-600 px-4 py-3 disabled:opacity-50">Pausar automação</button>}
        </div>
      </form>
    </details>}
    {mensagem && <p role="status" className="text-sm text-green-400">{mensagem}</p>}
    {erro && <p role="alert" className="text-sm text-red-400">{erro}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 pt-3">
      <p className="text-sm">{pendentes.length ? `${pendentes.length} pedido(s) precisam de atenção` : 'Nenhuma pendência de expedição na consulta.'}</p>
      <button type="button" disabled={ocupado} onClick={() => void atualizar()} className="inline-flex min-h-11 items-center gap-2 rounded px-3 py-2 text-sm text-hb-gold disabled:opacity-50">
        {ocupado ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Atualizar pendências
      </button>
    </div>
    {pendentes.length > 0 && <ul className="max-h-64 space-y-2 overflow-y-auto">
      {pendentes.map(item => <li key={item.pedido_id} className="min-w-0 rounded border border-gray-800 p-3 text-sm">
        <button type="button" onClick={() => onAbrirPedido(String(item.pedido_id))} className="min-h-11 text-hb-gold underline">Abrir pedido #{item.pedido_id}</button>
        <p className="break-words text-gray-400">{item.mensagem}</p>
      </li>)}
    </ul>}
  </section>
}
