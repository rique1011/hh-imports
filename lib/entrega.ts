import 'server-only'
import type { EntregaPedido } from '@/types/envio'
import { CONTACT_EMAIL } from '@/lib/brand'

export interface CadastroEntrega { nome?: string | null; email: string; cpf_cnpj?: string | null; whatsapp?: string | null; endereco?: string | null }
export function snapshotEntrega(cadastro: CadastroEntrega): EntregaPedido {
  let endereco: Record<string, unknown> = {}
  try { endereco = JSON.parse(cadastro.endereco || '{}') || {} } catch {}
  const campo = (nome: string) => String(endereco[nome] || '').trim()
  return { nome: cadastro.nome || 'Cliente', email: cadastro.email,
    documento: (cadastro.cpf_cnpj || '').replace(/\D/g, ''), telefone: (cadastro.whatsapp || '').replace(/\D/g, ''),
    cep: campo('cep').replace(/\D/g, ''), logradouro: campo('logradouro'), numero: campo('numero'),
    complemento: campo('complemento'), bairro: campo('bairro'), cidade: campo('cidade'), uf: campo('uf').toUpperCase() }
}
export function participanteMelhorEnvio(entrega: EntregaPedido) {
  if (!entrega.nome || !/^\d{8}$/.test(entrega.cep) || !entrega.logradouro || !entrega.numero || !entrega.bairro
    || !entrega.cidade || !/^[A-Z]{2}$/.test(entrega.uf) || !/^\d{10,13}$/.test(entrega.telefone)
    || !/^\d{11}(\d{3})?$/.test(entrega.documento) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entrega.email)) {
    throw new Error('Confira nome, CPF/CNPJ, telefone, e-mail e endereço completo do destinatário/remetente.')
  }
  return { name: entrega.nome, phone: entrega.telefone, email: entrega.email,
    ...(entrega.documento.length === 14 ? { company_document: entrega.documento } : { document: entrega.documento }),
    address: entrega.logradouro, number: entrega.numero, complement: entrega.complemento, district: entrega.bairro,
    city: entrega.cidade, state_abbr: entrega.uf, postal_code: entrega.cep, country_id: 'BR' }
}
export function remetenteMelhorEnvio() {
  let remetente: EntregaPedido & { inscricao_estadual?: string }
  try { remetente = JSON.parse(process.env.MELHOR_ENVIO_REMETENTE || '') } catch { throw new Error('Configure MELHOR_ENVIO_REMETENTE com os dados completos de expedição.') }
  remetente.cep = (process.env.CEP_ORIGEM || '').replace(/\D/g, '')
  remetente.email = CONTACT_EMAIL
  remetente.documento = String(remetente.documento || '').replace(/\D/g, '')
  remetente.telefone = String(remetente.telefone || '').replace(/\D/g, '')
  remetente.uf = String(remetente.uf || '').toUpperCase()
  return { ...participanteMelhorEnvio(remetente), ...(remetente.inscricao_estadual ? { state_register: remetente.inscricao_estadual } : {}) }
}

export function tipoRemetente(): 'cpf' | 'cnpj' | null {
  try {
    const documento = String(JSON.parse(process.env.MELHOR_ENVIO_REMETENTE || '').documento || '').replace(/\D/g, '')
    return documento.length === 11 ? 'cpf' : documento.length === 14 ? 'cnpj' : null
  } catch { return null }
}
