import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { MercadoPagoConfig } from 'mercadopago'

export function getMercadoPagoClient() {
  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) throw new Error('Configure MP_ACCESS_TOKEN.')
  return new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } })
}

export function validarAssinatura(request: Request, dataId: string) {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) throw new Error('Configure MP_WEBHOOK_SECRET.')
  const signature = request.headers.get('x-signature') || ''
  const requestId = request.headers.get('x-request-id')
  const parts = Object.fromEntries(signature.split(',').map(part => {
    const index = part.indexOf('=')
    return [part.slice(0, index).trim(), part.slice(index + 1).trim()]
  }))
  if (!requestId || !/^\d+$/.test(parts.ts || '') ||
      !/^[a-f0-9]{64}$/i.test(parts.v1 || '')) return false
  const manifest = 'id:' + dataId.toLowerCase() + ';request-id:' + requestId + ';ts:' + parts.ts + ';'
  const expected = createHmac('sha256', secret).update(manifest).digest()
  const received = Buffer.from(parts.v1, 'hex')
  return expected.length === received.length && timingSafeEqual(expected, received)
}
