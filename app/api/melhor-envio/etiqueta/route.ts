import { NextResponse } from 'next/server'
import { exigirAdmin, ErroHttp, responderErro } from '@/lib/autorizacao'
import { consultarEnvio, validarPedidoId } from '@/lib/etiquetas'
import { ambienteMelhorEnvio, ErroMelhorEnvio, melhorEnvio, requisitarMelhorEnvio } from '@/lib/melhor-envio'

export const runtime = 'nodejs'
export const maxDuration = 60
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
function redirecionar(url: string) {
  const destino = new URL(url)
  if (destino.protocol !== 'https:' || destino.username || destino.password) throw new Error('Link de impressão inválido.')
  return NextResponse.redirect(destino, { status: 303, headers })
}
export async function GET(request: Request) {
  try {
    const { db } = await exigirAdmin(request)
    const pedidoId = validarPedidoId(new URL(request.url).searchParams.get('pedidoId'))
    const envio = await consultarEnvio(db, pedidoId)
    if (!envio?.me_id || !envio.etiqueta_gerada) throw new ErroHttp(409, 'A etiqueta ainda está em processamento.')
    if (envio.ambiente !== ambienteMelhorEnvio()) throw new ErroHttp(409, 'Ambiente diferente da etiqueta original.')
    try {
      const arquivo = await requisitarMelhorEnvio('/imprimir/pdf/' + encodeURIComponent(envio.me_id))
      if (arquivo.headers.get('content-type')?.includes('application/json')) {
        const data = await arquivo.json() as { url?: string }
        if (data.url) return redirecionar(data.url)
      } else {
        const bytes = new Uint8Array(await arquivo.arrayBuffer())
        if (Buffer.from(bytes.subarray(0, 5)).toString() === '%PDF-') return new NextResponse(bytes, {
          headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="etiqueta-${pedidoId}.pdf"` },
        })
      }
    } catch (error) {
      if (!(error instanceof ErroMelhorEnvio && [400,404,422].includes(error.status))) throw error
    }
    // No sandbox, PDF direto só existe para Jadlog; demais serviços usam a impressão privada.
    const impressao = await melhorEnvio<{ url: string }>('/shipment/print', { orders: [envio.me_id], mode: 'private' })
    return redirecionar(impressao.url)
  } catch (error) { return responderErro(error) }
}
