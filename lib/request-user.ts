import 'server-only'
import { getToken } from 'next-auth/jwt'
import { NextRequest } from 'next/server'

export async function getRequestUser(request: Request) {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('Configure NEXTAUTH_SECRET.')
  const req = request instanceof NextRequest ? request
    : new NextRequest(request.url, { headers: request.headers })
  const token = await getToken({ req, secret }).catch(() => null)
  if (!token?.email || !token.sub || !Number.isInteger(token.sessaoVersao)) return null
  return {
    id: token.sub, sessaoVersao: token.sessaoVersao, mfa: token.mfa===true, senhaAtual: token.senhaAtual===true,
    email: String(token.email).toLowerCase().trim(),
    name: typeof token.name === 'string' ? token.name : 'Cliente',
  }
}
