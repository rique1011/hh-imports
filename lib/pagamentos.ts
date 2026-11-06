import 'server-only'
import { Payment, Preference } from 'mercadopago'
import type { PaymentResponse } from 'mercadopago/dist/clients/payment/commonTypes'
import { getMercadoPagoClient } from '@/lib/mercadopago'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getSiteUrl } from '@/lib/site-url'
import { BRAND_NAME } from '@/lib/brand'
import { ErroHttp } from '@/lib/autorizacao'
import { prazoPagamento, STATUS_PAGOS } from '@/lib/pagamento-pedido'
import type { Pedido } from '@/types/loja'
type Db = ReturnType<typeof getSupabaseAdmin>
interface PedidoPagamento extends Pedido { pagamento?: Pedido['pagamento'] & { preferencia_id?: string; preferencia_com_prazo?: boolean }; pagamento_consultado_em?: string | null; mp_payment_id?: string | null }
const dataIso = (data?: string | null) => data && Number.isFinite(Date.parse(data)) ? new Date(data).toISOString() : null

export async function registrarPagamentoVerificado(db: Db, pagamento: PaymentResponse, idEsperado?: string) {
  const id = String(pagamento.id || idEsperado || '')
  if (!/^\d+$/.test(id) || (idEsperado && id !== idEsperado) || !pagamento.external_reference || pagamento.currency_id !== 'BRL'
    || !Number.isFinite(pagamento.transaction_amount) || Number(pagamento.transaction_amount) < 0 || !pagamento.status) throw new ErroHttp(502, 'O provedor não retornou um pagamento compatível.')
  const { data, error } = await db.rpc('hh_sincronizar_pagamento', { p_pedido_id: String(pagamento.external_reference), p_pagamento_id: id,
    p_total: pagamento.transaction_amount, p_dados: { status: pagamento.status, metodo: pagamento.payment_method_id || '', tipo: pagamento.payment_type_id || '',
      parcelas: Number.isInteger(pagamento.installments) ? pagamento.installments : 1, aprovado_em: dataIso(pagamento.date_approved),
      atualizado_em: dataIso(pagamento.date_last_updated) || new Date().toISOString() } })
  if (error || !data) throw new ErroHttp(503, 'A confirmação será conferida novamente. Acompanhe o pedido pela sua conta.')
  return data as PedidoPagamento
}

export async function sincronizarPagamentoPedido(db: Db, pedido: PedidoPagamento, idInformado?: string) {
  const provider = new Payment(getMercadoPagoClient())
  let pagamento: PaymentResponse | undefined
  const idConsulta = idInformado || pedido.mp_payment_id
  if (idConsulta) {
    if (!/^\d{1,30}$/.test(idConsulta)) throw new ErroHttp(400, 'Pagamento inválido.')
    pagamento = await provider.get({ id: idConsulta })
    if (String(pagamento.external_reference) !== String(pedido.id)) throw new ErroHttp(404, 'Pagamento indisponível para este pedido.')
  } else {
    if (pedido.pagamento_consultado_em && Date.now() - Date.parse(pedido.pagamento_consultado_em) < 60_000) return pedido
    const instante = new Date().toISOString()
    let claim = db.from('pedidos').update({ pagamento_consultado_em: instante }).eq('id', pedido.id)
    claim = pedido.pagamento_consultado_em ? claim.eq('pagamento_consultado_em', pedido.pagamento_consultado_em) : claim.is('pagamento_consultado_em', null)
    const { data, error } = await claim.select('id')
    if (error) throw new Error('Falha ao reservar conferência do pagamento.')
    if (!data?.length) return pedido
    const resultado = await provider.search({ options: { external_reference: String(pedido.id), sort: 'date_created', criteria: 'desc', limit: 50 } })
    const encontrados = (resultado.results || []).filter(p => String(p.external_reference) === String(pedido.id))
    const prioridade = (status?: string) => status === 'approved' ? 0 : ['in_process', 'authorized'].includes(status || '') ? 1 : status === 'pending' ? 2 : 3
    const escolhido = encontrados.toSorted((a, b) => prioridade(a.status) - prioridade(b.status))[0]
    if (!escolhido?.id) {
      if ((resultado.results || []).length) throw new ErroHttp(502, 'Resultado de pagamento incompatível.')
      if (pedido.pagamento?.preferencia_com_prazo && pedido.pagamento.preferencia_id && Date.parse(prazoPagamento(pedido)) < Date.now() - 10 * 60_000) {
        const preferencia = await new Preference(getMercadoPagoClient()).get({ preferenceId: pedido.pagamento.preferencia_id })
        if (String(preferencia.external_reference) === String(pedido.id) && preferencia.expires === true
          && preferencia.expiration_date_to && Date.parse(preferencia.expiration_date_to) < Date.now() - 10 * 60_000) {
          const { data, error } = await db.rpc('hh_expirar_pagamento_sem_tentativa', { p_pedido_id: String(pedido.id), p_consultado_em: instante })
          if (error) throw new Error('A liberação da reserva aguarda nova conferência.')
          return data as PedidoPagamento
        }
      }
      return pedido
    }
    pagamento = await provider.get({ id: escolhido.id })
    if (String(pagamento.external_reference) !== String(pedido.id)) throw new ErroHttp(502, 'Resultado de pagamento incompatível.')
  }
  return registrarPagamentoVerificado(db, pagamento, idConsulta || undefined)
}

