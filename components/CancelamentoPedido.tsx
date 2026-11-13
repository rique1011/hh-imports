'use client'
import { useEffect, useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/Modal'
import type { Pedido } from '@/types/loja'

export default function CancelamentoPedidoInfo({ pedido, onAtualizado, admin = false, disabled = false }: {
  pedido: Pedido; onAtualizado: () => Promise<void> | void; admin?: boolean; disabled?: boolean
}) {
  const [confirmar, setConfirmar] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [motivo, setMotivo] = useState(admin ? '' : 'Desisti da compra')
  const c = pedido.cancelamento
  useEffect(() => {
    if (!admin || c?.estado !== 'reembolso_pendente') return
    const atualizar = () => { if (!document.hidden) void Promise.resolve().then(onAtualizado).catch(() => {}) }
    atualizar()
    const timer = setInterval(atualizar, 15_000)
    window.addEventListener('focus', atualizar)
    return () => { clearInterval(timer); window.removeEventListener('focus', atualizar) }
  }, [admin, c?.estado, onAtualizado])
  if (pedido.retirada || (!c && !pedido.pode_cancelar)) return null

  async function agir(acao: 'cancelar' | 'retomar') {
    setOcupado(true)
    try {
      const res = await fetch(admin ? '/api/admin/cancelamentos' : '/api/pedidos/' + encodeURIComponent(pedido.id) + '/cancelamento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, pedidoId: String(pedido.id), confirmar: true, motivo }),
      })
      const body = await res.json()
      if (!res.ok) throw Error(body.error || 'Não foi possível registrar o cancelamento.')
      setConfirmar(false)
      toast.success(acao === 'cancelar' ? 'Cancelamento registrado. Acompanhe o reembolso neste pedido.' : 'Conferência do reembolso solicitada.')
      await onAtualizado()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o pedido.') }
    finally { setOcupado(false) }
  }

  return <section aria-label={'Cancelamento do pedido #' + pedido.id} className="mb-6 min-w-0 rounded-xl border border-hb-gold/30 bg-hb-gold/5 p-4 text-sm leading-6 sm:p-6">
    <h3 className="flex items-center gap-2 font-serif text-xl text-hb-goldLight"><RotateCcw size={18} aria-hidden="true" />Cancelamento e reembolso</h3>
    {!c && <><p className="mt-3 text-gray-300">O envio deste pedido ainda não foi iniciado. O cancelamento solicita a devolução integral do valor pago, incluindo o frete cobrado.</p>
      <button type="button" disabled={ocupado || disabled} onClick={() => setConfirmar(true)} className="luxury-button luxury-button-outline mt-4 w-full sm:w-auto">Cancelar pedido e solicitar reembolso</button></>}
    {c?.estado === 'reembolso_pendente' && <><p role="status" className="mt-3 text-amber-200">Cancelamento registrado. O pedido está bloqueado para envio e o reembolso está em processamento.</p>
      <p className="mt-2 text-gray-300">O valor só será marcado como devolvido após a confirmação do Mercado Pago. Créditos usados voltam ao saldo da loja após a conclusão. O prazo para aparecer na conta ou fatura depende do meio de pagamento.</p>
      {admin && <><p className="mt-3 break-words text-gray-400">Motivo: {c.motivo}</p>{c.erro && <p role="alert" className="mt-3 text-red-300">{c.erro}</p>}
        <button type="button" disabled={ocupado || disabled} onClick={() => void agir('retomar')} className="luxury-button luxury-button-outline mt-4 w-full sm:w-auto">{ocupado ? <Loader2 size={18} className="animate-spin" aria-label="Consultando" /> : 'Consultar e retomar reembolso'}</button></>}
    </>}
    {c?.estado === 'cancelado' && <p role="status" className="mt-3 text-green-300">Cancelamento concluído{c.reembolsado_em ? ' em ' + new Date(c.reembolsado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : ''}. O reembolso integral foi confirmado e os créditos usados voltaram ao saldo. O prazo para aparecer na conta ou fatura depende do meio de pagamento.</p>}
    {confirmar && <Modal onClose={() => { if (!ocupado) setConfirmar(false) }} labelledBy={'cancelar-pedido-' + pedido.id} className="w-full max-w-lg border border-hb-gold/30 bg-hb-black p-5 text-white sm:p-7">
      <h3 id={'cancelar-pedido-' + pedido.id} className="font-serif text-2xl text-hb-goldLight">Cancelar pedido #{pedido.id}?</h3>
      <p className="my-4 text-sm leading-7 text-gray-300">O pedido não será mais enviado. Solicitaremos o reembolso integral pelo meio de pagamento original. Créditos usados voltam ao saldo da loja. O prazo para receber depende do provedor.</p>
      <form onSubmit={event => { event.preventDefault(); void agir('cancelar') }}>
        <label htmlFor={'motivo-cancelamento-' + pedido.id} className="block text-sm text-gray-300">Motivo do cancelamento</label>
        <textarea id={'motivo-cancelamento-' + pedido.id} required minLength={3} maxLength={500} rows={3} value={motivo} disabled={ocupado} onChange={event => setMotivo(event.target.value)} className="mt-2 w-full resize-y rounded border border-gray-700 bg-hb-gray p-3 text-base text-white outline-none focus:border-hb-gold" />
        <button disabled={ocupado || disabled || motivo.trim().length < 3} className="luxury-button luxury-button-solid mt-5 w-full">{ocupado ? <Loader2 size={18} className="animate-spin" aria-label="Registrando" /> : 'Confirmar cancelamento e reembolso'}</button>
        <button type="button" disabled={ocupado} onClick={() => setConfirmar(false)} className="luxury-button luxury-button-outline mt-3 w-full">Manter pedido</button>
      </form>
    </Modal>}
  </section>
}
