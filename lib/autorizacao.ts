import 'server-only'
import { NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/request-user'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export class ErroHttp extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export function validarOrigem(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) throw new ErroHttp(403, 'Origem não autorizada.')
}

export async function exigirUsuario(request: Request) {
  const session = await getRequestUser(request)
  if (!session) throw new ErroHttp(401, 'Faça login para continuar.')
  const db = getSupabaseAdmin()
  const { data, error } = await db.from('usuarios')
    .select('id,email,nome,perfil,role,email_verificado').eq('email', session.email).single()
  if (error || !data || !data.email_verificado) throw new ErroHttp(401, 'Sessão inválida.')
  return { id: data.id as string | number, email: String(data.email), nome: String(data.nome || 'Cliente'),
    admin: [data.perfil, data.role].some(value => value === 'admin'), db }
}

export async function exigirAdmin(request: Request) {
  const user = await exigirUsuario(request)
  if (!user.admin) throw new ErroHttp(403, 'Acesso restrito ao administrador.')
  return user
}

export function responderErro(error: unknown) {
  if (error instanceof ErroHttp) return NextResponse.json({ error: error.message }, { status: error.status })
  // Erros do provedor podem conter detalhes internos. A resposta pública é estável.
  console.error('[api] Operação recusada ou indisponível:', error instanceof Error ? error.message : 'erro do provedor')
  return NextResponse.json({ error: 'Não foi possível concluir a operação.' }, { status: 500 })
}
