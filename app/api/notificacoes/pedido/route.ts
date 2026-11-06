import { NextResponse, after } from 'next/server'
import { exigirAdmin, validarOrigem, responderErro } from '@/lib/autorizacao'
import { processarNotificacoes } from '@/lib/notificacoes'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: Request) {
  try {
    validarOrigem(request)
    await exigirAdmin(request)
    const { pedidoId } = await request.json()
    if (!pedidoId) return NextResponse.json({ error: 'Pedido invalido.' }, { status: 400 })
    after(async () => {
      try { await processarNotificacoes(String(pedidoId), 6) }
      catch (error) { console.error('[admin] Notificacoes pendentes:', error) }
    })
    return NextResponse.json({ sucesso: true })
  } catch (error) {
    return responderErro(error)
  }
}
