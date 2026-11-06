const { test } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { loadTs, createDb, adapter } = require('./helpers.cjs')

const email = 'cliente@example.test'
const sku = '13faf490-7cb6-4e4f-9106-0f0502c50424'
process.env.NEXTAUTH_SECRET = 'segredo-exclusivo-dos-testes'
process.env.SITE_URL = 'https://loja.example.test'
process.env.EMAIL_USER = 'loja@example.test'
process.env.EMAIL_PASS = 'senha-de-app-dos-testes'
process.env.ADMIN_EMAIL = 'admin@example.test'
process.env.MP_ACCESS_TOKEN = 'token-exclusivo-dos-testes'
process.env.MP_WEBHOOK_SECRET = 'segredo-webhook-dos-testes'

function signedRequest(paymentId, override = {}) {
  const ts = '1791858000'
  const requestId = 'request-fixture'
  const signature = crypto.createHmac('sha256', process.env.MP_WEBHOOK_SECRET)
    .update('id:' + paymentId + ';request-id:' + requestId + ';ts:' + ts + ';').digest('hex')
  return new Request('https://loja.example.test/api/webhooks/mercadopago?data.id=' + paymentId + '&type=payment', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-request-id': requestId,
      'x-signature': 'ts=' + ts + ',v1=' + signature, ...(override.headers || {}) },
    body: JSON.stringify({ type: 'payment', data: { id: paymentId }, ...(override.body || {}) }),
  })
}

async function setup(t, idType) {
  const db = await createDb(idType)
  t.after(() => db.close())
  await db.query("INSERT INTO usuarios(email,nome,perfil,saldo_cashback) VALUES($1,'Cliente','cliente',20)", [email])
  await db.query("INSERT INTO produtos VALUES($1,'Joia premium',100)", [sku])
  const client = adapter(db)
  const messages = []
  const callbacks = []
  let failure
  let payment
  let preference
  const mocks = {
    '@/lib/supabase-admin': { getSupabaseAdmin: () => client },
    '@/lib/request-user': { getRequestUser: async () => ({ email, name: 'Cliente <script>' }) },
    'nodemailer': { createTransport: () => ({ sendMail: async message => {
      messages.push(message)
      if (failure?.(message)) throw new Error('SMTP temporariamente indisponivel')
      return { messageId: 'fixture-' + messages.length, accepted: [message.to] }
    } }) },
    'mercadopago': {
      MercadoPagoConfig: class { constructor(options) { this.options = options } },
      Payment: class { async get() { return payment } },
      Preference: class { async create(options) {
        preference = options.body
        return { id: 'preference-fixture', init_point: 'https://pagamento.example.test/pagar' }
      } },
    },
    'next/server': { ...require('next/server'), after: callback => callbacks.push(callback) },
  }
  const worker = loadTs('lib/notificacoes.ts', mocks)
  const webhook = loadTs('app/api/webhooks/mercadopago/route.ts', mocks)
  const checkout = loadTs('app/api/checkout/route.ts', mocks)
  return {
    db, client, messages, worker, webhook, checkout,
    failWhen: predicate => { failure = predicate },
    setPayment: value => { payment = value },
    getPreference: () => preference,
    flush: async () => { while (callbacks.length) await callbacks.shift()() },
    create: async (cashback = 0, total = 100) => {
      const result = await client.rpc('hh_criar_pedido', {
        p_email: email, p_nome: 'Cliente', p_total: total,
        p_itens: [{ id: sku, nome: 'Joia', preco: 100, quantidade: 1 }], p_cashback: cashback,
      })
      assert.equal(result.error, null)
      return result.data
    },
  }
}

