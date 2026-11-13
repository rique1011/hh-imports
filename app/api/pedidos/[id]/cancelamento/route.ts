import { after, NextResponse } from 'next/server'
import { exigirUsuario, validarOrigem, responderErro } from '@/lib/autorizacao'
import { lerJson, limitar } from '@/lib/seguranca'
import { solicitarCancelamento, processarCancelamentos, validarIdCancelamento } from '@/lib/cancelamentos'
import { processarNotificacoes } from '@/lib/notificacoes'

export const runtime = 'nodejs'
export const maxDuration = 120
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    validarOrigem(request)
    const user = await exigirUsuario(request)
    await limitar(request, 'cancelar-pedido', 10, 600, String(user.id))
    const id = validarIdCancelamento((await params).id)
    await solicitarCancelamento(user.db, user, id, await lerJson(request))
    after(async () => {
      try { await processarCancelamentos(id); await processarNotificacoes(id, 8) }
      catch { console.error('[cancelamento] Solicitação persistida aguarda nova tentativa.', { pedidoId: id }) }
    })
    return NextResponse.json({ sucesso: true, mensagem: 'Cancelamento registrado. Acompanhe a confirmação do reembolso neste pedido.' }, { status: 202, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return responderErro(error) }
}
