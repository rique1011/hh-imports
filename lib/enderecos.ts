import type { Endereco, EnderecoSalvo } from '@/types/loja'
export const ESTADOS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')
export function normalizarEndereco(dados: unknown): Endereco {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new Error('Preencha o endereço completo.')
  const d = dados as Record<string, unknown>
  const texto = (campo: string, max: number) => {
    if (typeof d[campo] !== 'string' || d[campo].length > max) throw new Error('Endereço inválido.')
    return d[campo].trim()
  }
  const endereco = { cep: texto('cep', 12).replace(/\D/g, ''), logradouro: texto('logradouro', 200), numero: texto('numero', 30),
    complemento: d.complemento == null ? '' : texto('complemento', 120), bairro: texto('bairro', 120), cidade: texto('cidade', 120), uf: texto('uf', 2).toUpperCase() }
  if (!/^\d{8}$/.test(endereco.cep) || endereco.logradouro.length < 2 || !endereco.numero || !endereco.bairro || !endereco.cidade || !ESTADOS.includes(endereco.uf)) throw new Error('Preencha o endereço completo e um CEP válido.')
  return endereco
}
export const enderecoPadrao = (enderecos: EnderecoSalvo[]) => enderecos.find(e => e.padrao) || enderecos[0]
export const textoEndereco = (e: Endereco) => [e.logradouro && `${e.logradouro}, ${e.numero}`, e.complemento, e.bairro, e.cidade && `${e.cidade}/${e.uf}`, e.cep].filter(Boolean).join(' · ')
