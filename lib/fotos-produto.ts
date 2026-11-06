export const MAX_FOTOS_PRODUTO = 100
// Mantém o formulário abaixo do limite de requisição da hospedagem.
export const MAX_BYTES_FOTO_PRODUTO = 4 * 1024 * 1024
export const TIPOS_FOTO_PRODUTO = ['image/jpeg', 'image/png', 'image/webp']

export interface FotoProdutoEdicao {
  id: string
  url: string
  arquivo?: File
}
