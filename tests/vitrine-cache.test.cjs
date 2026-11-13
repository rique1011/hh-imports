const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTs } = require('./helpers.cjs')

function setup(error = null) {
  const invalidacoes = [], operacoes = []
  const resultado = { data: [{ id: 'produto-1', preco: 120 }], error }
  const consulta = {
    select() { return this }, eq() { return this },
    then(resolve, reject) { return Promise.resolve(resultado).then(resolve, reject) },
  }
  const db = { from(tabela) {
    return {
      select() { operacoes.push(['select', tabela]); return consulta },
      update(valores) { operacoes.push(['update', tabela, valores]); return consulta },
    }
  } }
  const route = loadTs('app/api/admin/dados/route', {
    '@/lib/seguranca':{...loadTs('lib/seguranca'),limitar:async()=>{}},
    'next/cache': { revalidateTag: (...args) => invalidacoes.push(args) },
    '@/lib/autorizacao': {
      validarOrigem() {}, exigirAdmin: async () => ({ db }),
      responderErro: () => Response.json({ error: 'Falha' }, { status: 500 }),
    },
  })
  const request = operacao => new Request('https://loja.test/api/admin/dados', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tabela: 'produtos', operacao, valores: { preco: 120 }, filtros: [{ campo: 'id', op: 'eq', valor: 'produto-1' }] }),
  })
  return { route, request, invalidacoes, operacoes }
}

test('editar um produto invalida a vitrine pública depois da gravação confirmada', async () => {
  const s = setup()
  const response = await s.route.POST(s.request('update'))
  assert.equal(response.status, 200)
  assert.deepEqual(s.operacoes, [['update', 'produtos', { preco: 120 }]])
  assert.deepEqual(s.invalidacoes, [['vitrine-publica', { expire: 0 }]])
})

test('consultar estoque no admin não invalida o cache público', async () => {
  const s = setup()
  assert.equal((await s.route.POST(s.request('select'))).status, 200)
  assert.deepEqual(s.invalidacoes, [])
})

test('falha ao salvar um produto não produz sucesso nem invalidação', async () => {
  const s = setup({ message: 'Banco indisponível' })
  assert.equal((await s.route.POST(s.request('update'))).status, 500)
  assert.deepEqual(s.invalidacoes, [])
})
