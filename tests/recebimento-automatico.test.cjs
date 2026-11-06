const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { loadTs, createDb, adapter } = require('./helpers.cjs')
const { prazoDevolucao, diaNaLoja } = loadTs('lib/prazo-devolucao')
const sku = '13faf490-7cb6-4e4f-9106-0f0502c50424'
const item = { id: sku, nome: 'Joia', quantidade: 1, preco: 100 }
const email = 'cliente@example.test'
process.env.MELHOR_ENVIO_TOKEN = 'fixture-only'
process.env.MELHOR_ENVIO_AMBIENTE = 'production'
process.env.CRON_SECRET = 'fixture-cron'

test('instante da entrega exige data real, fuso explícito e não aceita normalização de datas impossíveis', () => {
  const { instanteEntrega } = loadTs('lib/recebimento-automatico')
  const agora = new Date('2026-11-06T12:00:00Z')
  assert.equal(instanteEntrega('2026-11-01T01:30:00+00:00', agora).toISOString(), '2026-11-01T01:30:00.000Z')
  assert.equal(diaNaLoja(instanteEntrega('2026-11-01T01:30:00+00:00', agora)), '2026-10-31')
  for (const valor of [null, '', '2026-11-01', '2026-11-01 12:00:00', '2026-11-01T12:00:00', '2026-02-30T12:00:00Z', '2026-11-01T24:00:00Z', '2099-01-01T12:00:00Z']) {
    assert.equal(instanteEntrega(valor, agora), null, String(valor))
  }
})

