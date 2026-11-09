const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTs } = require('./helpers.cjs')
const { obterCategoria, categoriaDoProduto, inferirCategoriaNome } = loadTs('lib/categorias')
const p = (id, nome, categoria_slug = null, extra = {}) => ({ id, nome, slug: id, categoria_slug, categoria_id: null, preco: 23, fotos: [], material: 'Ouro 18k', estoque: 10, ...extra })

function catalogo(produtos, categorias = [], falha = '') {
 const consultas = []
 const db = { from(tabela) {
  const info = { tabela }; consultas.push(info)
  return {
   select(v) { info.colunas = v; return this }, or(v) { info.filtro = v; return this }, order() { return this },
   range(inicio, fim) { info.inicio = inicio; info.fim = fim; return this }, abortSignal() { return this },
   then(resolve, reject) {
    return Promise.resolve(falha === tabela ? { data: null, error: { message: 'Indisponível' } }
     : { data: tabela === 'categorias' ? categorias : produtos.slice(info.inicio, info.fim + 1), error: null }).then(resolve, reject)
   },
  }
 } }
 const { produtosDaCategoria } = loadTs('lib/catalogo-categorias', { '@/lib/supabase': { supabase: db } })
 return { produtosDaCategoria, consultas }
}

test('coleções normalizam singular, plural, maiúsculas e acentos sem aceitar filtro livre da URL', () => {
 for (const [termo, slug] of [['COLAR', 'colares'], [' Colares ', 'colares'], ['Brinco', 'brincos'], ['bracelete', 'pulseiras'], ['Anéis', 'aneis'], ['Relógio', 'relogios']]) assert.equal(obterCategoria(termo).slug, slug)
 for (const termo of ['', null, 'nome.eq.outra', 'colares,preco.gt.0', '<script>']) assert.equal(obterCategoria(termo), null)
})
test('peças antigas sem categoria são recuperadas pelo nome; ambiguidades continuam para revisão no admin', () => {
 assert.equal(categoriaDoProduto(p('colar-perola', 'Colar pérola')), 'colares')
 assert.equal(categoriaDoProduto(p('pulseira', 'Pulseira')), 'pulseiras')
 assert.equal(inferirCategoriaNome('Escapulário dourado'), 'colares')
 assert.equal(inferirCategoriaNome('Aliança em ouro'), 'aneis')
 assert.equal(inferirCategoriaNome('Kit colar e brinco'), null)
 assert.equal(inferirCategoriaNome('gg'), null)
 assert.equal(inferirCategoriaNome('Descolar adesivo'), null)
})
test('categoria escolhida e vínculo legado prevalecem sobre palavras no nome da peça', () => {
 assert.equal(categoriaDoProduto(p('flor', 'Colar Rosa', 'brincos')), 'brincos')
 assert.equal(categoriaDoProduto(p('anel', 'Colar especial', null, { categoria_id: 'categoria-anel' }), [{ id: 'categoria-anel', nome: 'Anéis' }]), 'aneis')
 assert.equal(categoriaDoProduto(p('fora', 'Colar', 'outros')), 'outros')
 assert.equal(categoriaDoProduto(p('custom', 'Colar', 'colecao-especial')), null)
})
test('busca de coleção inclui os colares legados sem misturar pulseiras ou peças com outra classificação explícita', async () => {
 const s = catalogo([p('colar-perola', 'Colar pérola'), p('colar', 'Colar'), p('pulseira', 'Pulseira', 'pulseiras'), p('brinco-rosa', 'Colar Rosa', 'brincos'), p('gg', 'gg')])
 assert.deepEqual((await s.produtosDaCategoria('colares')).map(p => p.id), ['colar-perola', 'colar'])
 assert.ok(s.consultas.find(q => q.tabela === 'produtos').filtro.includes('nome.ilike.*colar*'))
 assert.deepEqual(await s.produtosDaCategoria('colares,preco.gt.0'), [])
})
test('busca respeita vínculo por ID, preserva joia acima de R$ 10 mil e pagina sem cortar o catálogo em mil linhas', async () => {
 const id = '344acfea-cbf9-48af-bc6a-3ad5aa4feedd'
 const s = catalogo([p('anel', 'Peça Flor', null, { categoria_id: id, preco: 15000 })], [{ id, nome: 'Anéis' }])
 const rows = await s.produtosDaCategoria('aneis'); assert.equal(rows[0].preco, 15000)
 assert.ok(s.consultas.find(q => q.tabela === 'produtos').filtro.includes('categoria_id.in.(' + id + ')'))
 const muitos = catalogo(Array.from({ length: 1001 }, (_, i) => p(String(i), 'Colar ' + i)))
 assert.equal((await muitos.produtosDaCategoria('colares')).length, 1001)
 assert.deepEqual(muitos.consultas.filter(q => q.tabela === 'produtos').map(q => q.inicio), [0, 500, 1000])
})
test('falha do banco não é apresentada como coleção vazia', async () => {
 for (const tabela of ['produtos', 'categorias']) await assert.rejects(catalogo([], [], tabela).produtosDaCategoria('colares'), /Não foi possível/)
 assert.deepEqual(await catalogo([]).produtosDaCategoria('brincos'), [])
})

function admin() {
 const escritos = [], invalidacoes = [], auth = loadTs('lib/autorizacao')
 const q = { select() { return this }, eq() { return this }, then(resolve, reject) { return Promise.resolve({ data: [{ id: 'p1' }], error: null }).then(resolve, reject) } }
 const db = { from() { return { update(v) { escritos.push(v); return q }, insert(v) { escritos.push(v); return q } } } }
 const route = loadTs('app/api/admin/dados/route', { 'next/cache': { revalidateTag: (...a) => invalidacoes.push(a) }, '@/lib/autorizacao': { ...auth, validarOrigem() {}, exigirAdmin: async () => ({ db }) } })
 const request = (operacao, valores) => new Request('https://loja.test/api/admin/dados', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tabela: 'produtos', operacao, valores, filtros: [{ campo: 'id', op: 'eq', valor: 'p1' }] }) })
 return { route, escritos, invalidacoes, request }
}
test('admin salva categoria canônica, elimina vínculo anterior conflitante e invalida a vitrine', async () => {
 const s = admin()
 assert.equal((await s.route.POST(s.request('update', { categoria_slug: ' Brinco ', categoria_id: 'antiga' }))).status, 200)
 assert.deepEqual(s.escritos, [{ categoria_slug: 'brincos', categoria_id: null }])
 assert.equal(s.invalidacoes.length, 1)
 assert.equal((await s.route.POST(s.request('update', { categoria_slug: '' }))).status, 400)
 assert.equal(s.escritos.length, 1)
})
test('criação antiga por API recebe classificação; ajustar somente preço não altera a categoria existente', async () => {
 const s = admin()
 assert.equal((await s.route.POST(s.request('insert', { nome: 'Colar pérola' }))).status, 200)
 assert.equal(s.escritos[0].categoria_slug, 'colares')
 assert.equal((await s.route.POST(s.request('insert', { nome: 'Peça especial' }))).status, 200)
 assert.equal(s.escritos[1].categoria_slug, 'outros')
 assert.equal((await s.route.POST(s.request('update', { preco: 120 }))).status, 200)
 assert.deepEqual(s.escritos[2], { preco: 120 })
})