test('checkout → pedido/cliente/admin → approved → cashback/e-mails; repeticao nao duplica', async t => {
  const s = await setup(t)
  const response = await s.checkout.POST(new Request('https://loja.example.test/api/checkout', {
    method: 'POST', body: JSON.stringify({ itens: [{ id: sku, nome: 'Adulterado', preco: 0.01, quantidade: 1 }],
      frete: 0, desconto: 999, cashbackUsado: 0 }),
  }))
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.urlPagamento, 'https://pagamento.example.test/pagar')
  assert.equal(s.getPreference().items[0].unit_price, 100)
  assert.equal(s.getPreference().notification_url, 'https://loja.example.test/api/webhooks/mercadopago')
  assert.equal(s.getPreference().external_reference, result.pedidoId)
  await s.flush()
  assert.equal(s.messages.length, 2)
  assert.ok(s.messages.some(m => m.to === process.env.ADMIN_EMAIL && /Novo pedido/.test(m.subject)))
  assert.ok(s.messages.every(m => m.from.name === 'H&H IMPORTS' && m.html.includes('H&amp;H IMPORTS')))
  assert.ok(s.messages.every(m => !m.html.includes('Cliente <script>')))
  s.setPayment({ status: 'approved', external_reference: result.pedidoId, transaction_amount: 100, currency_id: 'BRL' })
  assert.equal((await s.webhook.POST(signedRequest('123456789'))).status, 200)
  await s.flush()
  assert.equal(s.messages.length, 4)
  assert.ok(s.messages.some(m => /Pagamento aprovado/.test(m.subject) && m.to === email))
  assert.ok(s.messages.some(m => /Hora de separar/.test(m.subject) && m.to === process.env.ADMIN_EMAIL))
  assert.equal((await s.db.query('SELECT status FROM pedidos')).rows[0].status, 'confirmado')
  assert.equal(Number((await s.db.query('SELECT saldo_cashback FROM usuarios')).rows[0].saldo_cashback), 25)
  assert.equal((await s.webhook.POST(signedRequest('123456789'))).status, 200)
  await s.flush()
  assert.equal(s.messages.length, 4)
  assert.equal(Number((await s.db.query('SELECT saldo_cashback FROM usuarios')).rows[0].saldo_cashback), 25)
})

test('falha SMTP do cliente nao perde notificacao nem reenvia e-mail do admin', async t => {
  const s = await setup(t)
  const pedido = await s.create()
  await s.worker.processarNotificacoes(String(pedido.id))
  s.failWhen(m => m.to === email && /Pagamento aprovado/.test(m.subject))
  s.setPayment({ status: 'approved', external_reference: pedido.id, transaction_amount: 100, currency_id: 'BRL' })
  assert.equal((await s.webhook.POST(signedRequest('234567890'))).status, 200)
  await s.flush()
  const queue = (await s.db.query("SELECT destinatario,status FROM pedido_notificacoes WHERE evento='pagamento_aprovado' ORDER BY destinatario")).rows
  assert.deepEqual(queue.map(row => [row.destinatario,row.status]), [['admin','enviada'],['cliente','pendente']])
  s.failWhen(() => false)
  await s.db.exec("UPDATE pedido_notificacoes SET disponivel_em=now() WHERE status='pendente'")
  const before = s.messages.length
  await s.worker.processarNotificacoes(String(pedido.id))
  assert.equal(s.messages.length, before + 1)
  assert.equal(s.messages.at(-1).to, email)
  assert.equal(Number((await s.db.query('SELECT saldo_cashback FROM usuarios')).rows[0].saldo_cashback), 25)
})

test('alterar status para enviado/entregue enfileira o cliente e preserva entrega em webhook repetido', async t => {
  const s = await setup(t)
  const pedido = await s.create()
  await s.client.rpc('hh_confirmar_pagamento', { p_pedido_id: String(pedido.id), p_pagamento_id: '345678901', p_total: 100 })
  await s.worker.processarNotificacoes(String(pedido.id))
  await s.db.query("UPDATE pedidos SET status='enviado',codigo_rastreio='AB123456789BR' WHERE id=$1", [pedido.id])
  await s.worker.processarNotificacoes(String(pedido.id))
  assert.ok(s.messages.at(-1).subject.includes('Pedido enviado'))
  assert.ok(s.messages.at(-1).html.includes('AB123456789BR'))
  await s.db.query("UPDATE pedidos SET status='entregue' WHERE id=$1", [pedido.id])
  await s.worker.processarNotificacoes(String(pedido.id))
  assert.ok(s.messages.at(-1).subject.includes('Pedido entregue'))
  const before = s.messages.length
  await s.client.rpc('hh_confirmar_pagamento', { p_pedido_id: String(pedido.id), p_pagamento_id: '345678901', p_total: 100 })
  await s.worker.processarNotificacoes(String(pedido.id))
  assert.equal(s.messages.length, before)
  assert.equal((await s.db.query('SELECT status FROM pedidos')).rows[0].status, 'entregue')
})

test('assinatura falsa e IDs divergentes nao alteram pagamentos', async t => {
  const s = await setup(t)
  const pedido = await s.create()
  s.setPayment({ status: 'approved', external_reference: pedido.id, transaction_amount: 100, currency_id: 'BRL' })
  assert.equal((await s.webhook.POST(signedRequest('456789012', { headers: { 'x-signature': 'ts=1,v1=' + '0'.repeat(64) } }))).status, 401)
  assert.equal((await s.webhook.POST(signedRequest('456789012', { body: { data: { id: '999' } } }))).status, 400)
  assert.equal((await s.db.query('SELECT status FROM pedidos')).rows[0].status, 'pendente')
})

