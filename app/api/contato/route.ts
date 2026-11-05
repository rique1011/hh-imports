import { NextResponse } from 'next/server'
import { ErroHttp, responderErro, validarOrigem } from '@/lib/autorizacao'
import { enviarEmailContato } from '@/lib/mail'

export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'no-store' }
// Contenção local por instância, além da validação de origem e do honeypot.
const tentativas = new Map<string, { quantidade: number; expira: number }>()
function limitar(request: Request) {
  const agora = Date.now()
  for (const [chave, item] of tentativas) if (item.expira <= agora) tentativas.delete(chave)
  const ip = (request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'desconhecido').slice(0, 64)
  const item = tentativas.get(ip)
  if (item && item.quantidade >= 3) throw new ErroHttp(429, 'Aguarde alguns minutos antes de enviar outra mensagem.')
  if (!item && tentativas.size >= 1000) throw new ErroHttp(429, 'Tente novamente em alguns minutos.')
  tentativas.set(ip, { quantidade: (item?.quantidade || 0) + 1, expira: item?.expira || agora + 10 * 60000 })
}
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    if (!request.headers.get('content-type')?.includes('application/json')) throw new ErroHttp(415, 'Formato de mensagem inválido.')
    const raw = await request.text()
    if (raw.length > 12000) throw new ErroHttp(413, 'Sua mensagem excede o tamanho permitido.')
    const body = JSON.parse(raw)
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ErroHttp(400, 'Confira os campos da mensagem.')
    if (body.website) return NextResponse.json({ sucesso: true }, { headers })
    const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const mensagem = typeof body.mensagem === 'string' ? body.mensagem.trim() : ''
    if (nome.length < 2 || nome.length > 100 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || mensagem.length < 10 || mensagem.length > 5000) throw new ErroHttp(400, 'Preencha nome, e-mail válido e mensagem de 10 a 5.000 caracteres.')
    limitar(request)
    // Destino fixo no servidor: o visitante só informa seu próprio Reply-To.
    const resultado = await enviarEmailContato(nome, email, mensagem)
    if (!resultado.sucesso) throw new ErroHttp(503, 'Não foi possível enviar agora. Tente novamente em alguns instantes.')
    return NextResponse.json({ sucesso: true }, { headers })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Mensagem inválida.' }, { status: 400, headers })
    return responderErro(error)
  }
}
