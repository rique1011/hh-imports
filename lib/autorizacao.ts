import 'server-only'
import { FalhaSeguranca } from '@/lib/seguranca'
import { NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/request-user'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export class ErroHttp extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export function validarOrigem(request: Request) {
  const url = new URL(request.url), host = request.headers.get('host')
  let origemLocal = url.origin
  // Next pode normalizar request.url para o hostname interno. Host é o
  // destino HTTP real; não aceitamos X-Forwarded-Host arbitrário do cliente.
  if (host) {
    if (/[\s/\\?#@]/.test(host)) throw new ErroHttp(403, 'Origem não autorizada.')
    try { origemLocal = new URL(`${url.protocol}//${host}`).origin }
    catch { throw new ErroHttp(403, 'Origem não autorizada.') }
  }
  const site = request.headers.get('sec-fetch-site')
  if (site === 'cross-site') throw new ErroHttp(403, 'Origem não autorizada.')
  const origin = request.headers.get('origin')
  if (origin && origin !== origemLocal) throw new ErroHttp(403, 'Origem não autorizada.')
  // Cookies são enviados automaticamente pelo navegador. Sem Origin, exige
  // Referer local; clientes que autenticam por Bearer não dependem de cookies.
  if (!origin && request.headers.has('cookie')) {
    let origemReferer = ''
    try { origemReferer = new URL(request.headers.get('referer') || '').origin } catch {}
    if (origemReferer !== origemLocal) throw new ErroHttp(403, 'Origem não autorizada.')
  }
}

export async function exigirUsuario(request: Request, restrita = false) {
  const session = await getRequestUser(request)
  if (!session) throw new ErroHttp(401, 'Faça login para continuar.')
  const db = getSupabaseAdmin()
  const { data, error } = await db.from('usuarios')
    .select('id,email,nome,perfil,role,email_verificado,sessao_versao,bloqueado,senha_politica_versao,mfa_secret').eq('email', session.email).single()
  if (error || !data || !data.email_verificado || data.bloqueado || String(data.id)!==session.id || data.sessao_versao!==session.sessaoVersao) throw new ErroHttp(401, 'Sessão inválida.')
  const administrador = [data.perfil, data.role].some(value => value === 'admin')
  if (!restrita && (!session.senhaAtual || data.senha_politica_versao!==1)) throw new ErroHttp(403, administrador ? 'Atualize sua senha em Minha conta > Segurança.' : 'Atualize sua senha em Minha conta > Meus dados.')
  return { administrador, mfa:session.mfa, versao:data.sessao_versao as number, mfaAtiva:administrador && !!data.mfa_secret, id: data.id as string | number, email: String(data.email), nome: String(data.nome || 'Cliente'),
    admin: administrador && session.mfa && !!data.mfa_secret, db }
}

export async function exigirAdmin(request: Request) {
  const user = await exigirUsuario(request)
  if (!user.admin) throw new ErroHttp(403, 'Acesso restrito ao administrador.')
  if (!user.mfa || !user.mfaAtiva) throw new ErroHttp(403, 'Ative a autenticação por aplicativo em Minha conta > Segurança e entre novamente.')
  return user
}

export function responderErro(error: unknown) {
  if (error instanceof ErroHttp || error instanceof FalhaSeguranca) return NextResponse.json({ error: error.message }, { status: error.status })
  // Erros do provedor podem conter detalhes internos. A resposta pública é estável.
  console.error('[api] Operação recusada ou indisponível.')
  return NextResponse.json({ error: 'Não foi possível concluir a operação.' }, { status: 500 })
}
