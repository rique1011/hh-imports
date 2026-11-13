import { NextResponse, after } from 'next/server'
import { exigirAdmin, validarOrigem, responderErro } from '@/lib/autorizacao'
import { processarNotificacoes } from '@/lib/notificacoes'
import { limitar, lerJson } from '@/lib/seguranca'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user=await exigirAdmin(request)
    await limitar(request,'notificacao-admin',30,600,String(user.id))
    const { pedidoId } = await lerJson(request)
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
