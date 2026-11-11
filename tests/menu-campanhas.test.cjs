const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { createDb, adapter, loadTs } = require('./helpers.cjs')
process.env.NEXTAUTH_SECRET = 'fixture-menu'
const base = 'https://loja.test'
const request = (body, origin = base) => new Request(base + '/api/admin/menu', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const natal = { nome: 'Natal', descricao: 'Peças para presentear.', tipo: 'selecao', regra: 'manual', ativo: true, ordem: 5 }

async function setup(t) {
  const db = await createDb('bigint', 'bigint'); t.after(() => db.close())
  const client = adapter(db)
  await db.exec("insert into usuarios(nome,email,role,perfil,email_verificado,senha_politica_versao,mfa_secret) values('Admin','admin@example.test','admin','admin',true,1,'fixture'),('Cliente','cliente@example.test','cliente','cliente',true,1,null)")
  let sessao = null
  const mocks = {
    '@/lib/supabase-admin': { getSupabaseAdmin: () => client },
    '@/lib/supabase': { supabase: client },
    '@/lib/request-user': { getRequestUser: async () => sessao },
    'next/cache': { unstable_cache: f => f, revalidateTag: () => {} },
  }
  const usuario = async (id, mfa = false) => {
    const u = (await db.query('select * from usuarios where id=$1', [id])).rows[0]
    sessao = { id: String(id), email: u.email, sessaoVersao: u.sessao_versao, senhaAtual: true, mfa }
  }
  const route = loadTs('app/api/admin/menu/route', mocks)
  return { db, client, mocks, route, usuario }
}

test('menu exige sessão admin com MFA, impede CSRF e rejeita destinos externos ou campos extras', async t => {
  const s = await setup(t), get = () => s.route.GET(new Request(base + '/api/admin/menu'))
  assert.equal((await get()).status, 401)
  assert.equal((await s.route.POST(request(natal))).status, 401)
  await s.usuario(2); assert.equal((await get()).status, 403)
  await s.usuario(1); assert.equal((await get()).status, 403)
  await s.usuario(1, true); assert.equal((await get()).status, 200)
  assert.equal((await s.route.POST(request(natal, 'https://externa.test'))).status, 403)
  for (const bad of [{ tipo: 'https://externa.test' }, { href: 'javascript:alert(1)' }, { slug: '../admin' }, { nome: '<img>' }, { regra: ['manual'] }, { ordem: -1 }]) {
    assert.equal((await s.route.POST(request({ ...natal, ...bad }))).status, 400)
  }
  assert.equal((await s.db.query('select count(*)::int n from loja_navegacao')).rows[0].n, 5)
})

test('campanha pode ser criada, renomeada, reordenada, retirada do menu e reativada preservando URL e peças', async t => {
  const s = await setup(t); await s.usuario(1, true)
  const criada = await s.route.POST(request(natal)); assert.equal(criada.status, 200)
  const item = (await criada.json()).item, sku = randomUUID()
  await s.db.query('insert into produtos(id,nome,preco,vitrines) values($1,$2,40,$3)', [sku, 'Colar Natal', [item.slug]])
  const dados = { ...natal, id: item.id, versao: item.versao, nome: 'Presentes de Natal', ordem: 0, ativo: false }
  const respostas = await Promise.all([s.route.POST(request(dados)), s.route.POST(request(dados))])
  assert.deepEqual(respostas.map(r => r.status).sort(), [200, 409])
  let atual = (await s.db.query('select * from loja_navegacao where id=$1', [item.id])).rows[0]
  assert.equal(atual.slug, 'natal'); assert.equal(atual.ativo, false); assert.equal(atual.ordem, 0)
  assert.deepEqual((await s.db.query('select vitrines from produtos where id=$1', [sku])).rows[0].vitrines, ['natal'])
  const menu = await loadTs('lib/navegacao-servidor', s.mocks).getNavegacaoPublica()
  assert.equal(menu.find(i => i.slug === 'natal').nome, 'Presentes de Natal')
  assert.equal((await s.route.POST(request({ ...dados, versao: atual.versao, ativo: true }))).status, 200)
  assert.equal((await s.route.POST(request(natal))).status, 409)
  assert.equal((await s.route.POST(request({ ...dados, versao: 3, tipo: 'catalogo' }))).status, 400)
  atual = (await s.db.query('select * from loja_navegacao where id=$1', [item.id])).rows[0]
  assert.equal(atual.ativo, true); assert.equal(atual.tipo, 'selecao')
})

test('produtos aceitam campanhas novas além das três antigas e rejeitam campanhas inventadas, duplicadas e menus sem seleção', async t => {
  const s = await setup(t); await s.usuario(1, true)
  await s.route.POST(request(natal))
  const sku = randomUUID()
  await s.db.query('insert into produtos(id,nome,preco) values($1,$2,10)', [sku, 'Joia'])
  const route = loadTs('app/api/admin/dados/route', s.mocks)
  const salvar = vitrines => route.POST(new Request(base + '/api/admin/dados', { method: 'POST', headers: { origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ tabela: 'produtos', operacao: 'update', filtros: [{ campo: 'id', op: 'eq', valor: sku }], valores: { vitrines } }) }))
  // As colunas não usadas neste teste também fazem parte do DTO de estoque.
  await s.db.exec('alter table produtos add material text, add descricao text, add video_url text, add categoria_id uuid, add categoria_slug text, add criado_em timestamptz default now(), add visitas int')
  const slugs = ['lancamentos', 'masculino', 'presentes', 'natal']
  assert.equal((await salvar(slugs)).status, 200)
  for (const invalido of [['nao-existe'], ['joias'], ['natal','natal'], ['natal,produtos'], [null]]) assert.equal((await salvar(invalido)).status, 400)
  assert.deepEqual((await s.db.query('select vitrines from produtos')).rows[0].vitrines, slugs)
  for (const invalido of [['nao-existe'], ['colecoes'], ['natal','natal'], [null]]) await assert.rejects(s.db.query('update produtos set vitrines=$1', [invalido]), /produtos_vitrines_validas/)
  await s.db.exec("update loja_navegacao set ativo=false where slug='natal'")
  assert.equal((await salvar(['natal'])).status, 200)
})

