import { exigirAdmin, validarOrigem, responderErro } from '@/lib/autorizacao'
import { NextResponse } from 'next/server'

// O fluxo atual resolve o destinatário no banco e só envia códigos persistidos.
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    await exigirAdmin(request)
    return NextResponse.json({ error: 'Use a ação Reenviar última atualização na Central de Trocas.' }, { status: 410 })
  } catch (e) { return responderErro(e) }
}
