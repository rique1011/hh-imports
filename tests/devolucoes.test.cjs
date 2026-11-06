const { test } = require('node:test')
const assert = require('node:assert/strict')
const { PGlite } = require('@electric-sql/pglite')
const { loadTs, adapter } = require('./helpers.cjs')
const { prazoDevolucao, diaNaLoja } = loadTs('lib/prazo-devolucao')

test('arrependimento conta sete dias corridos completos no calendário de Joinville', () => {
  assert.equal(prazoDevolucao('2026-11-01', new Date('2026-11-09T02:59:59.999Z')).aberto, true)
  assert.equal(prazoDevolucao('2026-11-01', new Date('2026-11-09T03:00:00.000Z')).situacao, 'encerrado')
  assert.equal(prazoDevolucao('2026-11-01', new Date('2026-11-01T20:00:00Z')).dataLimite, '2026-11-08')
  assert.equal(prazoDevolucao('2026-12-28', new Date('2027-01-01T12:00:00Z')).dataLimite, '2027-01-04')
  assert.equal(prazoDevolucao('2028-02-25', new Date('2028-02-27T12:00:00Z')).dataLimite, '2028-03-03')
})

test('data ausente, inválida ou futura nunca é confundida com prazo vencido', () => {
  for (const data of [null, undefined, '', '2026-02-30', '2026-13-01', '0000-01-01', '05/11/2026', '2099-01-01']) {
    assert.equal(prazoDevolucao(data, new Date('2026-11-05T12:00:00Z')).situacao, 'sem_data')
  }
})

