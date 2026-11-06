const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID, createHmac } = require('node:crypto')
const { loadTs, createDb, adapter } = require('./helpers.cjs')
const sku = '13faf490-7cb6-4e4f-9106-0f0502c50424'
const meId = '12345678-1234-4234-8234-123456789012'
const entrega = { nome: 'Cliente', email: 'cliente@example.test', documento: '12345678901', telefone: '11999999999', cep: '01310100', logradouro: 'Rua Teste', numero: '10', complemento: '', bairro: 'Centro', cidade: 'Sao Paulo', uf: 'SP' }
const itens = [{ id: sku, nome: 'Joia', quantidade: 1, preco: 100 }]
process.env.NEXTAUTH_SECRET = 'teste-automacao'
process.env.CEP_ORIGEM = '89209452'
process.env.EMAIL_USER = 'loja@example.test'
process.env.MELHOR_ENVIO_TOKEN = 'token-ficticio'
process.env.MELHOR_ENVIO_REMETENTE = JSON.stringify({ ...entrega, nome: 'Remetente de Teste', cep: '89209452' })
process.env.MELHOR_ENVIO_AMBIENTE = 'production'
process.env.MP_WEBHOOK_SECRET = 'teste-webhook-automacao'
process.env.MP_ACCESS_TOKEN = 'mp-ficticio'
process.env.CRON_SECRET = 'cron-ficticio'

async function setup(t, options = {}) {
  const db = await createDb(options.idType || 'bigint'); t.after(() => db.close())
  const client = adapter(db), callbacks = [], chamadas = [], emails = []
  await db.query("INSERT INTO usuarios(email,nome,saldo_cashback) VALUES($1,'Cliente',200)", [entrega.email])
  await db.query("INSERT INTO produtos(id,nome,preco,estoque) VALUES($1,'Joia',100,100)", [sku])
  if (options.ativa !== false) await db.exec("UPDATE envio_automatico_config SET ativa=true,documento_fiscal='declaracao',declaracao_confirmada=true,limite_centavos=2500")
  const api = loadTs('lib/melhor-envio'), remoto = { id: meId, status: 'pending', tracking: null, generated_at: null, paid_at: null }
  let semSaldo = false, timeoutCart = false, timeoutCheckout = false, hook, payment, numeroPagamento = 123455
  let cotacoes = [{ id: 1, name: 'PAC', price: '17.37', delivery_time: 5 }, { id: 2, name: 'SEDEX', price: '20', delivery_time: 2 }]
  const fornecedor = async (path, body) => {
    chamadas.push({ path, body })
    if (path === '/shipment/calculate') return cotacoes
    if (path === '/cart') {
      if (hook) await hook()
      if (timeoutCart) throw new api.ErroMelhorEnvio(0, path)
      return { id: meId, price: body.service === 2 ? '20' : '17.37' }
    }
    if (path === '/shipment/checkout') {
      if (semSaldo) throw new api.ErroMelhorEnvio(422, path)
      if (timeoutCheckout) throw new api.ErroMelhorEnvio(0, path)
      remoto.paid_at = new Date().toISOString(); remoto.status = 'released'; return { purchase: { id: 'fixture' } }
    }
    if (path === '/shipment/generate') { remoto.generated_at = new Date().toISOString(); return { [meId]: true } }
    if (path.startsWith('/orders/')) return { ...remoto }
    throw new Error('Chamada externa inesperada: ' + path)
  }
  const mocks = {
    '@/lib/supabase-admin': { getSupabaseAdmin: () => client },
    '@/lib/seguranca': {...loadTs('lib/seguranca'),limitar:async()=>{}},
    '@/lib/autorizacao': {...loadTs('lib/autorizacao'),exigirUsuario:async()=>({id:'fixture',email:entrega.email,nome:'Cliente',db:client})},
    '@/lib/pagamentos': {...loadTs('lib/pagamentos'),sincronizarPagamentoPedido:async(_db,p)=>({...p,pagamento:{status:'approved'}})},
    '@/lib/melhor-envio': { ...api, melhorEnvio: fornecedor },
    '@/lib/notificacoes': { processarNotificacoes: async id => { emails.push(id) } },
    '@/lib/request-user': { getRequestUser: async () => ({ email: entrega.email, name: entrega.nome }) },
    'mercadopago': { MercadoPagoConfig: class {}, Payment: class { async get() { return payment } }, Preference: class { async create() { return { id: 'preference-fixture', init_point: 'https://pagamento.example.test' } } } },
    'next/server': { ...require('next/server'), after: callback => callbacks.push(callback) },
  }
  const lib = loadTs('lib/envio-automatico', mocks)
  async function criar({ pago = true, total = 100, cashback = 0, frete = null } = {}) {
    const { data: pedido, error } = await client.rpc('hh_criar_pedido_com_envio', { p_email: entrega.email, p_nome: entrega.nome,
      p_total: total, p_itens: itens, p_cashback: cashback, p_entrega: entrega, p_frete: frete })
    assert.equal(error, null)
    if (pago && total > 0) {
      const aprovado = await client.rpc('hh_confirmar_pagamento', { p_pedido_id: String(pedido.id), p_pagamento_id: String(++numeroPagamento), p_total: total })
      assert.equal(aprovado.error, null)
    }
    return String(pedido.id)
  }
  return { db, client, lib, mocks, criar, remoto, chamadas, emails, callbacks,
    processar: id => lib.processarEnvioAutomatico(id, 1),
    due: id => db.query('UPDATE envio_automatico_fila SET proxima_tentativa=now() WHERE pedido_id::text=$1', [id]),
    job: async id => (await db.query('SELECT * FROM envio_automatico_fila WHERE pedido_id::text=$1', [id])).rows[0],
    flush: async () => { while (callbacks.length) await callbacks.shift()() },
    saldo: value => { semSaldo = !value }, falhaCart: () => { timeoutCart = true }, falhaCheckout: () => { timeoutCheckout = true },
    hook: value => { hook = value }, cotacoes: value => { cotacoes = value }, setPayment: value => { payment = value } }
}

