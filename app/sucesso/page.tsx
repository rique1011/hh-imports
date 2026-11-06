'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useCart } from '@/lib/store'
import { STATUS_PAGOS } from '@/lib/pagamento-pedido'
function Confirmacao() {
  const params = useSearchParams(), router = useRouter()
  const id = params.get('pedido') || params.get('external_reference')
  const paymentId = params.get('payment_id') || params.get('collection_id')
  const limpar = useCart(state => state.limparCarrinho)
  const [erro, setErro] = useState('')
  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    async function consultar() {
      try {
        const response = await fetch('/api/pedidos/' + encodeURIComponent(id!), { cache: 'no-store', signal: controller.signal })
        let pedido = await response.json()
        if (!response.ok) throw new Error(response.status === 401 ? 'Entre na sua conta para consultar o pedido.' : 'Pedido indisponível para esta conta.')
        if (pedido.status?.toLowerCase() === 'pendente') {
          const sync = await fetch('/api/pedidos/' + encodeURIComponent(id!) + '/pagamento', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...(paymentId && /^\d+$/.test(paymentId) ? { paymentId } : {}) }), signal: controller.signal })
          if (sync.ok) pedido = await sync.json()
        }
        if (controller.signal.aborted) return
        const pago = STATUS_PAGOS.has(String(pedido.status).toLowerCase())
        if (pago || pedido.pagamento?.status === 'approved') {limpar();sessionStorage.removeItem('hh-checkout-idempotencia')}
        router.replace('/minha-conta?aba=pedidos&pedido=' + encodeURIComponent(id!) + (pago ? '&pagamento=confirmado' : ''))
      } catch (e) { if (!controller.signal.aborted) setErro((e as Error).message) }
    }
    consultar()
    return () => controller.abort()
  }, [id, paymentId, limpar, router])
  return <main className="min-h-[70vh] grid place-items-center px-4 py-12"><section className="max-w-md text-center space-y-6" aria-live="polite">
    {id && !erro && <Loader2 className="mx-auto animate-spin text-hb-gold" size={40} />}
    <h1 className="text-2xl">{erro ? 'Acompanhe seu pedido' : id ? 'Conferindo pagamento' : 'Pedido não informado'}</h1>
    <p className="text-sm text-gray-400">{erro || (id ? 'Estamos consultando a confirmação para abrir seus pedidos.' : 'Acesse sua conta para localizar sua compra.')}</p>
    <Link className="min-h-11 flex items-center justify-center bg-hb-gold text-black rounded px-5 py-3 font-bold" href={'/minha-conta?aba=pedidos' + (id ? '&pedido=' + encodeURIComponent(id) : '')}>Meus pedidos</Link>
    {erro && <Link href="/login" className="min-h-11 inline-flex items-center text-sm text-gray-400">Entrar na conta</Link>}
  </section></main>
}
export default function Sucesso() { return <Suspense fallback={<div className="min-h-[70vh] grid place-items-center"><Loader2 className="animate-spin" /></div>}><Confirmacao /></Suspense> }
