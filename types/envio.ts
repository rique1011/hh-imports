export interface ItemFrete { id: string | number; quantidade: number; preco: number; nome?: string }
export interface Volume { width: number; height: number; length: number; weight: number }
export interface CotacaoEnvio {
  cep: string; origem: string; ambiente: string; centavos: number; expira: number
  itensHash: string; servico: number; nome: string; transportadora: string; volume: Volume; seguro: number
}
export interface EntregaPedido {
  nome: string; email: string; documento: string; telefone: string
  cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string
}
export interface ResultadoEtiqueta {
  pedidoId: string; estado: string; codigoRastreio: string | null; urlEtiqueta: string | null
  custoEtiqueta: number | null
  urlDeclaracao?: string | null
  mensagem: string; concluido: boolean; podeRetomar: boolean
}
