import 'server-only'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { ambienteMelhorEnvio, melhorEnvio } from '@/lib/melhor-envio'
import type { CotacaoEnvio, ItemFrete, Volume } from '@/types/envio'

export interface OpcaoFrete { nome: string; preco: number; prazo: number; transportadora: string; token: string; servico: number }
const cepValido = (cep: string) => /^\d{8}$/.test(cep)
function assinatura(payload: string) {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('Configure NEXTAUTH_SECRET.')
  return createHmac('sha256', secret).update('hh-frete-v2.' + payload).digest('base64url')
}
export function hashItensFrete(itens: ItemFrete[]) {
  const grupos = new Map<string, { id: string; quantidade: number; preco: number }>()
  for (const item of itens) {
    const id = String(item.id), preco = Number(item.preco), quantidade = Number(item.quantidade)
    if (!id || !Number.isSafeInteger(quantidade) || quantidade < 1 || !Number.isFinite(preco) || preco < 0) throw new Error('Itens de frete inválidos.')
    const chave = id + ':' + Math.round(preco * 100)
    const anterior = grupos.get(chave)
    grupos.set(chave, { id, preco: Math.round(preco * 100), quantidade: quantidade + (anterior?.quantidade || 0) })
  }
  return createHash('sha256').update(JSON.stringify([...grupos.entries()].sort(([a], [b]) => a.localeCompare(b)))).digest('hex')
}
export function volumeDosItens(itens: ItemFrete[]): Volume {
  const quantidade = itens.reduce((sum, item) => sum + Number(item.quantidade), 0)
  hashItensFrete(itens)
  if (quantidade < 1 || quantidade > 100) throw new Error('Quantidade de volumes inválida.')
  const medida = (nome: string, padrao: number) => {
    const value = Number(process.env[nome] || padrao)
    if (!Number.isFinite(value) || value <= 0) throw new Error('Confira as medidas de expedição: ' + nome)
    return value
  }
  // Medidas por unidade embalada: mantenha iguais ao pacote físico real.
  return { width: medida('MELHOR_ENVIO_LARGURA_CM', 11), length: medida('MELHOR_ENVIO_COMPRIMENTO_CM', 16),
    height: medida('MELHOR_ENVIO_ALTURA_CM', 3) * quantidade,
    weight: Number((medida('MELHOR_ENVIO_PESO_KG', 0.15) * quantidade).toFixed(3)) }
}
export function assinarCotacao(cep: string, preco: number, detalhes?: Omit<CotacaoEnvio, 'cep' | 'centavos' | 'expira'>) {
  const payload = Buffer.from(JSON.stringify({ ...detalhes, cep, centavos: Math.round(preco * 100), expira: Date.now() + 15 * 60 * 1000 })).toString('base64url')
  return payload + '.' + assinatura(payload)
}
function lerCotacao(token: unknown, cep: string): CotacaoEnvio | null {
  if (typeof token !== 'string' || token.length > 4000 || !cepValido(cep)) return null
  const partes = token.split('.')
  if (partes.length !== 2) return null
  const expected = Buffer.from(assinatura(partes[0])), actual = Buffer.from(partes[1])
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  try {
    const data: CotacaoEnvio = JSON.parse(Buffer.from(partes[0], 'base64url').toString())
    if (data.cep !== cep || !Number.isSafeInteger(data.centavos) || data.centavos <= 0 || !Number.isFinite(data.expira) || data.expira < Date.now()) return null
    return data
  } catch { return null }
}
export function validarCotacao(token: unknown, cep: string) {
  const data = lerCotacao(token, cep)
  return data ? data.centavos / 100 : null
}
export function validarFretePedido(token: unknown, cep: string, itens: ItemFrete[]): CotacaoEnvio | null {
  const data = lerCotacao(token, cep)
  if (!data || data.itensHash !== hashItensFrete(itens) || !Number.isSafeInteger(data.servico) || data.servico <= 0
    || data.origem !== (process.env.CEP_ORIGEM || '').replace(/\D/g, '') || data.ambiente !== ambienteMelhorEnvio()
    || !data.volume || Object.values(data.volume).some(v => !Number.isFinite(v) || v <= 0)) return null
  return data
}
interface CotacaoFornecedor {
  id: number; name: string; price: string; custom_price?: string; delivery_time: number; custom_delivery_time?: number
  error?: unknown; company?: { name: string }
}
export async function calcularFrete(cep: string, itens: ItemFrete[]): Promise<OpcaoFrete[]> {
  const origem = (process.env.CEP_ORIGEM || '').replace(/\D/g, '')
  if (!cepValido(cep) || !cepValido(origem)) throw new Error('Confira o CEP de destino e CEP_ORIGEM.')
  const volume = volumeDosItens(itens), itensHash = hashItensFrete(itens)
  const seguro = Math.round(itens.reduce((sum, item) => sum + item.preco * item.quantidade, 0) * 100) / 100
  const data = await melhorEnvio<CotacaoFornecedor[]>('/shipment/calculate', {
    from: { postal_code: origem }, to: { postal_code: cep }, volumes: [volume],
    ...(process.env.MELHOR_ENVIO_SERVICOS ? { services: process.env.MELHOR_ENVIO_SERVICOS } : {}),
    options: { receipt: false, own_hand: false, insurance_value: seguro },
  })
  if (!Array.isArray(data)) throw new Error('Resposta inválida de frete.')
  return data.filter(item => !item.error && Number.isSafeInteger(item.id) && Number(item.custom_price ?? item.price) > 0
    && Number.isFinite(Number(item.custom_price ?? item.price))).map(item => {
    const preco = Number(item.custom_price ?? item.price)
    return { nome: item.name, preco, prazo: Number(item.custom_delivery_time ?? item.delivery_time),
      servico: item.id, transportadora: item.company?.name || '',
      token: assinarCotacao(cep, preco, { origem, ambiente: ambienteMelhorEnvio(), itensHash, servico: item.id,
        nome: item.name, transportadora: item.company?.name || '', volume, seguro }) }
  }).sort((a, b) => a.preco - b.preco)
}
