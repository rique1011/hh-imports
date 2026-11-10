import 'server-only'
import { sincronizarPagamentoPedido } from '@/lib/pagamentos'
import { randomUUID } from 'node:crypto'
import { ErroHttp } from '@/lib/autorizacao'
import { snapshotEntrega, participanteMelhorEnvio, remetenteMelhorEnvio } from '@/lib/entrega'
import { destinatarioCnpj } from '@/lib/documento-envio'
import { validarFretePedido } from '@/lib/frete'
import { ambienteMelhorEnvio, ErroMelhorEnvio, melhorEnvio } from '@/lib/melhor-envio'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { CotacaoEnvio, EntregaPedido, ResultadoEtiqueta } from '@/types/envio'
import type { Pedido } from '@/types/loja'

type Db = ReturnType<typeof getSupabaseAdmin>
interface PedidoComEntrega extends Pedido { entrega: EntregaPedido | null; frete_cotacao: CotacaoEnvio | null; entregaDoCadastro?: boolean }
interface ConfigEnvio { payload: Record<string, unknown>; cotacao: CotacaoEnvio; entrega: EntregaPedido; documentoFiscal?: 'nfe' | 'declaracao' }
interface DadosGeracao {
  freteToken?: unknown; notaFiscal?: unknown; agencia?: unknown
  documentoFiscal?: unknown; confirmarDeclaracao?: unknown; chaveDce?: unknown
}
interface Envio {
  pedido_id: number; estado: string; ambiente: string; me_id: string | null; config: ConfigEnvio
  etiqueta_gerada: boolean; codigo_rastreio: string | null; erro: string | null
}
interface OrdemRemota { id: string; status: string; tracking?: string | null; generated_at?: string | null; paid_at?: string | null }
export function validarPedidoId(value: unknown) {
  if ((typeof value === 'number' && !Number.isSafeInteger(value)) || !['number','string'].includes(typeof value) || !/^[1-9]\d{0,17}$/.test(String(value))) throw new ErroHttp(400, 'ID do pedido inválido.')
  return String(value)
}
export async function carregarPedidoEnvio(db: Db, pedidoId: string) {
  const { data, error } = await db.from('pedidos').select('id,cliente_nome,cliente_email,status,total,itens,codigo_rastreio,created_at,entrega,frete_cotacao,pagamento,mp_payment_id').eq('id', pedidoId).maybeSingle()
  if (error) throw new Error('Falha ao consultar o pedido.')
  if (!data) throw new ErroHttp(404, 'Pedido não encontrado.')
  const pedido = data as PedidoComEntrega
  if (!['pago','confirmado','processando','enviado','entregue'].includes(pedido.status)) throw new ErroHttp(409, 'A etiqueta exige pagamento confirmado.')
  if(pedido.pagamento?.requer_revisao || ['refunded','charged_back','in_mediation'].includes(pedido.pagamento?.status || '') || Number(pedido.pagamento?.valor_reembolsado)>0) throw new ErroHttp(409,'Pagamento em revisão financeira. Não gere nem poste uma etiqueta.')
  if (!Array.isArray(pedido.itens) || !pedido.itens.length) throw new ErroHttp(422, 'Pedido sem itens válidos.')
  if (!pedido.entrega) {
    pedido.entregaDoCadastro = true
    const { data: cliente, error: clienteError } = await db.from('usuarios').select('nome,email,cpf_cnpj,whatsapp,endereco').eq('email', pedido.cliente_email).maybeSingle()
    if (clienteError || !cliente) throw new ErroHttp(422, 'Cadastro do destinatário não encontrado.')
    // Pedidos anteriores à migração não possuem snapshot: o admin vê esse aviso.
    pedido.entrega = snapshotEntrega(cliente)
  }
  return pedido
}
export async function consultarEnvio(db: Db, pedidoId: string) {
  const { data, error } = await db.from('pedido_envios').select('*').eq('pedido_id', pedidoId).maybeSingle()
  if (error) throw new Error('Falha ao consultar a etiqueta. Confira a migração do Melhor Envio.')
  return data as Envio | null
}
export function resultadoEnvio(pedidoId: string, envio: Envio | null): ResultadoEtiqueta {
  const estado = envio?.estado || 'nova'
  const mensagens: Record<string,string> = {
    nova: 'Confira o destinatário, consulte o frete e selecione a documentação do envio.',
    carrinho: 'Envio salvo no carrinho do Melhor Envio. Retome para concluir a compra.',
    inserindo: 'A inserção não foi confirmada. Confira o carrinho do Melhor Envio antes de qualquer nova etiqueta.',
    insercao_incerta: 'A inserção não foi confirmada. Confira o carrinho do Melhor Envio e concilie o pedido antes de tentar novamente.',
    comprando: 'Aguardando confirmação do pagamento da etiqueta no Melhor Envio.',
    compra_incerta: 'A compra está em conferência. Atualizar consulta a mesma etiqueta, sem repetir o pagamento.',
    pago: 'Etiqueta paga. A geração será retomada.',
    gerando: 'O Melhor Envio está gerando a etiqueta. Atualize em alguns instantes.',
    aguardando_rastreio: 'Etiqueta disponível. Aguardando o código da transportadora para atualizar o pedido e notificar o cliente.',
    pronta: 'Etiqueta e rastreio disponíveis. Pedido atualizado e notificação registrada na fila.',
    bloqueada: 'Confira a etiqueta no Melhor Envio antes de continuar.',
  }
  return { pedidoId, estado, codigoRastreio: envio?.codigo_rastreio || null,
    custoEtiqueta: envio ? envio.config.cotacao.centavos / 100 : null,
    urlEtiqueta: envio?.etiqueta_gerada ? '/api/melhor-envio/etiqueta?pedidoId=' + encodeURIComponent(pedidoId) : null,
    urlDeclaracao: envio?.etiqueta_gerada && envio.config.documentoFiscal === 'declaracao'
      ? '/api/melhor-envio/etiqueta?pedidoId=' + encodeURIComponent(pedidoId) + '&documento=dace' : null,
    concluido: estado === 'pronta', podeRetomar: !['inserindo','insercao_incerta','bloqueada'].includes(estado),
    mensagem: envio?.erro || mensagens[estado] || 'Aguardando processamento.' }
}
export function montarConfigEnvio(pedido: PedidoComEntrega, body: DadosGeracao): ConfigEnvio {
  const cotacao = validarFretePedido(body.freteToken, pedido.entrega!.cep, pedido.itens)
  if (!cotacao) throw new ErroHttp(422, 'A cotação expirou ou não corresponde aos itens/endereço. Consulte novamente.')
  if (pedido.frete_cotacao?.servico && pedido.frete_cotacao.servico !== cotacao.servico) throw new ErroHttp(422, 'Mantenha o serviço de frete escolhido na compra.')
  const documentoFiscal = body.documentoFiscal ?? 'nfe'
  if (documentoFiscal !== 'nfe' && documentoFiscal !== 'declaracao') throw new ErroHttp(422, 'Documento fiscal inválido.')
  const notaFiscal = String(body.notaFiscal || '').replace(/\s/g, '')
  const chaveDce = String(body.chaveDce || '').replace(/\s/g, '')
  if (documentoFiscal === 'nfe' && !/^\d{44}$/.test(notaFiscal)) throw new ErroHttp(422, 'Informe a chave de 44 dígitos da NF-e deste pedido.')
  if (documentoFiscal === 'declaracao') {
    if (destinatarioCnpj(pedido.entrega?.documento)) throw new ErroHttp(422, 'Compras com CNPJ exigem NF-e na loja. Informe a chave da nota fiscal deste pedido.')
    if (body.confirmarDeclaracao !== true) throw new ErroHttp(422, 'Confirme que este envio pode utilizar declaração de conteúdo em lugar de NF-e.')
    if (notaFiscal) throw new ErroHttp(422, 'Utilize NF-e ou declaração de conteúdo para o mesmo envio. Selecione o documento correto.')
    if (chaveDce && !/^\d{44}$/.test(chaveDce)) throw new ErroHttp(422, 'A chave de DC-e existente precisa ter 44 dígitos, ou deixe o campo vazio para emissão pelo Melhor Envio.')
  } else if (chaveDce) throw new ErroHttp(422, 'A chave de DC-e só pode ser usada com declaração de conteúdo.')
  const agencia = body.agencia === '' || body.agencia == null ? null : Number(body.agencia)
  if (agencia !== null && (!Number.isSafeInteger(agencia) || agencia < 1)) throw new ErroHttp(422, 'Agência inválida.')
  let from, to
  try { from = remetenteMelhorEnvio(); to = participanteMelhorEnvio(pedido.entrega!) }
  catch (error) { throw new ErroHttp(422, error instanceof Error ? error.message : 'Confira os dados do envio.') }
  if (documentoFiscal === 'declaracao') delete from.state_register
  return { cotacao, entrega: pedido.entrega!, documentoFiscal,
    payload: { service: cotacao.servico, ...(agencia ? { agency: agencia } : {}), from, to,
    products: pedido.itens.map(item => ({ name: item.nome, quantity: item.quantidade, unitary_value: Number(item.preco) })),
    volumes: [cotacao.volume], options: { insurance_value: cotacao.seguro, receipt: false, own_hand: false,
      non_commercial: documentoFiscal === 'declaracao',
      ...(documentoFiscal === 'nfe' ? { invoice: { key: notaFiscal } } : chaveDce ? { dce: { key: chaveDce } } : {}),
      platform: 'H&H IMPORTS', tags: [{ tag: 'HH-PEDIDO-' + pedido.id, url: null }] } } }
}

