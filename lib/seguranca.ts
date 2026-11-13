import 'server-only'
import { createHash, createHmac, randomBytes, randomInt, createCipheriv, createDecipheriv } from 'node:crypto'
import { isIP } from 'node:net'
import * as OTPAuth from 'otpauth'
import bcrypt from 'bcryptjs'
import { minimoSenha } from '@/lib/politica-senha'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
// Mantém este módulo independente de autorizacao (também usado pelo login).
export class FalhaSeguranca extends Error { constructor(public status: number, message: string) { super(message) } }
export const hash = (s: string) => createHash('sha256').update(s).digest('hex')
export function emailNormalizado(v: unknown) {
  if (typeof v !== 'string' || v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) throw new FalhaSeguranca(400, 'Informe um e-mail válido.')
  return v.trim().toLowerCase()
}
export function senhaForte(v: unknown, administrador = false): v is string {
  return typeof v === 'string' && [...v].length >= minimoSenha(administrador) && Buffer.byteLength(v, 'utf8') <= 72
    && !/^([\s\S])\1+$/.test(v) && !['12345678','123456789','1234567890','123456789012345','12345678901234567890','87654321','password','passwordpassword','senha123','senha12345678901','qwerty123','abcdefgh'].includes(v.toLowerCase())
}
export function validarSenha(v: unknown, administrador = false): asserts v is string {
  if (!senhaForte(v,administrador)) throw new FalhaSeguranca(400, `Use pelo menos ${minimoSenha(administrador)} caracteres, até 72 bytes, e evite senhas muito comuns ou repetidas.`)
}
export function codigoVerificacao(email: string, codigo: string) {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new FalhaSeguranca(503, 'Serviço indisponível.')
  return createHmac('sha256', secret).update('email:' + email + ':' + codigo).digest('hex')
}
export const novoCodigo = () => String(randomInt(100000, 1000000))
export async function limitar(request: Request, acao: string, limite: number, segundos: number, conta?: string) {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new FalhaSeguranca(503, 'Serviço indisponível.')
  // A Vercel sobrescreve x-forwarded-for no ingresso. Fora dela não confiamos no cabeçalho do cliente.
  const header = process.env.VERCEL ? request.headers.get('x-forwarded-for')?.split(',')[0].trim() : undefined
  const ip = header && isIP(header) ? header : 'local'
  const identidade = conta ? 'conta:' + conta : 'ip:' + ip
  const chave = createHmac('sha256', secret).update(acao + ':' + identidade).digest('hex')
  const { data, error } = await getSupabaseAdmin().rpc('hh_limitar', { p_chave: chave, p_limite: limite, p_segundos: segundos })
  if (error) throw new FalhaSeguranca(503, 'Serviço temporariamente indisponível.')
  if (!data) throw new FalhaSeguranca(429, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.')
}
export async function limitarConta(request: Request, acao: string, email: string, limite=10, segundos=900) {
  await limitar(request, acao + '-ip', limite * 3, segundos)
  await limitar(request, acao + '-conta', limite, segundos, email)
}
export async function lerCorpoLimitado(request: Request, max=16_384): Promise<Buffer> {
  if (Number(request.headers.get('content-length')) > max) throw new FalhaSeguranca(413, 'Requisição muito grande.')
  const reader = request.body?.getReader(); if (!reader) throw new FalhaSeguranca(400, 'Dados inválidos.')
  const partes: Uint8Array[]=[]; let total=0
  while (true) { const {value,done}=await reader.read(); if (done) break; total+=value.length; if(total>max){await reader.cancel(); throw new FalhaSeguranca(413,'Requisição muito grande.')} partes.push(value) }
  return Buffer.concat(partes)
}
export async function lerJson(request: Request, max=16_384): Promise<Record<string, unknown>> {
  const bytes=await lerCorpoLimitado(request,max)
  try { const body=JSON.parse(bytes.toString('utf8')); if (!body || typeof body!=='object' || Array.isArray(body)) throw Error(); return body }
  catch { throw new FalhaSeguranca(400, 'Dados inválidos.') }
}

export async function revogarSessoesNoLogout(token: { sub?: string; email?: string | null; sessaoVersao?: unknown } | null) {
  if (!token?.sub || !token.email || !Number.isSafeInteger(token.sessaoVersao) || Number(token.sessaoVersao)<1) return
  const { error }=await getSupabaseAdmin().from('usuarios').update({sessao_versao:Number(token.sessaoVersao)+1})
    .eq('id',token.sub).eq('email',token.email.toLowerCase().trim()).eq('sessao_versao',token.sessaoVersao).select('id')
  if(error) throw new FalhaSeguranca(503,'Não foi possível registrar a saída no servidor.')
}
function chaveMfa() {
  const k=process.env.MFA_ENCRYPTION_KEY
  if (!k || Buffer.from(k,'base64').length!==32) throw new FalhaSeguranca(503,'Autenticação por aplicativo ainda não configurada no servidor.')
  return Buffer.from(k,'base64')
}
export function cifrarMfa(secret: string) { const iv=randomBytes(12), c=createCipheriv('aes-256-gcm',chaveMfa(),iv); const out=Buffer.concat([c.update(secret,'utf8'),c.final()]); return [iv,c.getAuthTag(),out].map(b=>b.toString('base64')).join('.') }
export function decifrarMfa(s: string) { const [iv,tag,out]=s.split('.').map(s=>Buffer.from(s,'base64')); const c=createDecipheriv('aes-256-gcm',chaveMfa(),iv); c.setAuthTag(tag); return Buffer.concat([c.update(out),c.final()]).toString('utf8') }
export function totp(secret: string, email: string) { return new OTPAuth.TOTP({ issuer:'H&H IMPORTS',label:email,algorithm:'SHA1',digits:6,period:30,secret }) }
export function passoMfa(secret: string, codigo: string) { if (!/^\d{6}$/.test(codigo)) return null; const agora=Date.now(), delta=totp(secret,'').validate({token:codigo,timestamp:agora,window:1}); return delta===null ? null : Math.floor(agora/30000)+delta }
export async function consumirMfa(db: ReturnType<typeof getSupabaseAdmin>, u: {id: string|number; mfa_secret?: string|null}, codigo: string) {
  if (!u.mfa_secret) return false
  const backup=/^[a-f0-9]{20}$/i.test(codigo) ? hash(codigo.toLowerCase()) : null
  const passo=backup ? -1 : passoMfa(decifrarMfa(u.mfa_secret),codigo)
  if (passo===null) return false
  const {data,error}=await db.rpc('hh_consumir_mfa',{p_id:String(u.id),p_secret:u.mfa_secret,p_passo:passo,p_recuperacao:backup})
  return !error && data===true
}
export async function senhaConfere(senha: unknown, hashSenha: string) { return typeof senha==='string' && Buffer.byteLength(senha)<=72 && await bcrypt.compare(senha,hashSenha || '$2b$12$P0LO/XdfEcjI09qYqtoOdOUg3vsWFo.VbS/nD2SwUnf52ssQa.Nmm') }