test('RLS mantém apenas leitura pública da navegação e função de validação sem privilégios elevados', async t => {
  const s = await setup(t)
  assert.equal((await s.db.query("select relrowsecurity from pg_class where oid='loja_navegacao'::regclass")).rows[0].relrowsecurity, true)
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await s.db.query("select has_table_privilege($1,'loja_navegacao','select') ok", [role])).rows[0].ok, true)
    assert.equal((await s.db.query("select has_table_privilege($1,'loja_navegacao','insert,update,delete') ok", [role])).rows[0].ok, false)
    assert.equal((await s.db.query("select has_function_privilege($1,'hh_validar_vitrines_produto()','execute') ok", [role])).rows[0].ok, false)
    await s.db.exec('set role ' + role)
    assert.equal((await s.db.query('select count(*)::int n from loja_navegacao')).rows[0].n, 5)
    await assert.rejects(s.db.exec("update loja_navegacao set nome='Alterado'"), /permission denied/)
    await s.db.exec('reset role')
  }
  assert.equal((await s.db.query("select prosecdef from pg_proc where oid='hh_validar_vitrines_produto()'::regprocedure")).rows[0].prosecdef, false)
})

test('tipo do destino define links estáveis mesmo quando o nome Joias é alterado', () => {
  const { linkDoMenu, vitrinesValidas } = loadTs('lib/selecoes')
  assert.equal(linkDoMenu({ tipo: 'categorias', slug: 'joias', nome: 'Nossas peças' }), '/produtos')
  assert.equal(linkDoMenu({ tipo: 'selecao', slug: 'natal' }), '/selecao/natal')
  assert.equal(linkDoMenu({ tipo: 'colecoes', slug: 'inspiracoes' }), '/colecoes')
  assert.equal(vitrinesValidas(['natal','dia-dos-pais']), true)
  assert.equal(vitrinesValidas(['natal','natal']), false)
  assert.equal(vitrinesValidas(['a),id.eq.1']), false)
})
