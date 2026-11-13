import { after, NextResponse } from 'next/server'
import { exigirAdmin, responderErro, validarOrigem } from '@/lib/autorizacao'
import { configEnvioPublica, lerConfigEnvioAutomatico, salvarConfigEnvioAutomatico, processarEnvioAutomatico } from '@/lib/envio-automatico'
import { limitar, lerJson } from '@/lib/seguranca'

export const runtime = 'nodejs'
export const maxDuration = 120

const headers = { 'Cache-Control': 'private, no-store' }
export async function GET(request: Request) {
  try {
    const { db } = await exigirAdmin(request)
    const [config, pendentes] = await Promise.all([
      lerConfigEnvioAutomatico(db),
      db.from('envio_automatico_fila').select('pedido_id,estado,mensagem').in('estado', ['aguardando_documento','atencao']).limit(50),
    ])
    if (pendentes.error) throw new Error('Falha ao consultar pendências de expedição.')
    return NextResponse.json({ config: configEnvioPublica(config), pendentes: pendentes.data }, { headers })
  } catch (error) { return responderErro(error) }
}
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const { db, email, id } = await exigirAdmin(request)
    await limitar(request,'configurar-expedicao',30,600,String(id))
    const body = await lerJson(request)
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Configuração inválida.' }, { status: 400, headers })
    const config = await salvarConfigEnvioAutomatico(db, body, email)
    if (config.ativa) after(async () => {
      try { await processarEnvioAutomatico() }
      catch { console.error('[envio-automatico] Configuração salva; fila aguarda retry.') }
    })
    return NextResponse.json({ config }, { headers })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'JSON inválido.' }, { status: 400, headers })
    return responderErro(error)
  }
}
