import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sincronizarRecebimentos } from '@/lib/recebimento-automatico'
import { processarNotificacoes } from '@/lib/notificacoes'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const recebido = Buffer.from(request.headers.get('authorization') || '')
  const esperado = Buffer.from('Bearer ' + (secret || ''))
  if (!secret || recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }
  try {
    const resultado = await sincronizarRecebimentos(getSupabaseAdmin())
    if (resultado.entregues > 0) {
      // Falha de e-mail não desfaz a entrega; o cron de notificações retoma a fila.
      try { await processarNotificacoes(undefined, 30) }
      catch { console.error('[recebimento] Notificações aguardam a próxima execução da fila.') }
    }
    return NextResponse.json(resultado, { status: resultado.falhas ? 503 : 200, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Conferência de entregas pendente para nova tentativa.' }, { status: 503 })
  }
}
