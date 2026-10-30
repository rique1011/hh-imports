import type { ProdutoCarrinho } from '@/lib/store'

export type Identificador = string | number

export interface Produto {
  id: string
  nome: string
  slug: string
  preco: number
  fotos: string[] | null
  material: string | null
  descricao?: string | null
  estoque?: number | null
  estoque_reservado?: number
  categoria_id?: string | null
  categoria_slug?: string | null
  video_url?: string | null
  criado_em?: string
  visitas?: number | null
}

export interface ItemPedido extends ProdutoCarrinho {
  troca_solicitada?: boolean
}

export interface Pedido {
  id: Identificador
  created_at: string
  cliente_email: string
  cliente_nome?: string | null
  status: string
  total: number
  itens: ItemPedido[]
  codigo_rastreio?: string | null
}

export interface Endereco {
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
}

export interface Usuario {
  id: Identificador
  nome: string
  email: string
  perfil?: string | null
  role?: string | null
  cpf_cnpj?: string | null
  whatsapp?: string | null
  endereco?: string | null
}

export interface Cupom {
  id: string
  codigo: string
  desconto: number
  valor_fixo: number | null
  usuario_id: Identificador | null
  ativo: boolean
  criado_em: string
}

export interface Troca {
  id: string
  pedido_id: string
  produto_id: string | null
  usuario_id: Identificador
  motivo: string
  foto_url: string | null
  status: string
  criado_em: string
  usuarios: Pick<Usuario, 'nome' | 'email'> | null
}

export interface SolicitacaoTroca extends Troca {
  cliente: { nome: string; email: string; historico_trocas: number }
  produto: { nome: string; preco: number }
}
