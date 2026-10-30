'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Clock3, Loader2 } from 'lucide-react'
import { useCart } from '@/lib/store'

const pagos = new Set(['pago','confirmado','processando','enviado','entregue'])
function Confirmacao() {
  const id = useSearchParams().get('external_reference')
  const limpar = useCart(state => state.limparCarrinho)
  const [estado, setEstado] = useState<{ status?: string; erro?: string; carregando: boolean }>({ carregando: true })
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let chamadas = 0
    async function consultar() {
      if (document.hidden) { timer = setTimeout(consultar, 1500); return }
      try {
        const response = await fetch('/api/pedidos/' + encodeURIComponent(id!), { cache: 'no-store', signal: controller.signal })
        const pedido = await response.json()
        if (!response.ok) { setEstado({ carregando: false, erro: response.status === 401 ? 'Entre na sua conta para consultar o pedido.' : 'Pedido indisponível para esta conta.' }); return }
        const status = String(pedido.status || '').toLowerCase()
        setEstado({ status, carregando: false })
        if (pagos.has(status)) { limpar(); return }
        if (status === 'pendente' && ++chamadas < 20) timer = setTimeout(consultar, 1500)
      } catch {
        if (!controller.signal.aborted) setEstado({ carregando: false, erro: 'Não foi possível consultar o pagamento. Tente novamente.' })
      }
    }
    consultar()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [id, tentativa, limpar])
  const confirmado = pagos.has(estado.status || '')
  return <main className="min-h-[75vh] px-4 py-12 flex items-center justify-center">
    <section className="w-full max-w-md text-center space-y-6" aria-live="polite">
      {estado.carregando && id ? <Loader2 className="animate-spin mx-auto text-hb-gold" size={40} /> : confirmado ? <CheckCircle2 className="mx-auto text-green-400" size={48} /> : <Clock3 className="mx-auto text-hb-gold" size={48} />}
      <h1 className="text-2xl uppercase tracking-wide">{!id ? 'Pedido não informado' : confirmado ? 'Pagamento confirmado' : estado.carregando ? 'Consultando pagamento' : 'Confirmação do pedido'}</h1>
      <p className="text-sm text-gray-400">{!id ? 'Acesse sua conta para localizar sua compra.' : estado.erro || (confirmado ? 'Recebemos a confirmação do pagamento. Você pode acompanhar sua compra na sua conta.' : estado.status === 'cancelado' ? 'Este pedido foi cancelado.' : 'O pagamento ainda não foi confirmado. A aprovação será exibida após a atualização do pedido.')}</p>
      {id && <p className="break-all text-sm text-hb-gold">Pedido #{id}</p>}
      {id && !confirmado && !estado.carregando && <button className="min-h-11 w-full border border-gray-700 px-4 py-3 rounded" onClick={() => setTentativa(t => t + 1)}>Atualizar status</button>}
      <Link className="min-h-11 flex items-center justify-center bg-hb-gold text-hb-black rounded px-4 py-3 font-bold" href="/minha-conta">Acompanhar pedido</Link>
      <Link className="min-h-11 flex items-center justify-center text-gray-400" href="/login">Entrar na conta</Link>
    </section>
  </main>
}
export default function Sucesso() { return <Suspense fallback={<div className="min-h-[70vh] grid place-items-center"><Loader2 className="animate-spin" /></div>}><Confirmacao /></Suspense> }
