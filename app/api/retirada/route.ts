import { NextResponse } from 'next/server'
import { getConfigRetirada } from '@/lib/retirada-servidor'
export async function GET() {
  try {
    const c = await getConfigRetirada()
    return NextResponse.json(c.ativa ? c : { ativa: false }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ ativa: false }, { headers: { 'Cache-Control': 'no-store' } }) }
}
