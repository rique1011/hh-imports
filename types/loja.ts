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
  vitrines?: import('@/lib/selecoes').VitrineProduto[]
}

export interface ItemPedido extends ProdutoCarrinho {
  troca_solicitada?: boolean
  data_recebimento?: string | null
  recebimento_origem?: 'melhor_envio' | 'manual' | 'retirada'
  recebimento_confirmado_em?: string | null
  preparacao_iniciada_em?: string | null
}

export type EtapaPedido = 'realizado' | 'pagamento_aprovado' | 'preparando' | 'enviado' | 'entregue' | 'disponivel_retirada'
export interface EventoPedido {
  etapa: EtapaPedido
  ocorrido_em: string | null
  data_local: string | null
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
  data_entrega?: string | null
  linha_tempo?: EventoPedido[]
  entrega?: (Endereco & { documento?: string; modalidade?: 'retirada'; retirada?: import('@/types/retirada').ConfigRetirada }) | null
  retirada?: import('@/types/retirada').RetiradaPedido | null
  pagamento?: PagamentoPedido
  pagamento_expira_em?: string | null
  pode_pagar?: boolean
  cashback_debitado?: number
}

export interface PagamentoPedido {
  requer_revisao?:boolean
  valor_reembolsado?:number
  status?: string; metodo?: string; tipo?: string; parcelas?: number
  aprovado_em?: string | null; atualizado_em?: string | null
  expirado_em?: string | null
}
export interface EnderecoSalvo extends Endereco { id: string; apelido: string; padrao: boolean }

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
