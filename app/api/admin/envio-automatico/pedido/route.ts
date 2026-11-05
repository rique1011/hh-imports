import { after, NextResponse } from 'next/server'
import { ErroHttp, exigirAdmin, responderErro, validarOrigem } from '@/lib/autorizacao'
import { validarPedidoId } from '@/lib/etiquetas'
import { consultarEnvioAutomatico, processarEnvioAutomatico } from '@/lib/envio-automatico'

export const runtime = 'nodejs'
export const maxDuration = 120
const headers = { 'Cache-Control': 'private, no-store' }
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const { db } = await exigirAdmin(request)
    const body = await request.json(), pedidoId = validarPedidoId(body?.pedidoId)
    if (!['retomar','documento','manual','sincronizar'].includes(body.acao)) throw new ErroHttp(400, 'Ação inválida.')
    const nota = body.acao === 'documento' ? String(body.notaFiscal || '').replace(/\s/g, '') : null
    if (nota !== null && !/^\d{44}$/.test(nota)) throw new ErroHttp(400, 'Informe a chave de 44 dígitos da NF-e.')
    if (!(await consultarEnvioAutomatico(db, pedidoId))) throw new ErroHttp(404, 'Pedido fora da fila automática.')
    const funcao = body.acao === 'manual' ? 'hh_envio_automatico_manual'
      : body.acao === 'sincronizar' ? 'hh_sincronizar_envio_automatico' : 'hh_retomar_envio_automatico'
    const { data, error } = await db.rpc(funcao, ['manual','sincronizar'].includes(body.acao)
      ? { p_pedido_id: pedidoId } : { p_pedido_id: pedidoId, p_nota_fiscal: nota })
    if (error) throw new ErroHttp(409, 'Não foi possível alterar agora. Aguarde o processamento e confira se a automação está ativa.')
    if (body.acao !== 'manual' && (body.acao !== 'sincronizar' || data === true)) after(async () => {
      try { await processarEnvioAutomatico(pedidoId, 2, body.acao === 'sincronizar') }
      catch { console.error('[envio-automatico] Pedido persistido para retry.', { pedidoId }) }
    })
    return NextResponse.json({ automatico: await consultarEnvioAutomatico(db, pedidoId) }, { status: body.acao === 'manual' ? 200 : 202, headers })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'JSON inválido.' }, { status: 400, headers })
    return responderErro(error)
  }
}
