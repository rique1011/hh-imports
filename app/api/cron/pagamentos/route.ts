import { timingSafeEqual } from 'node:crypto'
import { after, NextResponse } from 'next/server'
import { conciliarPagamentosPendentes } from '@/lib/pagamentos'
import { processarNotificacoes } from '@/lib/notificacoes'
export const runtime = 'nodejs'
export const maxDuration = 180
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET, recebido = request.headers.get('authorization') || ''
  const esperado = secret ? 'Bearer ' + secret : ''
  const atual = Buffer.from(recebido), correto = Buffer.from(esperado)
  if (!esperado || atual.length !== correto.length || !timingSafeEqual(atual, correto)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  try {
    const resultado = await conciliarPagamentosPendentes()
    if (resultado.confirmados || resultado.revisoes) after(async () => { await processarNotificacoes(undefined, 20) })
    return NextResponse.json(resultado)
  } catch { return NextResponse.json({ error: 'A conferência será tentada novamente.' }, { status: 503 }) }
}
