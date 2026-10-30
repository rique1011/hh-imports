const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createDb, loadTs } = require('./helpers.cjs')
const sku = 'fdb5494c-8b88-48f0-a807-9a5f9c9f627c'
async function preparar(t) {
  const db = await createDb('bigint')
  t.after(() => db.close())
  await db.exec("INSERT INTO usuarios(email,nome,saldo_cashback) VALUES('cliente@example.test','Cliente',50)")
  await db.query('INSERT INTO produtos(id,nome,preco,estoque) VALUES($1,$2,100,2)', [sku, 'Joia'])
  const criar = (q = 1, cashback = 0) => db.query('SELECT hh_criar_pedido($1,$2,$3,$4,$5) AS pedido',
    ['cliente@example.test','Cliente',100, JSON.stringify([{ id: sku, nome: 'Joia', preco: 100, quantidade: q }]), cashback])
  return { db, criar }
}
test('reserva impede sobrevenda e aprovação repetida debita estoque uma única vez', async t => {
  const { db, criar } = await preparar(t)
  const resultados = await Promise.allSettled([criar(), criar(), criar()])
  assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 2)
  assert.match(resultados.find(r => r.status === 'rejected').reason.message, /Estoque insuficiente/)
  const pedido = resultados.find(r => r.status === 'fulfilled').value.rows[0].pedido
  assert.deepEqual((await db.query('SELECT estoque,estoque_reservado FROM produtos')).rows[0], { estoque: 2, estoque_reservado: 2 })
  await db.query('SELECT hh_confirmar_pagamento($1,$2,$3)', [String(pedido.id), '1234', 100])
  await db.query('SELECT hh_confirmar_pagamento($1,$2,$3)', [String(pedido.id), '1234', 100])
  assert.deepEqual((await db.query('SELECT estoque,estoque_reservado FROM produtos')).rows[0], { estoque: 1, estoque_reservado: 1 })
  assert.equal((await db.query('SELECT * FROM pedido_itens')).rows.length, 2)
})
test('falha de estoque reverte cashback; cancelamento conciliado devolve reserva e cashback uma vez', async t => {
  const { db, criar } = await preparar(t)
  await assert.rejects(criar(3, 20), /Estoque insuficiente/)
  assert.equal(Number((await db.query('SELECT saldo_cashback FROM usuarios')).rows[0].saldo_cashback), 50)
  const pedido = (await criar(2, 20)).rows[0].pedido
  assert.equal(Number((await db.query('SELECT saldo_cashback FROM usuarios')).rows[0].saldo_cashback), 30)
  await db.query("UPDATE pedidos SET status='cancelado' WHERE id=$1", [pedido.id])
  await db.query("UPDATE pedidos SET status='cancelado' WHERE id=$1", [pedido.id])
  assert.deepEqual((await db.query('SELECT estoque,estoque_reservado FROM produtos')).rows[0], { estoque: 2, estoque_reservado: 0 })
  assert.equal(Number((await db.query('SELECT saldo_cashback FROM usuarios')).rows[0].saldo_cashback), 50)
  await assert.rejects(db.query('SELECT hh_confirmar_pagamento($1,$2,$3)', [String(pedido.id), '5678', 100]), /conciliacao/)
})
test('itens repetidos compartilham reserva e estoque administrativo não pode ficar abaixo dela', async t => {
  const { db } = await preparar(t)
  const itens = [{ id: sku, nome: 'Joia', preco: 100, quantidade: 1 }, { id: sku, nome: 'Joia', preco: 100, quantidade: 1 }]
  await db.query('SELECT hh_criar_pedido($1,$2,$3,$4,$5)', ['cliente@example.test','Cliente',200,JSON.stringify(itens),0])
  assert.equal((await db.query('SELECT estoque_reservado FROM produtos')).rows[0].estoque_reservado, 2)
  await assert.rejects(db.exec('UPDATE produtos SET estoque=1'), /estoque_reservado_valido/)
})
test('cotação assinada recusa adulteração, outro CEP, vencimento e preço zero', () => {
  process.env.NEXTAUTH_SECRET = 'segredo-apenas-fixture'
  const { assinarCotacao, validarCotacao } = loadTs('lib/frete.ts')
  const token = assinarCotacao('01310100', 17.37)
  assert.equal(validarCotacao(token, '01310100'), 17.37)
  assert.equal(validarCotacao(token, '99999999'), null)
  assert.equal(validarCotacao('x' + token, '01310100'), null)
  assert.equal(validarCotacao(assinarCotacao('01310100', 0), '01310100'), null)
  const original = Date.now
  try { Date.now = () => original() + 16 * 60000; assert.equal(validarCotacao(token, '01310100'), null) }
  finally { Date.now = original }
})