test('instalação desativada não compra pedidos antigos; só pagamento novo ativo cria uma entrada', async t => {
  const s = await setup(t, { ativa: false })
  const antigo = await s.criar(), pendente = await s.criar({ pago: false })
  assert.equal(await s.job(antigo), undefined)
  await s.db.exec("UPDATE envio_automatico_config SET ativa=true,documento_fiscal='declaracao',declaracao_confirmada=true,limite_centavos=2500")
  await s.db.query("UPDATE pedidos SET status='processando' WHERE id::text=$1", [antigo])
  assert.equal(await s.job(antigo), undefined)
  assert.deepEqual(await s.processar(antigo), { processado: false })
  assert.deepEqual(await s.processar(pendente), { processado: false })
  await s.client.rpc('hh_confirmar_pagamento', { p_pedido_id: pendente, p_pagamento_id: '456', p_total: 100 })
  await s.client.rpc('hh_confirmar_pagamento', { p_pedido_id: pendente, p_pagamento_id: '456', p_total: 100 })
  assert.equal((await s.job(pendente)).estado, 'pendente')
  assert.equal((await s.db.query('SELECT count(*)::int AS n FROM envio_automatico_fila')).rows[0].n, 1)
  assert.equal(s.chamadas.length, 0)
})

test('pagamento → fila → compra → PDF/rastreio/e-mail sem botão; replays não duplicam', async t => {
  const s = await setup(t), id = await s.criar()
  await s.processar(id)
  assert.equal((await s.job(id)).estado, 'aguardando')
  s.remoto.tracking = 'AA123456789BR'; await s.due(id); await s.processar(id)
  assert.equal((await s.job(id)).estado, 'concluida')
  assert.deepEqual((await s.db.query('SELECT status,codigo_rastreio FROM pedidos')).rows[0], { status: 'enviado', codigo_rastreio: 'AA123456789BR' })
  assert.equal((await s.db.query("SELECT count(*)::int AS n FROM pedido_notificacoes WHERE evento='enviado'")).rows[0].n, 1)
  await s.client.rpc('hh_confirmar_pagamento', { p_pedido_id: id, p_pagamento_id: '123456', p_total: 100 })
  await s.due(id); await s.processar(id)
  for (const path of ['/cart','/shipment/checkout','/shipment/generate']) assert.equal(s.chamadas.filter(c => c.path === path).length, 1)
  assert.equal(s.emails.length, 1)
  const cart = s.chamadas.find(c => c.path === '/cart').body
  assert.equal(cart.options.non_commercial, true); assert.equal('invoice' in cart.options, false)
})

