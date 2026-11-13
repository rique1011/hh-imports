const { test } = require('node:test')
const assert = require('node:assert/strict')
const { PGlite } = require('@electric-sql/pglite')
const { loadTs, adapter } = require('./helpers.cjs')
const { eventosDosItens, horarioEvento, progressoPedido, instanteRegistrado } = loadTs('lib/linha-tempo-pedido')
const item = { id: '11111111-1111-4111-8111-111111111111', nome: 'Colar', quantidade: 1, preco: 100 }

test('horários usam Brasília inclusive na virada de dia; sem horário real não mostra meia-noite', () => {
  const horario = horarioEvento({ ocorrido_em: '2026-11-01T01:30:00+00:00' })
  assert.deepEqual(horario, { data: '31/10/2026', hora: '22:30', dateTime: '2026-11-01T01:30:00+00:00' })
  assert.deepEqual(horarioEvento({ data_local: '2026-11-01', ocorrido_em: null }), { data: '01/11/2026', hora: null, dateTime: '2026-11-01' })
  for (const data of [undefined, '', '2026-02-30T12:00:00Z', '2026-11-01T24:00:00Z', '2026-11-01T12:00:00', '2026-11-01']) assert.equal(instanteRegistrado(data), false)
  assert.equal(horarioEvento(), null)
})

test('pagamento aprovado e preparação são etapas distintas; entrega exige origem e data coerentes', () => {
  assert.equal(progressoPedido('confirmado'), 2); assert.equal(progressoPedido('pago'), 2)
  assert.equal(progressoPedido('processando'), 3); assert.equal(progressoPedido('enviado'), 4)
  assert.equal(progressoPedido('ENTREGUE'), 5); assert.equal(progressoPedido('cancelado'), 0)
  assert.deepEqual(eventosDosItens([item]), [])
  const recebido = { ...item, data_recebimento: '2026-10-31', recebimento_confirmado_em: '2026-11-01T01:30:00Z', recebimento_origem: 'melhor_envio', preparacao_iniciada_em: '2026-10-30T12:00:00Z' }
  const automatico = eventosDosItens([recebido])
  assert.equal(automatico.find(e => e.etapa === 'entregue').ocorrido_em, recebido.recebimento_confirmado_em)
  assert.equal(automatico.find(e => e.etapa === 'preparando').ocorrido_em, recebido.preparacao_iniciada_em)
  for (const ajuste of [{ recebimento_origem: 'manual' }, { data_recebimento: '2026-11-02' }]) {
    assert.equal(eventosDosItens([{ ...recebido, ...ajuste }]).find(e => e.etapa === 'entregue').ocorrido_em, null)
  }
  assert.equal(eventosDosItens([recebido, item]).find(e => e.etapa === 'entregue'), undefined)
})

