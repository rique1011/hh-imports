import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

export interface OpcaoFrete { nome: string; preco: number; prazo: number; transportadora: string; token: string }
interface Cotacao { cep: string; centavos: number; expira: number }
const cepValido = (cep: string) => /^\d{8}$/.test(cep)
function assinatura(payload: string) {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('Configure NEXTAUTH_SECRET.')
  return createHmac('sha256', secret).update('hh-frete-v1.' + payload).digest('base64url')
}
export function assinarCotacao(cep: string, preco: number) {
  const payload = Buffer.from(JSON.stringify({ cep, centavos: Math.round(preco * 100), expira: Date.now() + 15 * 60 * 1000 } satisfies Cotacao)).toString('base64url')
  return payload + '.' + assinatura(payload)
}
export function validarCotacao(token: unknown, cep: string) {
  if (typeof token !== 'string' || token.length > 2000 || !cepValido(cep)) return null
  const partes = token.split('.')
  if (partes.length !== 2) return null
  const expected = Buffer.from(assinatura(partes[0]))
  const actual = Buffer.from(partes[1])
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  try {
    const data: Cotacao = JSON.parse(Buffer.from(partes[0], 'base64url').toString())
    if (data.cep !== cep || !Number.isSafeInteger(data.centavos) || data.centavos <= 0 || data.expira < Date.now()) return null
    return data.centavos / 100
  } catch { return null }
}
export async function calcularFrete(cep: string): Promise<OpcaoFrete[]> {
  const origem = (process.env.CEP_ORIGEM || '').replace(/\D/g, '')
  if (!cepValido(cep)) throw new Error('CEP de destino inválido.')
  if (!cepValido(origem) || !process.env.MELHOR_ENVIO_TOKEN) throw new Error('Configure CEP_ORIGEM e MELHOR_ENVIO_TOKEN.')
  const response = await fetch('https://www.melhorenvio.com.br/api/v2/me/shipment/calculate', {
    method: 'POST', signal: AbortSignal.timeout(10000), cache: 'no-store',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json',
      Authorization: 'Bearer ' + process.env.MELHOR_ENVIO_TOKEN,
      'User-Agent': 'H&H IMPORTS (' + (process.env.NEXT_PUBLIC_CONTACT_EMAIL || process.env.EMAIL_USER || '') + ')' },
    body: JSON.stringify({ from: { postal_code: origem }, to: { postal_code: cep },
      package: { weight: 0.15, width: 11, height: 3, length: 16 },
      options: { receipt: false, own_hand: false, insurance_value: 0 } }),
  })
  if (!response.ok) throw new Error('Cotação indisponível no fornecedor.')
  const data: { name: string; price: string; delivery_time: number; error?: unknown; company?: { name: string } }[] = await response.json()
  if (!Array.isArray(data)) throw new Error('Resposta inválida de frete.')
  return data.filter(item => !item.error && Number.isFinite(Number(item.price)) && Number(item.price) > 0).map(item => ({
    nome: item.name, preco: Number(item.price), prazo: item.delivery_time, transportadora: item.company?.name || '', token: assinarCotacao(cep, Number(item.price)),
  }))
}