test('frete acima do teto e serviço indisponível param antes de criar/comprar etiqueta', async t => {
  const s = await setup(t), id = await s.criar({ frete: { servico: 1 } })
  s.cotacoes([{ id: 1, name: 'PAC', price: '35', delivery_time: 5 }]); await s.processar(id)
  assert.equal((await s.job(id)).estado, 'atencao'); assert.match((await s.job(id)).mensagem, /limite/)
  s.cotacoes([{ id: 2, name: 'SEDEX', price: '10', delivery_time: 2 }])
  assert.equal((await s.client.rpc('hh_retomar_envio_automatico', { p_pedido_id: id, p_nota_fiscal: null })).error, null); await s.processar(id)
  assert.match((await s.job(id)).mensagem, /serviço contratado/)
  assert.equal(s.chamadas.filter(c => c.path === '/cart').length, 0)
})

test('frete grátis escolhe o menor preço autorizado; frete contratado mantém o serviço', async t => {
  for (const contratado of [false, true]) {
    const s = await setup(t), id = await s.criar({ frete: contratado ? { servico: 2 } : null })
    s.cotacoes([{ id: 1, name: 'PAC', price: '17.37', delivery_time: 5 }, { id: 2, name: 'SEDEX', price: '20', delivery_time: 2 }, { id: 99, name: 'Outro', price: '5', delivery_time: 1 }])
    await s.processar(id)
    assert.equal(s.chamadas.find(c => c.path === '/cart').body.service, contratado ? 2 : 1)
  }
})

test('NF-e aguarda chave válida; após informar continua automaticamente', async t => {
  const s = await setup(t)
  await s.db.exec("UPDATE envio_automatico_config SET documento_fiscal='nfe',declaracao_confirmada=false")
  const id = await s.criar(); await s.processar(id)
  assert.equal((await s.job(id)).estado, 'aguardando_documento'); assert.equal(s.chamadas.length, 0)
  assert.ok((await s.client.rpc('hh_retomar_envio_automatico', { p_pedido_id: id, p_nota_fiscal: '12' })).error)
  assert.equal((await s.client.rpc('hh_retomar_envio_automatico', { p_pedido_id: id, p_nota_fiscal: '1'.repeat(44) })).error, null); await s.processar(id)
  assert.equal(s.chamadas.find(c => c.path === '/cart').body.options.invoice.key, '1'.repeat(44))
})

test('saldo insuficiente pede atenção; após recarga retoma o mesmo ID', async t => {
  const s = await setup(t), id = await s.criar(); s.saldo(false); await s.processar(id)
  assert.equal((await s.job(id)).estado, 'atencao'); assert.match((await s.job(id)).mensagem, /saldo/)
  assert.equal((await s.db.query('SELECT estado FROM pedido_envios')).rows[0].estado, 'carrinho')
  s.saldo(true); assert.equal((await s.client.rpc('hh_retomar_envio_automatico', { p_pedido_id: id, p_nota_fiscal: null })).error, null); await s.processar(id)
  assert.equal(s.chamadas.filter(c => c.path === '/cart').length, 1)
  assert.equal(s.chamadas.filter(c => c.path === '/shipment/checkout').length, 2)
})

