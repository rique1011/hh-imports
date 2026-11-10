import 'server-only'
import { CONTACT_EMAIL } from '@/lib/brand'

function registro(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
function nomeCampo(campo: string): string | null {
  const participante = campo.match(/^(from|to)\.(name|phone|email|document|company_document|state_register|economic_activity_code|postal_code|address|number|complement|district|city|state_abbr|country_id)$/)
  if (participante) {
    const lado = participante[1] === 'from' ? 'remetente' : 'destinatário'
    const nomes: Record<string, string> = { name: 'nome', phone: 'telefone', email: 'e-mail', document: 'CPF',
      company_document: 'CNPJ', state_register: 'inscrição estadual', economic_activity_code: 'CNAE' }
    return `${nomes[participante[2]] || 'endereço'} do ${lado}`
  }
  if (/^products(?:\.\d+)?(?:\.(?:name|quantity|unitary_value))?$/.test(campo)) return 'itens, quantidades e valores declarados'
  if (/^volumes(?:\.\d+)?(?:\.(?:height|width|length|weight))?$/.test(campo)) return 'peso e medidas da embalagem'
  const nomes: Record<string, string> = { service: 'serviço da transportadora', agency: 'agência de postagem',
    'options.non_commercial': 'documentação do envio', 'options.invoice': 'nota fiscal', 'options.invoice.key': 'chave da NF-e',
    'options.dce': 'declaração de conteúdo', 'options.dce.key': 'chave da DC-e', 'options.insurance_value': 'valor declarado do seguro',
    orders: 'etiquetas selecionadas' }
  return Object.hasOwn(nomes, campo) ? nomes[campo] : null
}
function mensagensFornecedor(resposta: unknown) {
  const mensagens: string[] = []
  let visitas = 0
  function coletar(value: unknown, profundidade = 0, campos = false) {
    if (++visitas > 80 || profundidade > 5 || mensagens.length >= 8) return
    if (typeof value === 'string') { if (value.trim()) mensagens.push(value.slice(0, 2000)); return }
    if (Array.isArray(value)) { value.slice(0, 8).forEach(item => coletar(item, profundidade + 1, campos)); return }
    const objeto = registro(value)
    if (!objeto) return
    if (campos) Object.values(objeto).slice(0, 12).forEach(item => coletar(item, profundidade + 1, true))
    else for (const chave of ['message', 'messages', 'error', 'errors', 'detail', 'details', 'error_description', 'data']) {
      if (Object.hasOwn(objeto, chave)) coletar(objeto[chave], profundidade + 1, chave === 'errors')
    }
  }
  coletar(resposta)
  return [...new Set(mensagens)]
}
function protegerMotivo(mensagens: string[], valoresPrivados: string[]) {
  let texto = mensagens.join(' ').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ')
  for (const valor of [...new Set(valoresPrivados.filter(valor => valor.length >= 3))].sort((a, b) => b.length - a.length)) {
    const literal = valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    texto = texto.replace(new RegExp(literal, 'gi'), '[dado oculto]')
  }
  return texto.replace(/\bBearer\s+\S+/gi, 'Bearer [token oculto]')
    .replace(/\bhttps?:\/\/\S+/gi, '[link oculto]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[e-mail oculto]')
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[documento oculto]')
    .replace(/(?:\+?55[ -]?)?(?:\(\d{2}\)|\b\d{2})[ -]?\d{4,5}[ -]?\d{4}\b/g, '[telefone oculto]')
    .replace(/\b\d{5}-?\d{3}\b|\b\d{8,}\b/g, '[número oculto]')
    .replace(/[A-Za-z0-9_.-]{32,}/g, '[identificador oculto]')
    .replace(/\s+/g, ' ').trim().slice(0, 600)
}
function valoresParticipantes(body: unknown) {
  const dados = registro(body), valores: string[] = []
  for (const lado of ['from', 'to']) {
    const pessoa = registro(dados?.[lado])
    if (!pessoa) continue
    for (const campo of ['name', 'email', 'phone', 'document', 'company_document', 'address', 'number', 'complement', 'district', 'city', 'postal_code', 'state_register']) {
      const valor = pessoa[campo]
      if (typeof valor === 'string' || typeof valor === 'number') valores.push(String(valor))
    }
  }
  return valores
}
function detalhesErro(resposta: unknown) {
  const dados = registro(resposta), erros = registro(dados?.errors)
  const mensagens = mensagensFornecedor(resposta)
  const texto = mensagens.join(' ').slice(0, 2000).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const saldoInsuficiente = /\bsaldo insuficiente\b|\bnao (?:possui|tem) saldo suficiente\b|\binsufficient (?:wallet )?(?:balance|funds|credits?)\b/.test(texto)
  const campos = [...new Set(Object.keys(erros || {}).slice(0, 50).map(nomeCampo).filter((campo): campo is string => campo !== null))]
  return { saldoInsuficiente, campos, mensagens }
}
function mensagemRecusa(operacao: string, detalhes: ReturnType<typeof detalhesErro>) {
  if (detalhes.saldoInsuficiente) return 'Saldo insuficiente na carteira do Melhor Envio. Adicione créditos e retome este envio.'
  const campos = detalhes.campos.length ? ` Revise: ${detalhes.campos.join('; ')}.` : ''
  if (operacao === '/cart') return 'O Melhor Envio recusou o cadastro do envio, antes da compra da etiqueta.' +
    (campos || ' Confira os dados do remetente, destinatário, itens e documentação.')
  if (operacao === '/shipment/checkout') return 'O Melhor Envio recusou o pagamento da etiqueta.' +
    (campos || ' Confira o saldo da carteira e as pendências da conta no Melhor Envio.')
  if (operacao === '/shipment/calculate') return 'O Melhor Envio recusou os dados da cotação.' +
    (campos || ' Confira o CEP, os itens e as medidas da embalagem.')
  if (operacao === '/shipment/generate') return 'O Melhor Envio recusou a geração da etiqueta.' +
    (campos || ' Confira a documentação e as pendências desse envio no Melhor Envio e retome a mesma etiqueta.')
  return 'O Melhor Envio recusou a operação.' + (campos || ' Confira os dados e a situação do envio no Melhor Envio.')
}
export class ErroMelhorEnvio extends Error {
  public campos: string[]
  public saldoInsuficiente: boolean
  #motivoFornecedor: string
  constructor(public status: number, public operacao: string, resposta?: unknown, valoresPrivados: string[] = []) {
    const detalhes = detalhesErro(resposta)
    super(status === 401 || status === 403 ? 'Confira a validade e as permissões do MELHOR_ENVIO_TOKEN.'
      : status === 422 ? mensagemRecusa(operacao, detalhes)
      : status === 429 ? 'Limite do Melhor Envio atingido. Aguarde antes de atualizar.'
      : 'O Melhor Envio não confirmou a operação. Atualize o processamento para consultar o resultado.')
    this.campos = detalhes.campos
    this.saldoInsuficiente = detalhes.saldoInsuficiente
    // O texto livre do fornecedor só é utilizado nos fluxos administrativos.
    this.#motivoFornecedor = status === 422 ? protegerMotivo(detalhes.mensagens, valoresPrivados) : ''
  }
  get mensagemAdministrativa() {
    return this.#motivoFornecedor ? `${this.message} Motivo informado pelo Melhor Envio: ${this.#motivoFornecedor}` : this.message
  }
}
export function ambienteMelhorEnvio() {
  const ambiente = process.env.MELHOR_ENVIO_AMBIENTE || 'production'
  if (!['production', 'sandbox'].includes(ambiente)) throw new Error('MELHOR_ENVIO_AMBIENTE deve ser production ou sandbox.')
  return ambiente
}
export function configuracaoMelhorEnvio() {
  const token = process.env.MELHOR_ENVIO_TOKEN?.trim()
  const email = CONTACT_EMAIL
  if (!token || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Confira MELHOR_ENVIO_TOKEN e NEXT_PUBLIC_CONTACT_EMAIL.')
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
  if (!response.ok) {
    const resposta = response.status === 422 ? await response.json().catch(() => null) : null
    const erro = new ErroMelhorEnvio(response.status, path, resposta, [config.headers.Authorization,
      config.headers.Authorization.replace(/^Bearer\s+/i, ''), ...valoresParticipantes(body)])
    // Não registra o corpo retornado, os valores dos campos ou o token.
    const operacoes = ['/cart', '/shipment/checkout', '/shipment/calculate', '/shipment/generate', '/shipment/print', '/shipment/tracking']
    console.warn('[melhor-envio] Operação recusada.', { status: erro.status,
      operacao: operacoes.includes(path) ? path : path.startsWith('/orders/') ? '/orders/:id' : '/outra',
      campos: erro.campos, saldoInsuficiente: erro.saldoInsuficiente })
    throw erro
  }
  return response
}
export async function melhorEnvio<T>(path: string, body?: unknown): Promise<T> {
  const response = await requisitarMelhorEnvio(path, body)
  try { return await response.json() as T }
  catch { throw new ErroMelhorEnvio(0, path) }
}
