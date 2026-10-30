import { NextResponse, after } from 'next/server'
import { getRequestUser } from '@/lib/request-user'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { processarNotificacoes } from '@/lib/notificacoes'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request)
    if (!user) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })
    const db = getSupabaseAdmin()
    const { data: usuario, error: userError } = await db.from('usuarios').select('*')
      .eq('email', user.email).single()
    const isAdmin = [usuario?.perfil, usuario?.role].some(role =>
      typeof role === 'string' && role.toLowerCase() === 'admin')
    if (userError || !isAdmin) {
      return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 })
    }
    const { pedidoId } = await request.json()
    if (!pedidoId) return NextResponse.json({ error: 'Pedido invalido.' }, { status: 400 })
    after(async () => {
      try { await processarNotificacoes(String(pedidoId), 6) }
      catch (error) { console.error('[admin] Notificacoes pendentes:', error) }
    })
    return NextResponse.json({ sucesso: true })
  } catch (error) {
    console.error('[admin] Falha ao iniciar notificacoes:', error)
    return NextResponse.json({ error: 'Falha ao iniciar notificacoes.' }, { status: 500 })
  }
}