test('timeout no checkout consulta sem repetir cobrança; inserção incerta exige conciliação', async t => {
  for (const operacao of ['checkout','cart']) {
    const s = await setup(t), id = await s.criar()
    if (operacao === 'cart') s.falhaCart(); else s.falhaCheckout()
    await s.processar(id); await s.due(id); await s.processar(id)
    if (operacao === 'cart') assert.equal((await s.job(id)).estado, 'atencao')
    else assert.equal((await s.job(id)).estado, 'aguardando')
    assert.equal(s.chamadas.filter(c => c.path === '/cart').length, 1)
    assert.equal(s.chamadas.filter(c => c.path === '/shipment/checkout').length, operacao === 'cart' ? 0 : 1)
  }
})

test('leases concorrentes, troca para manual e pausa global impedem outra compra', async t => {
  const s = await setup(t), id = await s.criar()
  let iniciou, continuar
  const iniciada = new Promise(resolve => { iniciou = resolve }), pausa = new Promise(resolve => { continuar = resolve })
  s.hook(async () => { iniciou(); await pausa })
  const primeira = s.processar(id); await iniciada
  assert.deepEqual(await s.processar(id), { processado: false })
  assert.ok((await s.client.rpc('hh_envio_automatico_manual', { p_pedido_id: id })).error)
  continuar(); await primeira
  await s.client.rpc('hh_envio_automatico_manual', { p_pedido_id: id }); await s.due(id)
  assert.deepEqual(await s.processar(id), { processado: false })
  assert.equal((await s.job(id)).estado, 'manual')
  const novo = await s.criar(); await s.db.exec('UPDATE envio_automatico_config SET ativa=false')
  assert.deepEqual(await s.processar(novo), { processado: false })
  assert.equal(s.chamadas.filter(c => c.path === '/shipment/checkout').length, 1)
})

test('claim expirado é recuperado; sincronização da tela nunca libera carrinho para compra', async t => {
  const s = await setup(t), id = await s.criar()
  await s.client.rpc('hh_claim_envio_automatico', { p_lease: randomUUID(), p_pedido_id: id })
  assert.equal((await s.client.rpc('hh_sincronizar_envio_automatico', { p_pedido_id: id })).data, false)
  await s.db.exec("UPDATE envio_automatico_fila SET locked_until=now()-interval '1 second'")
  await s.processar(id)
  assert.equal((await s.job(id)).estado, 'aguardando')
  assert.equal((await s.client.rpc('hh_sincronizar_envio_automatico', { p_pedido_id: id })).data, true)
  s.remoto.tracking = 'AA123456789BR'
  await s.lib.processarEnvioAutomatico(id, 1, true)
  assert.equal((await s.job(id)).estado, 'concluida')
  assert.equal(s.chamadas.filter(c => c.path === '/shipment/checkout').length, 1)
})

test('configuração exige teto e confirmação fiscal; RLS/funções negam anon e authenticated', async t => {
  const s = await setup(t, { ativa: false })
  const base = { ativa: true, limiteReais: 25, documentoFiscal: 'declaracao', declaracaoConfirmada: true }
  await assert.rejects(s.lib.salvarConfigEnvioAutomatico(s.client, { ...base, limiteReais: null }, 'admin@example.test'), /teto/)
  await assert.rejects(s.lib.salvarConfigEnvioAutomatico(s.client, { ...base, declaracaoConfirmada: false }, 'admin@example.test'), /dispensa/)
  assert.equal((await s.lib.salvarConfigEnvioAutomatico(s.client, base, 'admin@example.test')).ativa, true)
  for (const role of ['anon','authenticated']) {
    for (const sql of ['SELECT * FROM envio_automatico_config','SELECT * FROM envio_automatico_fila', "SELECT hh_claim_envio_automatico(gen_random_uuid(),null)", "SELECT hh_retomar_envio_automatico('1',null)", "SELECT hh_sincronizar_envio_automatico('1')"]) {
      await s.db.exec('BEGIN; SET LOCAL ROLE ' + role); await assert.rejects(s.db.query(sql), /permission denied/); await s.db.exec('ROLLBACK')
    }
  }
})