test('API protege o prazo e o admin registra recebimento sem alterar os itens comerciais', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`
    create table pedidos(id bigint generated always as identity primary key, cliente_email text,cliente_nome text,
      status text,total numeric,itens jsonb,created_at timestamptz default now(),codigo_rastreio text,entrega jsonb,pagamento jsonb default '{}',pagamento_expira_em timestamptz,cashback_debitado numeric default 0);
    create table devolucao_uploads(caminho text,usuario_id text,pedido_id text,produto_id text);
    create table trocas(id uuid primary key default gen_random_uuid(), pedido_id text, produto_id uuid,
      usuario_id bigint, motivo text, foto_url text, status text, unique(pedido_id,produto_id));
  `)
  const auth = loadTs('lib/autorizacao')
  const user = { id: 17, email: 'fixture@example.test', db: adapter(db) }
  const mocks = { '@/lib/autorizacao': { ...auth, exigirUsuario: async () => user, exigirAdmin: async () => user } }
  const route = loadTs('app/api/trocas/route', mocks)
  const admin = loadTs('app/api/admin/dados/route', mocks)
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co'
  const produto = '11111111-1111-4111-8111-111111111111'
  const item = { id: produto, nome: 'Colar', foto: '/icon.svg', quantidade: 1, preco: 100 }
  const { dataEntregaDosItens } = loadTs('lib/prazo-devolucao')
  async function pedido(dias, email = 'fixture@example.test') {
    const data = dias === null ? null : new Date(diaNaLoja() + 'T12:00:00Z')
    if (data) data.setUTCDate(data.getUTCDate() - dias)
    const itens = [{ ...item, ...(data ? { data_recebimento: data.toISOString().slice(0, 10) } : {}) }]
    const r = await db.query("insert into pedidos(cliente_email,status,total,itens,created_at) values($1,$2,100,$3,now()-interval '200 days') returning id", [email, 'entregue', JSON.stringify(itens)])
    await db.query("insert into devolucao_uploads values($1,'17',$2,$3)",['trocas/17/foto-'+r.rows[0].id+'.webp',String(r.rows[0].id),produto])
    return r.rows[0].id
  }
  function request(id, motivo = 'arrependimento', extra = {}) {
    return new Request('https://loja.test/api/trocas', { method: 'POST', headers: { origin: 'https://loja.test', 'content-type': 'application/json' },
      body: JSON.stringify({ pedidoId: id, produtoId: produto, motivo, ...extra }) })
  }
  function editar(id, valores) {
    return new Request('https://loja.test/api/admin/dados', { method: 'POST', headers: { origin: 'https://loja.test', 'content-type': 'application/json' },
      body: JSON.stringify({ tabela: 'pedidos', operacao: 'update', filtros: [{ campo: 'id', op: 'eq', valor: id }], valores }) })
  }
  await t.test('pedido histórico não herda a data da compra como recebimento', async () => {
    const id = await pedido(null)
    const linha = (await db.query('select * from pedidos where id=$1', [id])).rows[0]
    assert.equal(dataEntregaDosItens(linha.itens), null)
    assert.equal((await route.POST(request(id))).status, 409)
  })
  await t.test('admin registra data, preservando produto, preço e quantidade', async () => {
    const id = await pedido(null)
    const r = await admin.POST(editar(id, { status: 'entregue', data_entrega: diaNaLoja() }))
    assert.equal(r.status, 200)
    assert.equal((await r.json()).data[0].data_entrega, diaNaLoja())
    const itens = (await db.query('select itens from pedidos where id=$1', [id])).rows[0].itens
    assert.deepEqual(itens, [{ ...item, data_recebimento: diaNaLoja() }])
    assert.equal((await route.POST(request(id))).status, 200)
  })
  await t.test('data futura e alteração direta dos itens comerciais são recusadas', async () => {
    const id = await pedido(null)
    assert.equal((await admin.POST(editar(id, { data_entrega: '2099-01-01' }))).status, 400)
    assert.equal((await admin.POST(editar(id, { data_entrega: '2026-02-30' }))).status, 400)
    assert.equal((await admin.POST(editar(id, { itens: [{ ...item, preco: 1 }] }))).status, 400)
  })
  await t.test('7º dia é aceito e a mesma solicitação não pode ser duplicada', async () => {
    const id = await pedido(7)
    assert.equal((await route.POST(request(id))).status, 200)
    assert.equal((await route.POST(request(id))).status, 409)
  })
  await t.test('8º dia é bloqueado inclusive com data forjada no corpo', async () => {
    const id = await pedido(8)
    assert.equal((await route.POST(request(id, 'arrependimento', { data_entrega: diaNaLoja(), data_recebimento: diaNaLoja() }))).status, 409)
    assert.equal((await route.POST(request(id, 'tamanho'))).status, 409)
    assert.equal((await db.query('select count(*)::integer as total from trocas where pedido_id=$1', [String(id)])).rows[0].total, 0)
  })
  await t.test('edição de rastreio não reinicia o prazo de recebimento', async () => {
    const id = await pedido(8)
    const data = dataEntregaDosItens((await db.query('select itens from pedidos where id=$1', [id])).rows[0].itens)
    assert.equal((await admin.POST(editar(id, { status: 'entregue', codigo_rastreio: 'CODIGO' }))).status, 200)
    assert.equal(dataEntregaDosItens((await db.query('select itens from pedidos where id=$1', [id])).rows[0].itens), data)
    assert.equal((await route.POST(request(id))).status, 409)
  })
  await t.test('defeito após 7 dias continua disponível e exige foto própria', async () => {
    const id = await pedido(30)
    assert.equal((await route.POST(request(id, 'defeito'))).status, 400)
    assert.equal((await route.POST(request(id, 'defeito', { fotoUrl: 'private:devolucoes/trocas/17/foto-'+id+'.webp' }))).status, 200)
  })
  await t.test('sem data há atendimento para confirmação e defeitos permanecem disponíveis', async () => {
    const id = await pedido(null)
    const r = await route.POST(request(id))
    assert.equal(r.status, 409); assert.match((await r.json()).error, /data de recebimento/)
    assert.equal((await route.POST(request(id, 'defeito', { fotoUrl: 'private:devolucoes/trocas/17/foto-'+id+'.webp' }))).status, 200)
  })
  await t.test('prazo válido não dá acesso ao pedido de outra pessoa nem a item estranho', async () => {
    assert.equal((await route.POST(request(await pedido(1, 'outra@example.test')))).status, 404)
    assert.equal((await route.POST(request(await pedido(1), 'arrependimento', { produtoId: '22222222-2222-4222-8222-222222222222' }))).status, 404)
  })
})
