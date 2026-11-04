import 'server-only'

export class ErroMelhorEnvio extends Error {
  constructor(public status: number, public operacao: string) {
    super(status === 401 || status === 403 ? 'Confira a validade e as permissões do MELHOR_ENVIO_TOKEN.'
      : status === 422 ? 'O Melhor Envio recusou os dados ou o pagamento. Confira cadastro, nota fiscal e saldo na carteira.'
      : status === 429 ? 'Limite do Melhor Envio atingido. Aguarde antes de atualizar.'
      : 'O Melhor Envio não confirmou a operação. Atualize o processamento para consultar o resultado.')
  }
}
export function ambienteMelhorEnvio() {
  const ambiente = process.env.MELHOR_ENVIO_AMBIENTE || 'production'
  if (!['production', 'sandbox'].includes(ambiente)) throw new Error('MELHOR_ENVIO_AMBIENTE deve ser production ou sandbox.')
  return ambiente
}
export function configuracaoMelhorEnvio() {
  const token = process.env.MELHOR_ENVIO_TOKEN?.trim()
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || process.env.EMAIL_USER?.trim()
  if (!token || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Configure MELHOR_ENVIO_TOKEN e o e-mail de contato em EMAIL_USER ou NEXT_PUBLIC_CONTACT_EMAIL.')
  return { base: ambienteMelhorEnvio() === 'sandbox' ? 'https://sandbox.melhorenvio.com.br' : 'https://melhorenvio.com.br',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'User-Agent': `H&H IMPORTS (${email})` } }
}
export async function requisitarMelhorEnvio(path: string, body?: unknown) {
  const config = configuracaoMelhorEnvio()
  let response: Response
  try {
    response = await fetch(config.base + '/api/v2/me' + path, {
      method: body === undefined ? 'GET' : 'POST', headers: config.headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    })
  } catch { throw new ErroMelhorEnvio(0, path) }
  if (!response.ok) throw new ErroMelhorEnvio(response.status, path)
  return response
}
export async function melhorEnvio<T>(path: string, body?: unknown): Promise<T> {
  const response = await requisitarMelhorEnvio(path, body)
  try { return await response.json() as T }
  catch { throw new ErroMelhorEnvio(0, path) }
}