test('novo checkout quitado por cashback também entra na automação; UUID permanece compatível', async t => {
  for (const idType of ['bigint','uuid']) {
    const s = await setup(t, { idType })
    const route = loadTs('app/api/checkout/route', s.mocks)
    const response = await route.POST(new Request('https://loja.example.test/api/checkout', { method:'POST',headers:{'Idempotency-Key':require('node:crypto').randomUUID()},body:JSON.stringify({ itens: [{ id: sku, quantidade: 1 }], cashbackUsado: 100 }) }))
    assert.equal(response.status, 200)
    const id = String((await response.json()).pedidoId); assert.equal((await s.job(id)).estado, 'pendente')
    await s.flush(); assert.ok(s.chamadas.some(c => c.path === '/shipment/checkout'))
  }
})

test('webhook verificado inicia compra após ACK e repetição não compra outro envio', async t => {
  const s = await setup(t), id = await s.criar({ pago: false })
  s.setPayment({ status: 'approved', external_reference: id, transaction_amount: 100, currency_id: 'BRL' })
  const route = loadTs('app/api/webhooks/mercadopago/route', s.mocks)
  function request() {
    const ts = '1791858000', requestId = 'fixture'
    const v1 = createHmac('sha256', process.env.MP_WEBHOOK_SECRET).update('id:123456;request-id:' + requestId + ';ts:' + ts + ';').digest('hex')
    return new Request('https://loja.example.test/api/webhooks/mercadopago?data.id=123456', { method: 'POST', headers: { 'x-request-id': requestId, 'x-signature': 'ts=' + ts + ',v1=' + v1 }, body: '{"type":"payment","data":{"id":"123456"}}' })
  }
  assert.equal((await route.POST(request())).status, 200); assert.equal(s.chamadas.length, 0)
  assert.equal((await s.job(id)).estado, 'pendente'); await s.flush()
  assert.equal((await route.POST(request())).status, 200); await s.flush()
  assert.equal(s.chamadas.filter(c => c.path === '/shipment/checkout').length, 1)
})

test('rotas da automação exigem admin, origem válida e segredo do cron', async t => {
  const s = await setup(t), auth = loadTs('lib/autorizacao')
  const caminhos = ['app/api/admin/envio-automatico/route','app/api/admin/envio-automatico/pedido/route']
  for (const file of caminhos) {
    const negada = loadTs(file, { ...s.mocks, '@/lib/autorizacao': { ...auth, exigirAdmin: async () => { throw new auth.ErroHttp(401, 'Acesso recusado') } } })
    assert.equal((await negada.POST(new Request('https://loja.example.test/api/test', { method: 'POST', body: '{}' }))).status, 401)
    const permitida = loadTs(file, { ...s.mocks, '@/lib/autorizacao': { ...auth, exigirAdmin: async () => ({ db: s.client, email: 'admin@example.test' }) } })
    assert.equal((await permitida.POST(new Request('https://loja.example.test/api/test', { method: 'POST', headers: { origin: 'https://invasor.example.test' }, body: '{}' }))).status, 403)
  }
  const id = await s.criar()
  await assert.rejects(s.lib.exigirModoManual(s.client, id), /fila automática/)
  const cron = loadTs('app/api/cron/envios/route', s.mocks)
  assert.equal((await cron.GET(new Request('https://loja.example.test/api/cron/envios'))).status, 401)
  assert.equal(s.chamadas.length, 0)
})