export async function criarPreferenciaPedido(db: Db, pedido: PedidoPagamento, email: string, novoPedido = false) {
  const vencimento = prazoPagamento(pedido)
  if (pedido.status.toLowerCase() !== 'pendente' || !Number.isFinite(Date.parse(vencimento)) || Date.now() >= Date.parse(vencimento)) throw new ErroHttp(409, 'O prazo de 24 horas para iniciar um pagamento terminou. Você pode comprar os itens novamente. Pagamentos já iniciados continuam sendo acompanhados.')
  const provider = new Preference(getMercadoPagoClient())
  if (pedido.pagamento?.preferencia_id) {
    const existente = await provider.get({ preferenceId: pedido.pagamento.preferencia_id })
    if (String(existente.external_reference) !== String(pedido.id) || !existente.init_point) throw new ErroHttp(502, 'Não foi possível retomar este pagamento.')
    return existente.init_point
  }
  const baseUrl = getSiteUrl(), retorno = baseUrl + '/sucesso?pedido=' + encodeURIComponent(pedido.id)
  const preference = await provider.create({ body: {
    items: [{ id: String(pedido.id), title: 'Pedido ' + BRAND_NAME, quantity: 1, unit_price: Number(pedido.total), currency_id: 'BRL' }],
    payer: { email }, external_reference: String(pedido.id), notification_url: baseUrl + '/api/webhooks/mercadopago',
    back_urls: { success: retorno, failure: retorno, pending: retorno },
    expires: true, expiration_date_from: new Date(pedido.created_at).toISOString(), expiration_date_to: vencimento,
    ...(baseUrl.startsWith('https://') ? { auto_return: 'approved' as const } : {}),
  } })
  if (!preference.init_point || !preference.id) throw new ErroHttp(502, 'O Mercado Pago não retornou o link de pagamento.')
  const { error } = await db.rpc('hh_registrar_preferencia', { p_pedido_id: String(pedido.id), p_email: email, p_preferencia: preference.id, p_novo: novoPedido })
  if (error) throw new ErroHttp(503, 'O link não pôde ser registrado. Consulte o pedido antes de tentar novamente.')
  return preference.init_point
}

export async function conciliarPagamentosPendentes(limite = 12) {
  const db = getSupabaseAdmin()
  const [recentes, legados] = await Promise.all([
    db.from('pedidos').select('*').in('status', ['pendente', 'Pendente']).eq('pagamento->>preferencia_com_prazo', 'true')
      .order('pagamento_consultado_em', { ascending: true, nullsFirst: true }).limit(limite),
    db.from('pedidos').select('*').in('status', ['pendente', 'Pendente']).is('pagamento->>preferencia_com_prazo', null)
      .order('pagamento_consultado_em', { ascending: true, nullsFirst: true }).limit(2),
  ])
  if (recentes.error || legados.error) throw new Error('Falha ao consultar pagamentos pendentes.')
  const data = [...(recentes.data || []), ...(legados.data || [])] as PedidoPagamento[]
  let confirmados = 0, revisoes = 0, falhas = 0
  for (let inicio = 0; inicio < data.length; inicio += 3) {
    await Promise.all(data.slice(inicio, inicio + 3).map(async pedido => {
      try { const atualizado = await sincronizarPagamentoPedido(db, pedido); if (STATUS_PAGOS.has(atualizado.status.toLowerCase())) confirmados++; else if (atualizado.status === 'pagamento_em_analise') revisoes++ }
      catch { falhas++; console.error('[pagamentos] Conferência pendente para nova tentativa.', { pedidoId: pedido.id }) }
    }))
  }
  return { consultados: data.length, confirmados, revisoes, falhas }
}
