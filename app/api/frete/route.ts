import { NextResponse } from 'next/server'
import { calcularFrete } from '@/lib/frete'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    const { cepDestino } = await request.json()
    if (typeof cepDestino !== 'string' || !/^\d{8}$/.test(cepDestino.replace(/\D/g, ''))) return NextResponse.json({ error: 'CEP inválido.' }, { status: 400 })
    const opcoes = await calcularFrete(cepDestino.replace(/\D/g, ''))
    return NextResponse.json({ opcoes })
  } catch (error) {
    console.error('[frete]', error instanceof Error ? error.message : 'Falha no fornecedor')
    return NextResponse.json({ error: 'Frete indisponível. Tente novamente.' }, { status: 503 })
  }
}
