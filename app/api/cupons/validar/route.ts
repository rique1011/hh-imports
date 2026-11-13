import { NextResponse } from 'next/server'
import { exigirUsuario, validarOrigem, responderErro } from '@/lib/autorizacao'
import { validarCupom } from '@/lib/cupons'
import { limitar, lerJson } from '@/lib/seguranca'
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirUsuario(request)
    await limitar(request,'validar-cupom',30,60,String(user.id))
    const { codigo } = await lerJson(request)
    const cupom = await validarCupom(user.db, user.email, codigo)
    return NextResponse.json(cupom, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return responderErro(error) }
}