export async function gerarEtiqueta(db: Db, pedidoId: string, body: DadosGeracao = {}) {
  const pedido = await carregarPedidoEnvio(db, pedidoId)
  const anterior = await consultarEnvio(db, pedidoId)
  const config = !anterior || anterior.estado === 'nova' ? montarConfigEnvio(pedido, body) : null
  const lease = randomUUID()
  const { data, error } = await db.rpc('hh_claim_envio', { p_pedido_id: pedidoId, p_lease: lease, p_ambiente: ambienteMelhorEnvio(), p_config: config })
  if (error) throw new ErroHttp(409, /em processamento/.test(error.message) ? 'Etiqueta em processamento. Aguarde e atualize.' : 'Não foi possível iniciar a etiqueta. Confira o status, rastreio e ambiente do pedido.')
  let envio = data as Envio
  async function salvar(values: Partial<Envio>) {
    const { data: atualizado, error } = await db.from('pedido_envios').update({ ...values, atualizado_em: new Date().toISOString() })
      .eq('pedido_id', pedidoId).eq('lease_id', lease).select('*').single()
    if (error || !atualizado) throw new Error('Não foi possível persistir a etapa da etiqueta. Consulte antes de repetir a operação.')
    envio = atualizado as Envio
  }
  try {
    if (envio.estado === 'pronta') return resultadoEnvio(pedidoId, envio)
    if (['inserindo','insercao_incerta','bloqueada'].includes(envio.estado)) return resultadoEnvio(pedidoId, envio)
    if (!envio.me_id) {
      await salvar({ estado: 'inserindo', erro: null })
      let cart: { id: string; price?: string; custom_price?: string }
      try { cart = await melhorEnvio('/cart', envio.config.payload) }
      catch (error) {
        const recusado = error instanceof ErroMelhorEnvio && error.status >= 400 && error.status < 500 && error.status !== 408
        await salvar({ estado: recusado ? 'nova' : 'insercao_incerta', erro: error instanceof ErroMelhorEnvio
          ? error.mensagemAdministrativa : error instanceof Error ? error.message : 'Falha na inserção.' })
        throw error
      }
      if (!/^[0-9a-f-]{36}$/i.test(cart.id || '')) {
        await salvar({ estado: 'insercao_incerta', erro: 'O Melhor Envio não retornou um ID de etiqueta válido. Confira o carrinho antes de repetir.' })
        return resultadoEnvio(pedidoId, envio)
      }
      const preco = Number(cart.custom_price ?? cart.price)
      // ID e autorização do valor no MESMO checkpoint: uma queda entre as etapas
      // nunca deixa um carrinho de preço não conferido disponível para checkout.
      const revisado = Number.isFinite(preco) && preco > 0 && Math.round(preco * 100) <= envio.config.cotacao.centavos
      await salvar({ me_id: cart.id, estado: revisado ? 'carrinho' : 'bloqueada',
        erro: revisado ? null : 'O valor no carrinho difere da cotação revisada. Confira no Melhor Envio; nenhum checkout foi solicitado.' })
      if (!revisado) return resultadoEnvio(pedidoId, envio)
    }
    const id = envio.me_id!
    let remoto = await melhorEnvio<OrdemRemota>('/orders/' + encodeURIComponent(id))
    if (remoto.id !== id) throw new Error('Resposta de etiqueta incompatível.')
    if (['canceled','cancelled','expired','suspended'].includes(remoto.status)) {
      await salvar({ estado: 'bloqueada', erro: 'A etiqueta foi cancelada, expirou ou está suspensa no Melhor Envio. Confira no painel do fornecedor.' })
      return resultadoEnvio(pedidoId, envio)
    }
    let pago = !!remoto.paid_at || ['released','generated','posted','delivered'].includes(remoto.status)
    if (!pago && envio.estado === 'carrinho') {
      if (remoto.status !== 'pending') throw new ErroHttp(409, 'Estado remoto desconhecido. Confira no Melhor Envio antes de comprar.')
      // Consulta o provedor novamente imediatamente antes de gastar saldo.
      const atual=await carregarPedidoEnvio(db,pedidoId)
      if (destinatarioCnpj(atual.entrega?.documento) && envio.config.documentoFiscal === 'declaracao') {
        throw new ErroHttp(422, 'Compra com CNPJ: o carrinho foi criado com declaração. Confira esse envio no Melhor Envio antes de gerar uma etiqueta com NF-e.')
      }
      if(Number(atual.total)>0){
        const verificado=await sincronizarPagamentoPedido(db,atual)
        if(verificado.pagamento?.status!=='approved' || verificado.pagamento?.requer_revisao || Number(verificado.pagamento?.valor_reembolsado)>0) throw new ErroHttp(409,'Pagamento não está liberado para postagem.')
      }
      await carregarPedidoEnvio(db,pedidoId)
      await salvar({ estado: 'comprando', erro: null })
      try { await melhorEnvio('/shipment/checkout', { orders: [id] }) }
      catch (error) {
        const recusado = error instanceof ErroMelhorEnvio && [401,403,422,429].includes(error.status)
        await salvar({ estado: recusado ? 'carrinho' : 'compra_incerta', erro: error instanceof ErroMelhorEnvio
          ? error.mensagemAdministrativa : error instanceof Error ? error.message : 'Compra em conferência.' })
        throw error
      }
      remoto = await melhorEnvio<OrdemRemota>('/orders/' + encodeURIComponent(id))
      if (remoto.id !== id) throw new Error('Resposta de etiqueta incompatível.')
      pago = !!remoto.paid_at || ['released','generated','posted','delivered'].includes(remoto.status)
    }
    if (!pago) return resultadoEnvio(pedidoId, envio)
    const gerada = !!remoto.generated_at || ['generated','posted','delivered'].includes(remoto.status)
    if (!gerada) {
      // Uma nova solicitação para o mesmo ID não compra outro frete.
      await salvar({ estado: 'gerando', erro: null })
      await melhorEnvio('/shipment/generate', { orders: [id] })
      return resultadoEnvio(pedidoId, envio)
    }
    await salvar({ etiqueta_gerada: true, estado: 'aguardando_rastreio', erro: null })
    if (!remoto.tracking?.trim()) return resultadoEnvio(pedidoId, envio)
    const { error: finalizarError } = await db.rpc('hh_finalizar_envio', { p_pedido_id: pedidoId, p_lease: lease, p_rastreio: remoto.tracking.trim() })
    if (finalizarError) throw new Error('Etiqueta disponível, mas a atualização do pedido precisa ser retomada.')
    envio = { ...envio, estado: 'pronta', codigo_rastreio: remoto.tracking.trim(), erro: null }
    return resultadoEnvio(pedidoId, envio)
  } finally {
    const { error } = await db.from('pedido_envios').update({ locked_until: null, lease_id: null }).eq('pedido_id', pedidoId).eq('lease_id', lease)
    if (error) console.error('[etiqueta] Lease será liberado pelo prazo de expiração.', { pedidoId })
  }
}

// Usado pelo cron já existente; só retoma IDs conhecidos que passaram pelo checkout.
export async function retomarEtiquetasPendentes(limite = 3) {
  const db = getSupabaseAdmin()
  const { data, error } = await db.from('pedido_envios').select('pedido_id').in('estado', ['comprando','compra_incerta','pago','gerando','aguardando_rastreio'])
    .order('atualizado_em', { ascending: true }).limit(limite)
  if (error) throw new Error('Falha ao consultar etiquetas pendentes.')
  let concluidas = 0
  for (const item of data || []) {
    try { if ((await gerarEtiqueta(db, String(item.pedido_id))).concluido) concluidas++ }
    catch { console.error('[etiqueta] Conferência pendente para próxima execução.', { pedidoId: item.pedido_id }) }
  }
  return { consultadas: data?.length || 0, concluidas }
}
