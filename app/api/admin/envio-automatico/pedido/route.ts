import { after, NextResponse } from 'next/server'
import { ErroHttp, exigirAdmin, responderErro, validarOrigem } from '@/lib/autorizacao'
import { validarPedidoId } from '@/lib/etiquetas'
import { consultarEnvioAutomatico, processarEnvioAutomatico } from '@/lib/envio-automatico'
import { limitar, lerJson } from '@/lib/seguranca'

export const runtime = 'nodejs'
export const maxDuration = 120
const headers = { 'Cache-Control': 'private, no-store' }
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const { db, id } = await exigirAdmin(request)
    await limitar(request,'gerenciar-expedicao',60,600,String(id))
    const body = await lerJson(request), pedidoId = validarPedidoId(body?.pedidoId)
    const acao = body.acao
    if (typeof acao !== 'string' || !['retomar','documento','manual','sincronizar'].includes(acao)) throw new ErroHttp(400, 'Ação inválida.')
    const nota = acao === 'documento' ? String(body.notaFiscal || '').replace(/\s/g, '') : null
    if (nota !== null && !/^\d{44}$/.test(nota)) throw new ErroHttp(400, 'Informe a chave de 44 dígitos da NF-e.')
    if (!(await consultarEnvioAutomatico(db, pedidoId))) throw new ErroHttp(404, 'Pedido fora da fila automática.')
    const funcao = acao === 'manual' ? 'hh_envio_automatico_manual'
      : acao === 'sincronizar' ? 'hh_sincronizar_envio_automatico' : 'hh_retomar_envio_automatico'
    const { data, error } = await db.rpc(funcao, ['manual','sincronizar'].includes(acao)
      ? { p_pedido_id: pedidoId } : { p_pedido_id: pedidoId, p_nota_fiscal: nota })
    if (error) throw new ErroHttp(409, 'Não foi possível alterar agora. Aguarde o processamento e confira se a automação está ativa.')
    if (acao !== 'manual' && (acao !== 'sincronizar' || data === true)) after(async () => {
      try { await processarEnvioAutomatico(pedidoId, 2, acao === 'sincronizar') }
      catch { console.error('[envio-automatico] Pedido persistido para retry.', { pedidoId }) }
    })
    return NextResponse.json({ automatico: await consultarEnvioAutomatico(db, pedidoId) }, { status: acao === 'manual' ? 200 : 202, headers })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'JSON inválido.' }, { status: 400, headers })
    return responderErro(error)
  }
}
