import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { processarEnvioAutomatico } from '@/lib/envio-automatico'

export const runtime = 'nodejs'
export const maxDuration = 120
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const recebido = Buffer.from(request.headers.get('authorization') || '')
  const esperado = Buffer.from('Bearer ' + (secret || ''))
  if (!secret || recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  try {
    const inicio = Date.now(), resultados = []
    // Abre outro trabalho só com folga para o pior caso de chamadas ao provedor.
    for (let indice = 0; indice < 3 && Date.now() - inicio < 15000; indice++) {
      const resultado = await processarEnvioAutomatico()
      resultados.push(resultado)
      if (!resultado.processado) break
    }
    return NextResponse.json({ resultados }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    console.error('[envio-automatico] Fila persistida para próxima execução.')
    return NextResponse.json({ error: 'Expedição pendente para nova tentativa.' }, { status: 503 })
  }
}
