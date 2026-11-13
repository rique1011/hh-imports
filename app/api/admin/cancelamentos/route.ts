import { after, NextResponse } from 'next/server'
import { exigirAdmin, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
import { lerJson, limitar } from '@/lib/seguranca'
import { solicitarCancelamento, processarCancelamentos, validarIdCancelamento } from '@/lib/cancelamentos'
import { processarNotificacoes } from '@/lib/notificacoes'

export const runtime = 'nodejs'
export const maxDuration = 120
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirAdmin(request)
    await limitar(request, 'cancelar-pedido-admin', 30, 600, String(user.id))
    const body = await lerJson(request), id = validarIdCancelamento(body.pedidoId)
    if (body.acao === 'cancelar') await solicitarCancelamento(user.db, user, id, body, true)
    else if (body.acao === 'retomar') {
      const { error } = await user.db.rpc('hh_retomar_cancelamento_entrega', { p_pedido_id: id })
      if (error) throw new ErroHttp(409, 'Cancelamento concluído ou já em processamento. Atualize os detalhes.')
    } else throw new ErroHttp(400, 'Ação inválida.')
    after(async () => {
      try { await processarCancelamentos(id); await processarNotificacoes(id, 8) }
      catch { console.error('[cancelamento] A fila retomará o processamento.', { pedidoId: id }) }
    })
    return NextResponse.json({ sucesso: true }, { status: 202, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return responderErro(error) }
}