test('valor aprovado divergente retorna erro e a transacao nao credita cashback', async t => {
  const s = await setup(t)
  const pedido = await s.create()
  s.setPayment({ status: 'approved', external_reference: pedido.id, transaction_amount: 1, currency_id: 'BRL' })
  assert.equal((await s.webhook.POST(signedRequest('567890123'))).status, 503)
  assert.equal((await s.db.query('SELECT status FROM pedidos')).rows[0].status, 'pendente')
  assert.equal(Number((await s.db.query('SELECT saldo_cashback FROM usuarios')).rows[0].saldo_cashback), 20)
  assert.equal((await s.db.query("SELECT count(*)::int AS n FROM pedido_notificacoes WHERE evento='pagamento_aprovado'")).rows[0].n, 0)
})

test('claims concorrentes e leases expirados podem ser retomados sem duplicar notificacoes enviadas', async t => {
  const s = await setup(t)
  const pedido = await s.create()
  const [a,b] = await Promise.all([
    s.client.rpc('hh_claim_notifications', { p_pedido_id: String(pedido.id), p_limite: 10 }),
    s.client.rpc('hh_claim_notifications', { p_pedido_id: String(pedido.id), p_limite: 10 }),
  ])
  assert.equal(a.data.length + b.data.length, 2)
  await s.db.exec("UPDATE pedido_notificacoes SET locked_until=now()-interval '1 second'")
  await s.worker.processarNotificacoes(String(pedido.id))
  assert.equal(s.messages.length, 2)
  await s.worker.processarNotificacoes(String(pedido.id))
  assert.equal(s.messages.length, 2)
})

test('cashback insuficiente nao cria pedido; pedido de total zero notifica cliente e admin', async t => {
  const s = await setup(t, 'bigint')
  const failed = await s.client.rpc('hh_criar_pedido', {
    p_email: email, p_nome: 'Cliente', p_total: 0, p_itens: [], p_cashback: 21,
  })
  assert.ok(failed.error)
  assert.equal((await s.db.query('SELECT count(*)::int AS n FROM pedidos')).rows[0].n, 0)
  const pedido = await s.create(20, 0)
  assert.equal(pedido.status, 'pago')
  await s.worker.processarNotificacoes(String(pedido.id))
  assert.equal(s.messages.length, 4)
  assert.ok(s.messages.find(m => m.to === email && m.subject.includes('recebido')).html.includes('pagamento está confirmado'))
  assert.equal(Number((await s.db.query('SELECT saldo_cashback FROM usuarios')).rows[0].saldo_cashback), 0)
})

test('recuperacao de senha e troca mantem compatibilidade; destinatario SMTP rejeitado falha', async () => {
  const messages = []
  const mail = loadTs('lib/mail.ts', { nodemailer: { createTransport: () => ({
    sendMail: async message => { messages.push(message); return { accepted: [], messageId: 'reject' } },
  }) } })
  assert.equal((await mail.enviarEmailStatus(email, '<img>', 'recuperacao', 'abc&123')).sucesso, false)
  assert.ok(messages[0].html.includes('abc%26123'))
  assert.ok(messages[0].html.includes('&lt;img&gt;'))
  assert.equal((await mail.enviarEmailStatus(email, 'Cliente', 'troca_aprovada', 'COD123')).sucesso, false)
  assert.ok(messages[1].html.includes('COD123'))
  assert.equal((await mail.enviarEmailStatus(email, 'Cliente', 'desconhecido')).sucesso, false)
})

test('cookie NextAuth real permite ler identidade e token invalido nao autentica', async () => {
  const { encode } = require('next-auth/jwt')
  const { getRequestUser } = loadTs('lib/request-user.ts')
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET, token: { email, name: 'Cliente' } })
  const request = new Request('http://localhost/api/checkout', {
    method: 'POST', headers: { cookie: 'next-auth.session-token=' + token },
    body: JSON.stringify({ itens: [] }),
  })
  assert.deepEqual(await getRequestUser(request), { email, name: 'Cliente' })
  assert.deepEqual(await request.json(), { itens: [] })
  assert.equal(await getRequestUser(new Request('http://localhost/api/checkout', { headers: { cookie: 'next-auth.session-token=invalido' } })), null)
})


