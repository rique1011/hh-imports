import { NextResponse } from 'next/server'
import { processarNotificacoes } from '@/lib/notificacoes'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== 'Bearer ' + process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })
  }
  try {
    const total = { processadas: 0, enviadas: 0, falhas: 0 }
    for (let lote = 0; lote < 5; lote++) {
      const resultado = await processarNotificacoes(undefined, 20)
      total.processadas += resultado.processadas
      total.enviadas += resultado.enviadas
      total.falhas += resultado.falhas
      if (resultado.processadas < 20 || resultado.falhas > 0) break
    }
    return NextResponse.json(total, { status: total.falhas ? 503 : 200 })
  } catch (error) {
    console.error('[cron] Falha ao retomar notificacoes:', error)
    return NextResponse.json({ error: 'Falha ao processar fila.' }, { status: 503 })
  }
}
