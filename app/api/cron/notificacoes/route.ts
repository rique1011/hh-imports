import { NextResponse } from 'next/server'
import { processarNotificacoes } from '@/lib/notificacoes'
import { retomarEtiquetasPendentes } from '@/lib/etiquetas'
import { processarNotificacoesTrocas } from '@/lib/troca-notificacoes'
import { retomarReversasPendentes } from '@/lib/reversa'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== 'Bearer ' + process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })
  }
  try {
    let etiquetas = { consultadas: 0, concluidas: 0 }
    try { etiquetas = await retomarEtiquetasPendentes(2) }
    catch { console.error('[cron] Etiquetas aguardam nova conferência; fila de e-mails continua.') }
    const total = { processadas: 0, enviadas: 0, falhas: 0 }
    try { await retomarReversasPendentes(); await processarNotificacoesTrocas(10) }
    catch { console.error('[cron] Devoluções persistidas aguardam nova tentativa.') }
    for (let lote = 0; lote < 5; lote++) {
      const resultado = await processarNotificacoes(undefined, 20)
      total.processadas += resultado.processadas
      total.enviadas += resultado.enviadas
      total.falhas += resultado.falhas
      if (resultado.processadas < 20 || resultado.falhas > 0) break
    }
    return NextResponse.json({ ...total, etiquetas }, { status: total.falhas ? 503 : 200 })
  } catch (error) {
    console.error('[cron] Falha ao retomar notificacoes:', error)
    return NextResponse.json({ error: 'Falha ao processar fila.' }, { status: 503 })
  }
}
