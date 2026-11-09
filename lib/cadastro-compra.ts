import { normalizarEndereco } from '@/lib/enderecos'
import type { EnderecoSalvo } from '@/types/loja'

export const documentoValido = (valor: string) => /^\d{11}(\d{3})?$/.test(valor.replace(/\D/g, ''))
export const telefoneValido = (valor: string) => /^\d{10,13}$/.test(valor.replace(/\D/g, ''))
export const enderecoCompleto = (endereco: unknown) => {
  try { normalizarEndereco(endereco); return true } catch { return false }
}
export type CampoCompra = 'cpf_cnpj' | 'whatsapp' | 'endereco'
export const ROTULOS_CADASTRO: Record<CampoCompra, string> = {
  cpf_cnpj: 'CPF ou CNPJ', whatsapp: 'WhatsApp com DDD', endereco: 'Endereço de entrega completo',
}
export function camposCompraPendentes(dados: { cpf_cnpj?: string; whatsapp?: string }, enderecos: EnderecoSalvo[]): CampoCompra[] {
  const faltantes: CampoCompra[] = []
  if (!documentoValido(dados.cpf_cnpj || '')) faltantes.push('cpf_cnpj')
  if (!telefoneValido(dados.whatsapp || '')) faltantes.push('whatsapp')
  if (!enderecos.some(enderecoCompleto)) faltantes.push('endereco')
  return faltantes
}
