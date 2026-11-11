import 'server-only'
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { ErroHttp } from '@/lib/autorizacao'
import { remetenteMelhorEnvio, participanteMelhorEnvio, snapshotEntrega } from '@/lib/entrega'
import { volumeDosItens } from '@/lib/frete'
import { ambienteMelhorEnvio, melhorEnvio, ErroMelhorEnvio } from '@/lib/melhor-envio'
import { snapshotDevolucao, type ProdutoDevolucao, type TrocaCliente } from '@/lib/devolucoes'
import type { EntregaPedido, Volume } from '@/types/envio'

type Db = ReturnType<typeof getSupabaseAdmin>
interface CotacaoReversa { contexto: string; ambiente: string; servico: number; centavos: number; volume: Volume; seguro: number; expira: number }
interface EstadoReversa { estado: string; ambiente: string; me_id?: string; erro?: string | null; config: { cotacao: CotacaoReversa; payload: Record<string, unknown> } }
export async function contextoReversa(db: Db, trocaId: string) {
  const { data: troca, error } = await db.from('trocas').select('*').eq('id', trocaId).maybeSingle()
  if (error) throw error
  if (!troca) throw new ErroHttp(404, 'Solicitação não encontrada.')
  const { data: pedido, error: erroPedido } = await db.from('pedidos').select('id,cliente_email,cliente_nome,entrega,itens,total,cashback_debitado,resumo_compra').eq('id', troca.pedido_id).maybeSingle()
  if (erroPedido || !pedido) throw new ErroHttp(422, 'Pedido original indisponível.')
  let entrega = pedido.entrega as EntregaPedido | null
  const usaCadastroAtual = !entrega
  if (!entrega) {
    const { data: cliente, error: erroCliente } = await db.from('usuarios').select('nome,email,cpf_cnpj,whatsapp,endereco').eq('id', troca.usuario_id).single()
    if (erroCliente || !cliente) throw new ErroHttp(422, 'Confira o endereço do cliente antes de criar a reversa.')
    entrega = snapshotEntrega(cliente)
  }
  const produto = (troca.produto_snapshot || snapshotDevolucao(pedido, String(troca.produto_id))) as ProdutoDevolucao | null
  if (!produto) throw new ErroHttp(422, 'Confira os itens originais desta solicitação.')
  const from = participanteMelhorEnvio(entrega), to = remetenteMelhorEnvio()
  const contexto = createHash('sha256').update(JSON.stringify({ trocaId, from, to, produto })).digest('hex')
  return { troca, pedido, produto, entrega, from, to, contexto, usaCadastroAtual }
}
function assinatura(payload: string) {
  if (!process.env.NEXTAUTH_SECRET) throw new Error('Configure NEXTAUTH_SECRET.')
  return createHmac('sha256', process.env.NEXTAUTH_SECRET).update('hh-reversa-v1.' + payload).digest('base64url')
}
export async function cotarReversa(db: Db, trocaId: string) {
  const c = await contextoReversa(db, trocaId)
  if (c.troca.status !== 'aprovado') throw new ErroHttp(409, 'Aprove a solicitação antes de consultar a reversa.')
  const volume = volumeDosItens([c.produto]), seguro = Math.round(c.produto.preco * c.produto.quantidade * 100) / 100
  const resposta = await melhorEnvio<{ id: number; name: string; custom_price?: string; price: string; error?: string }[]>('/shipment/calculate', {
    from: { postal_code: c.from.postal_code }, to: { postal_code: c.to.postal_code }, services: '1,2', volumes: [volume],
    options: { reverse: true, receipt: false, own_hand: false, insurance_value: seguro },
  })
  if (!Array.isArray(resposta)) throw new Error('Cotação reversa inválida.')
  return resposta.filter(o => !o.error && [1, 2].includes(o.id) && Number(o.custom_price ?? o.price) > 0 && Number.isFinite(Number(o.custom_price ?? o.price))).map(o => {
    const cotacao: CotacaoReversa = { contexto: c.contexto, ambiente: ambienteMelhorEnvio(), servico: o.id,
      centavos: Math.round(Number(o.custom_price ?? o.price) * 100), seguro, volume, expira: Date.now() + 900_000 }
    const payload = Buffer.from(JSON.stringify(cotacao)).toString('base64url')
    return { nome: 'Correios — ' + o.name, preco: cotacao.centavos / 100, token: payload + '.' + assinatura(payload) }
  }).sort((a, b) => a.preco - b.preco)
}
function validarToken(token: unknown, contexto: string) {
  try {
    if (typeof token !== 'string' || token.length > 5000) return null
    const [payload, ass, extra] = token.split('.')
    const a = Buffer.from(ass || ''), b = Buffer.from(assinatura(payload))
    if (extra || a.length !== b.length || !timingSafeEqual(a, b)) return null
    const c = JSON.parse(Buffer.from(payload, 'base64url').toString()) as CotacaoReversa
    return c.contexto === contexto && c.ambiente === ambienteMelhorEnvio() && c.expira > Date.now() && [1, 2].includes(c.servico) && Number.isSafeInteger(c.centavos) && c.centavos > 0 ? c : null
  } catch { return null }
}
export function resumoReversa(troca: { reversa?: EstadoReversa | Record<string, never>; codigo_postagem?: string | null }) {
  const r = troca.reversa as EstadoReversa | undefined
  return { estado: r?.estado || 'nova', codigo: troca.codigo_postagem || null, meId: r?.me_id || null,
    custo: r?.config?.cotacao?.centavos ? r.config.cotacao.centavos / 100 : null,
    mensagem: r?.erro || (r?.estado === 'pronta' ? 'Código de postagem disponível na conta do cliente e notificação registrada.' : r?.estado === 'gerando' ? 'Os Correios estão preparando o código. A consulta será retomada.' : ''),
    podeRetomar: !['inserindo','insercao_incerta','bloqueada'].includes(r?.estado || '') }
}
export async function gerarReversa(db: Db, trocaId: string, body: Record<string, unknown> = {}) {
  const c = await contextoReversa(db, trocaId), anterior = c.troca.reversa as EstadoReversa
  if (c.troca.codigo_postagem && (!anterior.estado || anterior.estado === 'pronta')) return resumoReversa(c.troca)
  let config = null
  if (!anterior.estado || anterior.estado === 'nova') {
    if (body.confirmarDados !== true) throw new ErroHttp(422, 'Confira remetente, destinatário, documentação, itens e embalagem antes de comprar a reversa.')
    const cotacao = validarToken(body.freteToken, c.contexto)
    if (!cotacao) throw new ErroHttp(422, 'A cotação reversa expirou ou os dados foram alterados. Consulte novamente.')
    const chaveDce = typeof body.chaveDce === 'string' ? body.chaveDce.trim() : ''
    if (chaveDce && !/^\d{44}$/.test(chaveDce)) throw new ErroHttp(422, 'A chave de DC-e deve ter 44 dígitos.')
    config = { cotacao, payload: { service: cotacao.servico, new_sender_mail: c.from.email, new_sender_phone: c.from.phone,
      insurance_value: cotacao.seguro, from: c.from, to: c.to, products: [{ name: c.produto.nome, quantity: c.produto.quantidade, unitary_value: c.produto.preco }],
      package: cotacao.volume, options: { receipt: false, own_hand: false, ...(chaveDce ? { dce: { key: chaveDce } } : {}) } } }
  }
  const lease = randomUUID()
  const { data, error } = await db.rpc('hh_claim_reversa', { p_troca_id: trocaId, p_lease: lease, p_ambiente: ambienteMelhorEnvio(), p_config: config })
  if (error || !data) throw new ErroHttp(409, 'Reversa em processamento ou com dados pendentes. Atualize a solicitação antes de continuar.')
  let troca = data as TrocaCliente & { reversa: EstadoReversa }, estado = troca.reversa
  async function salvar(alteracoes: Partial<EstadoReversa>) {
    estado = { ...estado, ...alteracoes }
    const { data: atualizado, error } = await db.from('trocas').update({ reversa: estado }).eq('id', trocaId).eq('reversa_lease', lease).select('id').single()
    if (error || !atualizado) throw new Error('Não foi possível registrar o processamento. Confira no Melhor Envio antes de repetir.')
    troca = { ...troca, reversa: estado }
  }
  try {
    if (['pronta','inserindo','insercao_incerta','bloqueada'].includes(estado.estado)) return resumoReversa(troca)
    if (!estado.me_id) {
      await salvar({ estado: 'inserindo', erro: null })
      let cart: { id: string; price?: string; custom_price?: string }
      try { cart = await melhorEnvio('/cart/reverse', estado.config.payload) }
      catch (e) {
        const recusado = e instanceof ErroMelhorEnvio && e.status >= 400 && e.status < 500 && e.status !== 408
        await salvar({ estado: recusado ? 'nova' : 'insercao_incerta', erro: 'Cadastro da reversa não confirmado. Confira no Melhor Envio antes de repetir.' }); throw e
      }
      if (!/^[\da-f-]{36}$/i.test(cart.id || '')) { await salvar({ estado: 'insercao_incerta', erro: 'O fornecedor não confirmou o ID da reversa. Confira o carrinho no Melhor Envio.' }); return resumoReversa(troca) }
      const preco = Number(cart.custom_price ?? cart.price)
      const autorizado = Number.isFinite(preco) && preco > 0 && Math.round(preco * 100) <= estado.config.cotacao.centavos
      await salvar({ me_id: cart.id, estado: autorizado ? 'carrinho' : 'bloqueada', erro: autorizado ? null : 'O custo da reversa mudou. Nenhuma compra foi solicitada. Confira o carrinho no Melhor Envio.' })
      if (!autorizado) return resumoReversa(troca)
    }
    const id = estado.me_id!
    let remoto = await melhorEnvio<{ id: string; status: string; paid_at?: string; generated_at?: string; authorization_code?: string | number }>('/orders/' + encodeURIComponent(id))
    if (remoto.id !== id) throw new Error('Resposta de reversa incompatível.')
    if (['canceled','cancelled','expired','suspended'].includes(remoto.status)) { await salvar({ estado: 'bloqueada', erro: 'Reversa cancelada, expirada ou suspensa. Confira no Melhor Envio.' }); return resumoReversa(troca) }
    let pago = !!remoto.paid_at || ['released','generated','posted','delivered'].includes(remoto.status)
    if (!pago && estado.estado === 'carrinho') {
      if (remoto.status !== 'pending') throw new ErroHttp(409, 'Estado remoto desconhecido. Confira no Melhor Envio antes de comprar.')
      await salvar({ estado: 'compra_incerta' })
      try { await melhorEnvio('/shipment/checkout', { orders: [id] }) }
      catch (e) {
        if (e instanceof ErroMelhorEnvio && e.status >= 400 && e.status < 500 && e.status !== 408) await salvar({ estado: 'carrinho', erro: e.mensagemAdministrativa })
        throw e
      }
      remoto = await melhorEnvio('/orders/' + encodeURIComponent(id))
      if (remoto.id !== id) throw new Error('Resposta de reversa incompatível.')
      pago = !!remoto.paid_at || ['released','generated','posted','delivered'].includes(remoto.status)
    }
    if (!pago) return resumoReversa(troca)
    const codigo = String(remoto.authorization_code || '').trim()
    if (!codigo) {
      if (!remoto.generated_at && !['generated','posted','delivered'].includes(remoto.status)) {
        await salvar({ estado: 'gerando', erro: null }); await melhorEnvio('/shipment/generate', { orders: [id] })
      } else await salvar({ estado: 'gerando', erro: null })
      return resumoReversa(troca)
    }
    if (!/^[A-Z0-9 -]{5,50}$/i.test(codigo)) throw new Error('Código de postagem inválido no retorno do fornecedor.')
    const { data: final, error: erroFinal } = await db.from('trocas').update({ codigo_postagem: codigo, status: 'aguardando_retorno', versao: troca.versao + 1,
      reversa: { ...estado, estado: 'pronta', erro: null } }).eq('id', trocaId).eq('reversa_lease', lease).select('*').single()
    if (erroFinal || !final) throw new Error('O código está disponível no Melhor Envio; a atualização da solicitação será retomada.')
    return resumoReversa(final)
  } finally {
    const { error } = await db.from('trocas').update({ reversa_lock_until: null, reversa_lease: null }).eq('id', trocaId).eq('reversa_lease', lease)
    if (error) console.error('[reversa] Bloqueio será liberado pelo prazo de segurança.')
  }
}
export async function retomarReversasPendentes() {
  const db = getSupabaseAdmin()
  const { data, error } = await db.from('trocas').select('id').in('reversa->>estado', ['compra_incerta','gerando']).limit(2)
  if (error) throw error
  for (const t of data || []) { try { await gerarReversa(db, t.id) } catch { console.error('[reversa] Processamento pendente.', { trocaId: t.id }) } }
  return { consultadas: data?.length || 0 }
}