test('conferência usa a etiqueta vinculada e persiste entrega, prazo e notificação com segurança', async t => {
  const db = await createDb('bigint'); t.after(() => db.close())
  const client = adapter(db), chamadas = []
  await db.query("INSERT INTO produtos(id,nome,preco,estoque) VALUES($1,'Joia',100,1000)", [sku])
  let responder
  const mocks = {
    '@/lib/melhor-envio': { ...loadTs('lib/melhor-envio'), melhorEnvio: async (path, body) => {
      chamadas.push({ path, body }); return responder(path)
    } },
    '@/lib/supabase-admin': { getSupabaseAdmin: () => client },
  }
  const lib = loadTs('lib/recebimento-automatico', mocks)
  async function criar(opcoes = {}) {
    const id = (await db.query("INSERT INTO pedidos(cliente_email,cliente_nome,status,total,itens,created_at,codigo_rastreio) VALUES($1,'Cliente',$2,100,$3,'2026-01-01T12:00:00Z',$4) RETURNING id",
      [opcoes.email || email, opcoes.status || 'enviado', JSON.stringify(opcoes.itens || [item]), 'AB' + randomUUID().replaceAll('-', '').slice(0, 9) + 'BR'])).rows[0].id
    const pedido = (await db.query('SELECT id,status,itens,codigo_rastreio,created_at FROM pedidos WHERE id=$1', [id])).rows[0]
    const envio = { pedido_id: id, me_id: randomUUID(), ambiente: opcoes.ambiente || 'production', codigo_rastreio: pedido.codigo_rastreio,
      atualizado_em: '2026-01-01T12:00:00Z', pedido }
    if (!opcoes.semEtiqueta) await db.query("INSERT INTO pedido_envios(pedido_id,me_id,ambiente,estado,config,etiqueta_gerada,codigo_rastreio,atualizado_em) VALUES($1,$2,$3,'pronta','{}',true,$4,$5)",
      [id, envio.me_id, envio.ambiente, envio.codigo_rastreio, envio.atualizado_em])
    return { pedido, envio, remoto: { id: envio.me_id, status: 'delivered', tracking: envio.codigo_rastreio, delivered_at: '2026-11-01T01:30:00+00:00' } }
  }
  const ler = async id => (await db.query('SELECT * FROM pedidos WHERE id=$1', [id])).rows[0]

  await t.test('data efetiva no Brasil, estoque preservado e e-mail único; não compra nem gera etiquetas', async () => {
    const s = await criar(), estoque = (await db.query('SELECT estoque FROM produtos')).rows[0].estoque
    responder = async () => s.remoto
    const resultado = await lib.sincronizarRecebimentos(client, { clienteEmail: email })
    assert.deepEqual(resultado, { consultadas: 1, entregues: 1, falhas: 0 })
    assert.equal(chamadas.at(-1).path, '/orders/' + s.envio.me_id)
    assert.equal(chamadas.at(-1).body, undefined)
    const salvo = await ler(s.pedido.id)
    assert.equal(salvo.status, 'entregue')
    assert.deepEqual(salvo.itens[0], { ...item, data_recebimento: '2026-10-31', recebimento_origem: 'melhor_envio', recebimento_confirmado_em: '2026-11-01T01:30:00.000Z' })
    assert.equal(prazoDevolucao(salvo.itens[0].data_recebimento, new Date('2026-11-08T12:00:00Z')).situacao, 'encerrado')
    assert.equal((await db.query('SELECT estoque FROM produtos')).rows[0].estoque, estoque)
    assert.equal(await lib.registrarRecebimento(client, s.envio, { ...s.remoto, delivered_at: new Date().toISOString() }), false)
    assert.equal((await db.query("SELECT count(*)::integer AS n FROM pedido_notificacoes WHERE pedido_id=$1 AND evento='entregue'", [s.pedido.id])).rows[0].n, 1)
    assert.equal((await ler(s.pedido.id)).itens[0].data_recebimento, '2026-10-31')
  })
  await t.test('postagem, ponto Pegaki, tentativa e etiqueta gerada não são entrega ao cliente', async () => {
    const s = await criar()
    for (const status of ['received', 'posted', 'generated', 'released', 'pending', 'undelivered', 'paused', 'canceled']) {
      assert.equal(await lib.registrarRecebimento(client, s.envio, { ...s.remoto, status }), false, status)
    }
    assert.equal((await ler(s.pedido.id)).status, 'enviado')
  })
  await t.test('entrega sem data, futura ou anterior à compra não inventa recebimento', async () => {
    const s = await criar()
    for (const delivered_at of [null, '2099-01-01T12:00:00Z', '2025-12-31T12:00:00Z', '2026-02-30T12:00:00Z']) {
      assert.equal(await lib.registrarRecebimento(client, s.envio, { ...s.remoto, delivered_at }), false)
    }
    assert.equal((await ler(s.pedido.id)).itens[0].data_recebimento, undefined)
  })
  await t.test('resposta de outra etiqueta, rastreio diferente ou sandbox não altera o pedido', async () => {
    const s = await criar()
    assert.equal(await lib.registrarRecebimento(client, s.envio, { ...s.remoto, id: randomUUID() }), false)
    assert.equal(await lib.registrarRecebimento(client, s.envio, { ...s.remoto, tracking: 'OUTRO' }), false)
    assert.equal(await lib.registrarRecebimento(client, { ...s.envio, ambiente: 'sandbox' }, s.remoto), false)
    process.env.MELHOR_ENVIO_AMBIENTE = 'sandbox'
    try { assert.equal(await lib.registrarRecebimento(client, s.envio, s.remoto), false) }
    finally { process.env.MELHOR_ENVIO_AMBIENTE = 'production' }
  })
  await t.test('correção manual e metadados parciais são preservados', async () => {
    for (const itens of [[{ ...item, data_recebimento: '2026-11-02' }], [{ ...item, data_recebimento: 'inválida' }], [{ ...item, data_recebimento: '2026-11-01' }, item]]) {
      const s = await criar({ status: 'entregue', itens })
      assert.equal(await lib.registrarRecebimento(client, s.envio, s.remoto), false)
      assert.deepEqual((await ler(s.pedido.id)).itens, itens)
    }
  })
  await t.test('cliente só sincroniza seus pedidos; sem etiqueta não há associação por suposição', async () => {
    const propria = await criar({ email: 'propria@example.test' })
    await criar({ email: 'outra@example.test' }); await criar({ email: 'propria@example.test', semEtiqueta: true })
    await criar({ email: 'propria@example.test', ambiente: 'sandbox' })
    chamadas.length = 0; responder = async () => propria.remoto
    assert.equal((await lib.sincronizarRecebimentos(client, { clienteEmail: 'propria@example.test' })).entregues, 1)
    assert.equal(chamadas.length, 1)
  })
  await t.test('abas concorrentes fazem uma só consulta e respeitam o intervalo de 15 minutos', async () => {
    const s = await criar({ email: 'concorrencia@example.test' })
    chamadas.length = 0; responder = async () => ({ ...s.remoto, status: 'posted' })
    const resultados = await Promise.all([lib.sincronizarRecebimentos(client, { clienteEmail: 'concorrencia@example.test' }), lib.sincronizarRecebimentos(client, { clienteEmail: 'concorrencia@example.test' })])
    assert.equal(resultados.reduce((n, r) => n + r.consultadas, 0), 1)
    assert.equal(chamadas.length, 1)
    assert.equal((await lib.sincronizarRecebimentos(client, { clienteEmail: 'concorrencia@example.test' })).consultadas, 0)
  })
  await t.test('falha do fornecedor preserva o pedido e não bloqueia novas tentativas', async () => {
    const s = await criar({ email: 'falha@example.test' })
    responder = async () => { throw Error('fixture outage') }
    assert.deepEqual(await lib.sincronizarRecebimentos(client, { clienteEmail: 'falha@example.test' }), { consultadas: 1, entregues: 0, falhas: 1 })
    assert.equal((await ler(s.pedido.id)).status, 'enviado')
    await db.query("UPDATE pedido_envios SET atualizado_em=now()-interval '16 minutes' WHERE pedido_id=$1", [s.pedido.id])
    responder = async () => s.remoto
    assert.equal((await lib.sincronizarRecebimentos(client, { clienteEmail: 'falha@example.test' })).entregues, 1)
  })
  await t.test('cancelamento durante a consulta externa é respeitado', async () => {
    const s = await criar({ email: 'cancelamento@example.test' })
    responder = async () => { await db.query("UPDATE pedidos SET status='cancelado' WHERE id=$1", [s.pedido.id]); return s.remoto }
    assert.equal((await lib.sincronizarRecebimentos(client, { clienteEmail: 'cancelamento@example.test' })).entregues, 0)
    assert.equal((await ler(s.pedido.id)).status, 'cancelado')
  })
  await t.test('edição entre a releitura e a gravação não é sobrescrita', async () => {
    const s = await criar()
    const raced = { ...client, from(table) {
      const query = client.from(table)
      if (table === 'pedidos') {
        const update = query.update.bind(query)
        query.update = values => {
          update(values)
          const then = query.then.bind(query)
          query.then = (resolve, reject) => db.query("UPDATE pedidos SET itens=$1 WHERE id=$2", [JSON.stringify([{ ...item, data_recebimento: '2026-11-03' }]), s.pedido.id]).then(() => then(resolve, reject))
          return query
        }
      }
      return query
    } }
    assert.equal(await lib.registrarRecebimento(raced, s.envio, s.remoto), false)
    assert.equal((await ler(s.pedido.id)).itens[0].data_recebimento, '2026-11-03')
    assert.equal((await ler(s.pedido.id)).status, 'enviado')
  })
  const editar = (id, valores) => new Request('https://loja.test/api/admin/dados', { method: 'POST', headers: { origin: 'https://loja.test', 'content-type': 'application/json' },
    body: JSON.stringify({ tabela: 'pedidos', operacao: 'update', filtros: [{ campo: 'id', op: 'eq', valor: id }], valores }) })
  await t.test('correção do admin identifica a data como manual e preserva os itens comerciais', async () => {
    const s = await criar({ status: 'entregue', itens: [{ ...item, data_recebimento: '2026-10-31', recebimento_origem: 'melhor_envio', recebimento_confirmado_em: '2026-11-01T01:30:00.000Z' }] })
    const auth = loadTs('lib/autorizacao')
    const admin = loadTs('app/api/admin/dados/route', { '@/lib/autorizacao': { ...auth, exigirAdmin: async () => ({ db: client }) } })
    assert.equal((await admin.POST(editar(s.pedido.id, { status: 'entregue', data_entrega: '2026-11-02' }))).status, 200)
    assert.deepEqual((await ler(s.pedido.id)).itens, [{ ...item, data_recebimento: '2026-11-02', recebimento_origem: 'manual', recebimento_confirmado_em: null }])
  })
  await t.test('formulário administrativo concorrente recebe 409 e não reverte entrega automática', async () => {
    const s = await criar(), auth = loadTs('lib/autorizacao')
    const raced = { ...client, from(table) {
      const query = client.from(table)
      if (table === 'pedidos') {
        const update = query.update.bind(query)
        query.update = values => {
          update(values)
          const then = query.then.bind(query)
          query.then = (resolve, reject) => lib.registrarRecebimento(client, s.envio, s.remoto).then(() => then(resolve, reject))
          return query
        }
      }
      return query
    } }
    const admin = loadTs('app/api/admin/dados/route', { '@/lib/autorizacao': { ...auth, exigirAdmin: async () => ({ db: raced }) } })
    assert.equal((await admin.POST(editar(s.pedido.id, { status: 'enviado', codigo_rastreio: s.pedido.codigo_rastreio }))).status, 409)
    assert.equal((await ler(s.pedido.id)).status, 'entregue')
    assert.equal((await ler(s.pedido.id)).itens[0].data_recebimento, '2026-10-31')
  })
})