test('histórico privado aproveita o instante da confirmação, preserva preparação e não exporta dados da fila', async t => {
  const db = new PGlite(); t.after(() => db.close())
  await db.exec(`create table pedidos(id bigint generated always as identity primary key,cliente_email text,cliente_nome text,status text,itens jsonb,created_at timestamptz,total numeric,codigo_rastreio text,entrega jsonb,pagamento jsonb default '{}',pagamento_expira_em timestamptz,cashback_debitado numeric default 0);
    create table pedido_notificacoes(pedido_id text,evento text,destinatario text,criado_em timestamptz,enviada_em timestamptz,payload jsonb);
  `)
  const client = adapter(db)
  const auth = loadTs('lib/autorizacao'), usuario = { email: 'fixture@example.test', db: client }
  const mocks = { '@/lib/autorizacao': { ...auth, exigirUsuario: async () => usuario, exigirAdmin: async () => usuario }, '@/lib/cancelamentos': { incluirCancelamentos: async (_db, pedidos) => pedidos } }
  const pedidos = loadTs('app/api/pedidos/route', mocks), detalhe = loadTs('app/api/pedidos/[id]/route', mocks)
  const admin = loadTs('app/api/admin/dados/route', mocks)
  const email = 'fixture@example.test'
  await db.query("insert into pedidos(cliente_email,status,itens,created_at,total) values($1,'confirmado',$2,'2026-10-30T12:00:00Z',100),('outra@example.test','entregue',$2,'2026-10-30T12:00:00Z',100)", [email, JSON.stringify([item])])
  await db.exec(`insert into pedido_notificacoes values
    ('1','pagamento_aprovado','cliente','2026-10-30T13:30:00Z','2026-10-31T12:00:00Z','{"email":"segredo-fila@example.test"}'),
    ('1','pagamento_aprovado','admin','2026-10-30T13:31:00Z',null,'{}'),
    ('2','pagamento_aprovado','cliente','2026-10-30T15:00:00Z',null,'{}');`)
  const request = () => new Request('https://loja.test/api/pedidos')
  const editar = valores => new Request('https://loja.test/api/admin/dados', { method: 'POST', headers: { origin: 'https://loja.test', 'content-type': 'application/json' },
    body: JSON.stringify({ tabela: 'pedidos', operacao: 'update', filtros: [{ campo: 'id', op: 'eq', valor: 1 }], valores }) })

  await t.test('projeção usa a criação da confirmação e ignora o horário posterior do envio do e-mail', async () => {
    const response = await pedidos.GET(request()), json = await response.json()
    assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
    assert.equal(json.length, 1)
    const aprovado = json[0].linha_tempo.find(e => e.etapa === 'pagamento_aprovado')
    assert.equal(horarioEvento(aprovado).hora, '10:30')
    assert.equal(json[0].linha_tempo.filter(e => e.etapa === 'pagamento_aprovado').length, 1)
    assert.equal(JSON.stringify(json).includes('segredo-fila'), false)
    assert.equal(JSON.stringify(json).includes('enviada_em'), false)
    assert.equal(json[0].linha_tempo.some(e => e.etapa === 'preparando'), false)
    assert.equal((await detalhe.GET(request(), { params: Promise.resolve({ id: '2' }) })).status, 404)
    assert.deepEqual((await (await detalhe.GET(request(), { params: Promise.resolve({ id: '1' }) })).json()).linha_tempo, json[0].linha_tempo)
  })
  await t.test('admin registra a primeira preparação no servidor e repetir o status não reinicia o horário', async () => {
    const antes = Date.now()
    assert.equal((await admin.POST(editar({ status: 'processando' }))).status, 200)
    const primeiro = (await db.query('select itens from pedidos where id=1')).rows[0].itens[0]
    assert.ok(Date.parse(primeiro.preparacao_iniciada_em) >= antes)
    assert.ok(Date.parse(primeiro.preparacao_iniciada_em) <= Date.now())
    assert.deepEqual({ ...primeiro, preparacao_iniciada_em: undefined }, { ...item, preparacao_iniciada_em: undefined })
    assert.equal((await admin.POST(editar({ status: 'processando' }))).status, 200)
    assert.equal((await db.query('select itens from pedidos where id=1')).rows[0].itens[0].preparacao_iniciada_em, primeiro.preparacao_iniciada_em)
    assert.equal((await admin.POST(editar({ status: 'processando', preparacao_iniciada_em: '2000-01-01T12:00:00Z' }))).status, 400)
    const json = await (await pedidos.GET(request())).json()
    assert.equal(json[0].linha_tempo.find(e => e.etapa === 'preparando').ocorrido_em, primeiro.preparacao_iniciada_em)
  })
  await t.test('entrega manual tem data sem horário inventado; metadados da preparação sobrevivem', async () => {
    assert.equal((await admin.POST(editar({ status: 'entregue', data_entrega: '2026-11-01' }))).status, 200)
    const pedido = (await (await pedidos.GET(request())).json())[0]
    assert.ok(pedido.linha_tempo.find(e => e.etapa === 'preparando').ocorrido_em)
    assert.deepEqual(horarioEvento(pedido.linha_tempo.find(e => e.etapa === 'entregue')), { data: '01/11/2026', hora: null, dateTime: '2026-11-01' })
  })
})

test('consulta de horários é em lotes e falha de histórico não derruba os pedidos', async () => {
  const { incluirEventosPedidos } = loadTs('lib/eventos-pedido')
  const lotes = []
  const db = { from: tabela => {
    assert.equal(tabela, 'pedido_notificacoes')
    const q = { select: () => q, in: (campo, valores) => { if (campo === 'pedido_id') lotes.push(valores); return q }, eq: () => q,
      then: resolve => Promise.resolve({ data: null, error: { message: 'fixture outage' } }).then(resolve) }
    return q
  } }
  assert.deepEqual(await incluirEventosPedidos(db, []), []); assert.equal(lotes.length, 0)
  const pedidos = Array.from({ length: 101 }, (_, id) => ({ id, created_at: '2026-10-30T12:00:00Z', itens: [item] }))
  const resultado = await incluirEventosPedidos(db, pedidos)
  assert.deepEqual(lotes.map(l => l.length), [100, 1])
  assert.equal(resultado.length, 101)
  assert.deepEqual(resultado[0].linha_tempo, [{ etapa: 'realizado', ocorrido_em: pedidos[0].created_at, data_local: null }])
  const indisponivel = { from: () => { throw Error('fixture transport error') } }
  assert.equal((await incluirEventosPedidos(indisponivel, pedidos.slice(0, 1))).length, 1)
})
