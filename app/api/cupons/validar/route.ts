import { NextResponse } from 'next/server'
import { exigirUsuario, validarOrigem, responderErro } from '@/lib/autorizacao'
import { validarCupom } from '@/lib/cupons'
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirUsuario(request)
    const { codigo } = await request.json()
    const cupom = await validarCupom(user.db, user.email, codigo)
    return NextResponse.json(cupom, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return responderErro(error) }
}
