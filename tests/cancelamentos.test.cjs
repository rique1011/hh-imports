const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTs, createDb, adapter } = require('./helpers.cjs')
const base = 'https://loja.test', sku = '10000000-0000-4000-8000-000000000001'
process.env.NEXTAUTH_SECRET = 'fixture-cancelamentos'; process.env.SITE_URL = base; process.env.MP_ACCESS_TOKEN = 'fixture-only'
const request = (path, body, origin = base) => new Request(base + path, { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
async function setup(t) {
  const db = await createDb('bigint', 'bigint'); t.after(() => db.close()); const client = adapter(db)
  await db.exec("insert into usuarios(nome,email,role,perfil,email_verificado,senha_politica_versao,mfa_secret,saldo_cashback) values('Admin','admin@example.test','admin','admin',true,1,'fixture',0),('Cliente','cliente@example.test','cliente','cliente',true,1,null,100),('Outra','outra@example.test','cliente','cliente',true,1,null,0)")
  await db.query("insert into produtos(id,nome,slug,preco,estoque,fotos) values($1,'Colar','colar',23,10,array['/icon.svg'])", [sku])
  let session = null, comportamento = 'sucesso'; const pagamentos = new Map(), refunds = [], emails = [], callbacks = []
  const mocks = {
    '@/lib/supabase-admin': { getSupabaseAdmin: () => client }, '@/lib/request-user': { getRequestUser: async () => session },
    'next/server': { ...require('next/server'), after: fn => callbacks.push(fn) },
    mercadopago: { MercadoPagoConfig: class {}, Payment: class { async get({ id }) { return { ...pagamentos.get(String(id)) } } }, PaymentRefund: class { async total({ payment_id, requestOptions }) {
      refunds.push({ id: payment_id, chave: requestOptions.idempotencyKey })
      if (comportamento === 'recusa') throw Error('Saldo insuficiente simulado')
      if (comportamento === 'confirmacao-pendente') return { id: 999, status: 'approved' }
      const p = pagamentos.get(String(payment_id)); p.status = 'refunded'; p.transaction_amount_refunded = p.transaction_amount; p.date_last_updated = new Date().toISOString()
      if (comportamento === 'timeout') throw Error('Timeout após sucesso remoto simulado')
      return { id: 999, status: 'approved' }
    } } },
    '@/lib/mail': Object.fromEntries(['enviarEmailRetirada','enviarEmailCancelamento','enviarEmailPedidoRecebido','enviarEmailStatus','notificarAdminNovoPedido','notificarAdminPagamentoAprovado'].map(nome => [nome, async (...args) => { emails.push({ nome, args }); return { sucesso: true, messageId: 'fixture' } }])),
  }
  async function usuario(id, mfa = false) { const u = (await db.query('select * from usuarios where id=$1', [id])).rows[0]; session = { id: String(id), email: u.email, sessaoVersao: u.sessao_versao, senhaAtual: true, mfa } }
  await usuario(2)
  const pedido = async id => (await db.query('select * from pedidos where id=$1', [id])).rows[0]
  const cancelamento = async id => (await db.query('select * from pedido_cancelamentos where pedido_id=$1', [id])).rows[0]
  async function comprar({ cashback = 0, frete = 0, pagar = true } = {}) {
    const { data, error } = await client.rpc('hh_criar_pedido', { p_email: 'cliente@example.test', p_nome: 'Cliente', p_total: Math.round((23 + frete - cashback) * 100) / 100, p_itens: [{ id: sku, nome: 'Colar', preco: 23, quantidade: 1 }], p_cashback: cashback })
    assert.equal(error, null)
    const id = String(data.id)
    if (pagar && Number(data.total) > 0) {
      const p = { id: 9000 + Number(id), external_reference: id, currency_id: 'BRL', status: 'approved', transaction_amount: Number(data.total), transaction_amount_refunded: 0, date_approved: new Date().toISOString(), date_last_updated: new Date().toISOString(), payment_method_id: 'pix', payment_type_id: 'bank_transfer' }
      pagamentos.set(String(p.id), p); await loadTs('lib/pagamentos', mocks).registrarPagamentoVerificado(client, p)
    }
    return id
  }
  const route = loadTs('app/api/pedidos/[id]/cancelamento/route', mocks), admin = loadTs('app/api/admin/cancelamentos/route', mocks)
  const cancelar = (id, body = {}, origin = base) => route.POST(request('/api/pedidos/' + id + '/cancelamento', { confirmar: true, motivo: 'Desisti da compra', ...body }, origin), { params: Promise.resolve({ id }) })
  const processar = id => loadTs('lib/cancelamentos', mocks).processarCancelamentos(id)
  const notificar = () => loadTs('lib/notificacoes', mocks).processarNotificacoes(undefined, 30)
  return { db, client, mocks, usuario, pedido, cancelamento, comprar, cancelar, processar, notificar, admin, refunds, emails, callbacks, pagamentos, comportamento: value => { comportamento = value } }
}
test('cliente cancela pedido aprovado; valor com frete e créditos retorna apenas após confirmação, sem duplicar estoque ou cashback', async t => {
  const s = await setup(t), id = await s.comprar({ cashback: 10, frete: 12.34 })
  assert.equal((await s.cancelar(id, { valor: 0.01, pagamento_id: 'injetado', admin: true })).status, 202); assert.equal((await s.pedido(id)).status, 'cancelamento_pendente'); assert.equal(s.refunds.length, 0)
  assert.equal((await s.db.query('select estoque from produtos')).rows[0].estoque, 9)
  const resultados = await Promise.all([s.processar(), s.processar()]); assert.equal(s.refunds.length, 1); assert.ok(resultados.some(r => r.concluidos === 1))
  const c = await s.cancelamento(id); assert.equal(c.estado, 'cancelado'); assert.equal(Number(c.valor), 25.34); assert.equal(s.refunds[0].chave, c.reembolso_chave)
  assert.equal((await s.pedido(id)).status, 'cancelado'); assert.equal((await s.db.query('select estoque from produtos')).rows[0].estoque, 10)
  assert.equal(Number((await s.db.query('select saldo_cashback from usuarios where id=2')).rows[0].saldo_cashback), 100)
  assert.equal((await s.cancelar(id)).status, 202); await s.processar(); assert.equal(s.refunds.length, 1)
  assert.equal((await s.db.query('select estoque from produtos')).rows[0].estoque, 10)
  const pg = s.pagamentos.values().next().value; await loadTs('lib/pagamentos', s.mocks).registrarPagamentoVerificado(s.client, { ...pg, date_last_updated: new Date().toISOString() })
  assert.equal((await s.pedido(id)).status, 'cancelado')
})
test('timeout após sucesso remoto retoma por consulta, sem segunda devolução, e recusa do provedor preserva a chave entre tentativas', async t => {
  const s = await setup(t), id = await s.comprar(); await s.cancelar(id); s.comportamento('recusa'); await s.processar()
  assert.equal((await s.cancelamento(id)).estado, 'reembolso_pendente'); assert.ok((await s.cancelamento(id)).erro)
  assert.equal((await s.db.query('select estoque from produtos')).rows[0].estoque, 9)
  await s.db.exec('update pedido_cancelamentos set proxima_tentativa=now()'); s.comportamento('timeout'); await s.processar()
  assert.equal((await s.cancelamento(id)).estado, 'reembolso_pendente'); assert.equal(s.refunds[0].chave, s.refunds[1].chave)
  await s.db.exec('update pedido_cancelamentos set proxima_tentativa=now()'); await s.processar()
  assert.equal(s.refunds.length, 2); assert.equal((await s.cancelamento(id)).estado, 'cancelado')
})
test('retorno de sucesso da API de reembolso sem confirmação financeira mantém pedido pendente; confirmação posterior conclui sem nova chamada', async t => {
  const s = await setup(t), id = await s.comprar(); await s.cancelar(id); s.comportamento('confirmacao-pendente'); await s.processar()
  assert.equal((await s.cancelamento(id)).estado, 'reembolso_pendente'); assert.equal((await s.pedido(id)).status, 'cancelamento_pendente')
  const pg = s.pagamentos.values().next().value; pg.status = 'refunded'; pg.transaction_amount_refunded = pg.transaction_amount; pg.date_last_updated = new Date().toISOString()
  await s.db.exec('update pedido_cancelamentos set proxima_tentativa=now()'); await s.processar()
  assert.equal(s.refunds.length, 1); assert.equal((await s.cancelamento(id)).estado, 'cancelado')
})
test('pagamento incompatível, pendente, contestado ou parcialmente reembolsado nunca recebe chamada de estorno', async t => {
  const s = await setup(t), id = await s.comprar(); await s.cancelar(id)
  const pg = s.pagamentos.values().next().value, original = { ...pg }
  for (const mudanca of [{ external_reference: '999' }, { id: 42 }, { currency_id: 'USD' }, { transaction_amount: 1 }, { status: 'pending' }, { status: 'charged_back' }, { status: 'in_mediation' }, { transaction_amount_refunded: 1 }]) {
    Object.assign(pg, original, mudanca); await s.db.exec('update pedido_cancelamentos set proxima_tentativa=now()'); await s.processar()
    assert.equal(s.refunds.length, 0, JSON.stringify(mudanca)); assert.equal((await s.cancelamento(id)).estado, 'reembolso_pendente')
  }
})
test('pagamento já integralmente reembolsado no Mercado Pago é conciliado sem segunda solicitação', async t => {
  const s = await setup(t), id = await s.comprar(); await s.cancelar(id)
  const pg = s.pagamentos.values().next().value; pg.status = 'refunded'; pg.transaction_amount_refunded = pg.transaction_amount
  await s.processar(); assert.equal(s.refunds.length, 0); assert.equal((await s.cancelamento(id)).estado, 'cancelado')
})
test('pedido pago somente com créditos cancela sem chamada externa e devolve o saldo exatamente uma vez', async t => {
  const s = await setup(t), id = await s.comprar({ cashback: 23 }); await s.cancelar(id); await s.processar(); await s.processar()
  assert.equal(s.refunds.length, 0); assert.equal((await s.cancelamento(id)).estado, 'cancelado')
  assert.equal(Number((await s.db.query('select saldo_cashback from usuarios where id=2')).rows[0].saldo_cashback), 100)
})
test('cancelamento exige dono autenticado, origem local e confirmação; corpo não concede poderes administrativos', async t => {
  const s = await setup(t), id = await s.comprar()
  assert.equal((await s.cancelar(id, {}, 'https://externa.test')).status, 403)
  assert.equal((await s.cancelar(id, { confirmar: false })).status, 400)
  assert.equal((await s.cancelar(id, { motivo: 'x' })).status, 400)
  assert.equal((await s.cancelar('invalido')).status, 400)
  await s.usuario(3); assert.equal((await s.cancelar(id, { admin: true, email: 'cliente@example.test' })).status, 404)
  assert.equal((await s.admin.POST(request('/api/admin/cancelamentos', { acao: 'cancelar', pedidoId: id, confirmar: true, motivo: 'Teste' }))).status, 403)
  await s.usuario(1); assert.equal((await s.admin.POST(request('/api/admin/cancelamentos', { acao: 'retomar', pedidoId: id }))).status, 403)
  assert.equal(s.refunds.length, 0)
})
test('admin autenticado com MFA cancela e retoma pendência pelo painel; pedido pago após liberar estoque também pode ser resolvido', async t => {
  const s = await setup(t), id = await s.comprar({ pagar: false })
  await s.db.query("update pedidos set status='cancelado' where id=$1", [id])
  const pg = { id: 9001, external_reference: id, currency_id: 'BRL', status: 'approved', transaction_amount: 23, transaction_amount_refunded: 0, date_last_updated: new Date().toISOString() }
  s.pagamentos.set('9001', pg); await loadTs('lib/pagamentos', s.mocks).registrarPagamentoVerificado(s.client, pg)
  assert.equal((await s.pedido(id)).status, 'pagamento_em_analise'); assert.equal((await s.cancelar(id)).status, 409)
  await s.usuario(1, true)
  assert.equal((await s.admin.POST(request('/api/admin/cancelamentos', { acao: 'cancelar', pedidoId: id, confirmar: true, motivo: 'Pagamento recebido após expiração da reserva' }))).status, 202)
  s.comportamento('recusa'); await s.processar(); s.comportamento('sucesso')
  assert.equal((await s.admin.POST(request('/api/admin/cancelamentos', { acao: 'retomar', pedidoId: id }))).status, 202)
  await s.processar(); assert.equal((await s.pedido(id)).status, 'cancelado'); assert.equal((await s.db.query('select estoque from produtos')).rows[0].estoque, 10)
})
test('pedido pendente, enviado, entregue, com rastreio ou etiqueta em operação bloqueia cancelamento automático', async t => {
  const s = await setup(t), pendente = await s.comprar({ pagar: false }); assert.equal((await s.cancelar(pendente)).status, 409)
  for (const status of ['enviado', 'entregue']) { const id = await s.comprar(); await s.db.query('update pedidos set status=$1 where id=$2', [status, id]); assert.equal((await s.cancelar(id)).status, 409) }
  const id = await s.comprar(); await s.db.query("update pedidos set codigo_rastreio='BR123456789' where id=$1", [id]); assert.equal((await s.cancelar(id)).status, 409)
  const etiqueta = await s.comprar(); const e = await s.client.rpc('hh_claim_envio', { p_pedido_id: etiqueta, p_lease: require('node:crypto').randomUUID(), p_ambiente: 'production', p_config: {} }); assert.equal(e.error, null)
  assert.equal((await s.cancelar(etiqueta)).status, 409)
  await s.db.query("update pedido_envios set locked_until=null,me_id='remoto',estado='carrinho' where pedido_id=$1", [etiqueta]); assert.equal((await s.cancelar(etiqueta)).status, 409)
  assert.equal(s.refunds.length, 0)
})
test('solicitações concorrentes e geração de etiqueta nunca autorizam reembolso e postagem do mesmo pedido', async t => {
  const s = await setup(t), id = await s.comprar()
  const respostas = await Promise.all([s.cancelar(id), s.cancelar(id)]); assert.deepEqual(respostas.map(r => r.status), [202, 202])
  const geracao = await s.client.rpc('hh_claim_envio', { p_pedido_id: id, p_lease: require('node:crypto').randomUUID(), p_ambiente: 'production', p_config: {} }); assert.ok(geracao.error)
  await assert.rejects(s.db.query("update pedidos set status='enviado' where id=$1", [id]), /cancelado/)
  await Promise.all([s.processar(), s.processar()]); assert.equal(s.refunds.length, 1)
  const id2 = await s.comprar(), corrida = await Promise.all([s.client.rpc('hh_solicitar_cancelamento_entrega', { p_pedido_id: id2, p_email: 'cliente@example.test', p_admin: false, p_solicitante: '2', p_motivo: 'Desisti' }), s.client.rpc('hh_claim_envio', { p_pedido_id: id2, p_lease: require('node:crypto').randomUUID(), p_ambiente: 'production', p_config: {} })])
  assert.equal(corrida.filter(r => !r.error).length, 1)
})
test('estado e ações chegam ao dono e admin sem expor pagamento, chaves ou leases; RLS e RPCs são privados', async t => {
  const s = await setup(t), id = await s.comprar(); await s.cancelar(id); s.comportamento('recusa'); await s.processar()
  const route = loadTs('app/api/pedidos/[id]/route', s.mocks), res = await route.GET(new Request(base + '/api/pedidos/' + id), { params: Promise.resolve({ id }) })
  assert.equal(res.status, 200); const p = await res.json(), c = await s.cancelamento(id)
  assert.equal(p.cancelamento.estado, 'reembolso_pendente'); assert.equal(p.pode_cancelar, false); assert.equal(p.cancelamento.erro, null)
  for (const segredo of [c.reembolso_chave, 'lease_id', 'pagamento_id', 'mp_payment_id']) assert.equal(JSON.stringify(p).includes(segredo), false)
  await s.usuario(3); assert.equal((await route.GET(new Request(base + '/api/pedidos/' + id), { params: Promise.resolve({ id }) })).status, 404)
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await s.db.query("select has_table_privilege($1,'pedido_cancelamentos','select,insert,update,delete') ok", [role])).rows[0].ok, false)
    for (const f of ['hh_solicitar_cancelamento_entrega(text,text,boolean,text,text)', 'hh_resumo_cancelamentos(text[],boolean)', 'hh_concluir_cancelamento_entrega(text,uuid)']) assert.equal((await s.db.query("select has_function_privilege($1,$2,'execute') ok", [role, f])).rows[0].ok, false)
  }
})
test('e-mails refletem confirmação real; avisos de aprovação e pendência obsoletos não são enviados após reembolso', async t => {
  const s = await setup(t), id = await s.comprar(); await s.cancelar(id); s.comportamento('recusa'); await s.processar(); await s.notificar()
  assert.ok(s.emails.some(e => e.nome === 'enviarEmailCancelamento' && e.args[1] === 'cancelamento_solicitado'))
  assert.ok(s.emails.some(e => e.nome === 'enviarEmailCancelamento' && e.args[1] === 'cancelamento_atencao'))
  assert.equal(s.emails.some(e => e.nome === 'enviarEmailPedidoRecebido' || e.nome === 'enviarEmailStatus'), false)
  assert.equal(s.emails.some(e => e.args[1] === 'cancelamento_reembolsado'), false)
  s.comportamento('sucesso'); await s.db.exec('update pedido_cancelamentos set proxima_tentativa=now()'); await s.processar(); await s.notificar()
  assert.equal(s.emails.filter(e => e.args[1] === 'cancelamento_reembolsado').length, 1)
  await s.notificar(); assert.equal(s.emails.filter(e => e.args[1] === 'cancelamento_reembolsado').length, 1)
})