test('disparo do painel exige administrador e cron exige segredo', async t => {
  const s = await setup(t)
  const callbacks = []
  const privateApi = loadTs('app/api/notificacoes/pedido/route.ts', {
    '@/lib/supabase-admin': { getSupabaseAdmin: () => s.client },
    '@/lib/request-user': { getRequestUser: async () => ({ email, name: 'Cliente' }) },
    'next/server': { ...require('next/server'), after: callback => callbacks.push(callback) },
    '@/lib/notificacoes': { processarNotificacoes: async () => ({ processadas: 0, enviadas: 0, falhas: 0 }) },
  })
  const pedido = await s.create()
  const request = () => new Request('https://loja.example.test/api/notificacoes/pedido', {
    method: 'POST', body: JSON.stringify({ pedidoId: pedido.id }),
  })
  assert.equal((await privateApi.POST(request())).status, 403)
  assert.equal(callbacks.length, 0)
  await s.db.query("UPDATE usuarios SET role='admin' WHERE email=$1", [email])
  assert.equal((await privateApi.POST(request())).status, 200)
  assert.equal(callbacks.length, 1)
  process.env.CRON_SECRET = 'segredo-cron-dos-testes'
  const cron = loadTs('app/api/cron/notificacoes/route.ts', {
    '@/lib/etiquetas': { retomarEtiquetasPendentes: async () => ({ consultadas: 0, concluidas: 0 }) },
    '@/lib/notificacoes': { processarNotificacoes: async () => ({ processadas: 0, enviadas: 0, falhas: 0 }) },
  })
  assert.equal((await cron.GET(new Request('https://loja.example.test/api/cron/notificacoes'))).status, 401)
  assert.equal((await cron.GET(new Request('https://loja.example.test/api/cron/notificacoes', {
    headers: { authorization: 'Bearer ' + process.env.CRON_SECRET },
  }))).status, 200)
})


test('descontos arbitrarios nao criam venda gratuita; ofertas usam cupom real e boas-vindas', async t => {
  const s = await setup(t)
  const request = code => new Request('https://loja.example.test/api/checkout', {
    method: 'POST', body: JSON.stringify({
      itens: [{ id: sku, quantidade: 1 }], codigoCupom: code, frete: 0, cashbackUsado: 0,
    }),
  })
  assert.equal((await s.checkout.POST(request('OFERTA100'))).status, 400)
  assert.equal((await s.db.query('SELECT count(*)::int AS n FROM pedidos')).rows[0].n, 0)
  assert.equal((await s.checkout.POST(request('BEMVINDO10'))).status, 200)
  assert.equal(s.getPreference().items[0].unit_price, 90)
  await s.db.exec("INSERT INTO cupons(codigo,desconto,ativo) VALUES('PROMO20',20,true)")
  assert.equal((await s.checkout.POST(request('OFERTA25'))).status, 200)
  assert.equal(s.getPreference().items[0].unit_price, 75)
})


test('checkout ignora frete adulterado e exige cotação assinada para o CEP do cadastro', async t => {
  const s = await setup(t)
  await s.db.exec("UPDATE produtos SET preco=50")
  process.env.CEP_ORIGEM = '89209452'
  const { assinarCotacao, hashItensFrete } = loadTs('lib/frete.ts')
  const detalhes = { origem: '89209452', ambiente: 'production', itensHash: hashItensFrete([{ id: sku, quantidade: 1, preco: 50 }]), servico: 1, nome: 'PAC', transportadora: 'Correios', seguro: 50, volume: { width: 11, height: 3, length: 16, weight: 0.15 } }
  const request = token => new Request('https://loja.example.test/api/checkout', { method: 'POST', body: JSON.stringify({
    itens: [{ id: sku, quantidade: 1 }], frete: 0, freteToken: token,
  }) })
  assert.equal((await s.checkout.POST(request(undefined))).status, 400)
  assert.equal((await s.checkout.POST(request(assinarCotacao('99999999', 17.37)))).status, 400)
  assert.equal((await s.checkout.POST(request(assinarCotacao('01310100', 17.37, detalhes)))).status, 200)
  assert.equal(s.getPreference().items[0].unit_price, 67.37)
})

test('cupom de outra pessoa não é utilizável e checkout sem estoque retorna conflito', async t => {
  const s = await setup(t)
  await s.db.exec("INSERT INTO cupons(codigo,desconto,usuario_id) VALUES('PRIVADO',40,gen_random_uuid())")
  const request = codigoCupom => new Request('https://loja.example.test/api/checkout', { method: 'POST', body: JSON.stringify({ itens: [{ id: sku, quantidade: 1 }], codigoCupom }) })
  assert.equal((await s.checkout.POST(request('PRIVADO'))).status, 400)
  await s.db.exec('UPDATE produtos SET estoque=0')
  assert.equal((await s.checkout.POST(request(null))).status, 409)
  assert.equal((await s.db.query('SELECT count(*)::int AS n FROM pedidos')).rows[0].n, 0)
})