test('rotas protegem o cron e derivam o escopo da sessão, ignorando IDs e datas do navegador', async () => {
  const auth = loadTs('lib/autorizacao'), chamadas = [], callbacks = []
  let logado = false, admin = false
  const mocks = {
    '@/lib/autorizacao': { ...auth, exigirUsuario: async () => {
      if (!logado) throw new auth.ErroHttp(401, 'Faça login.')
      return { email, admin, db: {} }
    } },
    '@/lib/supabase-admin': { getSupabaseAdmin: () => ({}) },
    '@/lib/recebimento-automatico': { sincronizarRecebimentos: async (_db, scope) => { chamadas.push(scope); return { consultadas: 1, entregues: 1, falhas: 0 } } },
    '@/lib/notificacoes': { processarNotificacoes: async () => {} },
    'next/server': { ...require('next/server'), after: cb => callbacks.push(cb) },
  }
  const route = loadTs('app/api/pedidos/sincronizar-entregas/route', mocks)
  const request = (origin = 'https://loja.test') => new Request('https://loja.test/api/pedidos/sincronizar-entregas', { method: 'POST', headers: { origin }, body: JSON.stringify({ pedidoId: 999, data_entrega: '2099-01-01', admin: true }) })
  assert.equal((await route.POST(request())).status, 401)
  logado = true
  assert.equal((await route.POST(request('https://outra.test'))).status, 403)
  assert.equal(chamadas.length, 0)
  const r = await route.POST(request())
  assert.equal(r.status, 200); assert.equal(r.headers.get('Cache-Control'), 'private, no-store')
  assert.deepEqual(chamadas.at(-1), { clienteEmail: email, limite: 5 })
  assert.equal(callbacks.length, 1)
  admin = true; await route.POST(request()); assert.deepEqual(chamadas.at(-1), {})
  const cron = loadTs('app/api/cron/entregas/route', mocks)
  chamadas.length = 0
  assert.equal((await cron.GET(new Request('https://loja.test/api/cron/entregas'))).status, 401)
  assert.equal(chamadas.length, 0)
  assert.equal((await cron.GET(new Request('https://loja.test/api/cron/entregas', { headers: { authorization: 'Bearer fixture-cron' } }))).status, 200)
  assert.equal(chamadas.length, 1)
})
