const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTs } = require('./helpers.cjs')

const api = loadTs('lib/melhor-envio')

test('recusa de cadastro identifica campos sem atribuir a falha ao saldo ou divulgar os valores recebidos', () => {
  const erro = new api.ErroMelhorEnvio(422, '/cart', { message: 'Invalid data', errors: {
    'to.document': ['CPF privado 12345678901 recusado'],
    'from.postal_code': ['CEP 89209452 inválido'],
    'from.address': ['Endereço particular'],
    'volumes.0.weight': ['Peso incorreto'],
    'products.0.unitary_value': ['Valor incorreto'],
    'campo-com-token-privado': ['Bearer segredo'],
  } })
  assert.match(erro.message, /cadastro do envio, antes da compra/)
  assert.match(erro.message, /CPF do destinatário/)
  assert.match(erro.message, /endereço do remetente/)
  assert.match(erro.message, /peso e medidas/)
  assert.equal(erro.campos.filter(campo => campo === 'endereço do remetente').length, 1)
  assert.doesNotMatch(erro.message, /saldo|12345678901|89209452|particular|segredo|Bearer|campo-com-token/)
  assert.equal(erro.saldoInsuficiente, false)
})

test('saldo insuficiente exige confirmação explícita do fornecedor e difere de um checkout recusado sem detalhe', () => {
  for (const message of ['Saldo insuficiente.', 'Insufficient balance', 'Insufficient funds', 'O usuário não tem saldo suficiente.']) {
    const erro = new api.ErroMelhorEnvio(422, '/shipment/checkout', { message })
    assert.match(erro.message, /^Saldo insuficiente/)
    assert.equal(erro.saldoInsuficiente, true)
  }
  const desconhecido = new api.ErroMelhorEnvio(422, '/shipment/checkout', { message: 'Pendência privada da conta' })
  assert.match(desconhecido.message, /recusou o pagamento/)
  assert.equal(desconhecido.saldoInsuficiente, false)
  assert.doesNotMatch(desconhecido.message, /Saldo insuficiente|Pendência privada/)
  assert.doesNotMatch(new api.ErroMelhorEnvio(422, '/cart').message, /saldo/)
})

test('cotações e geração mostram a etapa correta e respostas inesperadas não vazam conteúdo externo', () => {
  assert.match(new api.ErroMelhorEnvio(422, '/shipment/calculate').message, /cotação/)
  assert.doesNotMatch(new api.ErroMelhorEnvio(422, '/shipment/calculate').message, /saldo/)
  assert.match(new api.ErroMelhorEnvio(422, '/shipment/generate').message, /geração/)
  assert.match(new api.ErroMelhorEnvio(422, '/shipment/generate').message, /mesma etiqueta/)
  for (const resposta of [null, [], 'conteúdo privado', { errors: ['CPF privado'] }, { message: '<script>segredo</script>', errors: { __proto__: ['segredo'], constructor: ['segredo'] } }]) {
    assert.doesNotMatch(new api.ErroMelhorEnvio(422, '/cart', resposta).message, /conteúdo privado|CPF privado|script|segredo|constructor/)
  }
  assert.match(new api.ErroMelhorEnvio(403, '/cart').message, /MELHOR_ENVIO_TOKEN/)
})

test('cliente HTTP preserva status e campos seguros sem registrar resposta, credenciais ou identificadores privados', async t => {
  const originalFetch = global.fetch, originalWarn = console.warn, logs = []
  const anterior = process.env.MELHOR_ENVIO_TOKEN
  process.env.MELHOR_ENVIO_TOKEN = 'segredo-de-teste'
  console.warn = (...args) => logs.push(args)
  t.after(() => { global.fetch = originalFetch; console.warn = originalWarn; if (anterior === undefined) delete process.env.MELHOR_ENVIO_TOKEN; else process.env.MELHOR_ENVIO_TOKEN = anterior })
  global.fetch = async () => Response.json({ message: 'Dados privados do cliente', errors: { 'to.phone': ['Telefone privado 47999999999'] } }, { status: 422 })
  await assert.rejects(api.requisitarMelhorEnvio('/cart', { dados: 'privados' }), erro => {
    assert.equal(erro.status, 422)
    assert.equal(erro.operacao, '/cart')
    assert.match(erro.message, /telefone do destinatário/)
    return true
  })
  await assert.rejects(api.requisitarMelhorEnvio('/orders/id-privado'))
  assert.equal(logs[1][1].operacao, '/orders/:id')
  assert.doesNotMatch(JSON.stringify(logs), /segredo-de-teste|47999999999|Dados privados|dados|id-privado/)
  global.fetch = async () => new Response('página HTML privada', { status: 422 })
  await assert.rejects(api.requisitarMelhorEnvio('/cart'), /cadastro do envio/)
  assert.doesNotMatch(JSON.stringify(logs), /HTML privada/)
})

test('motivo do fornecedor em listas e objetos fica disponível apenas na mensagem administrativa', () => {
  for (const resposta of [
    { error: { message: ['Finalize a verificação da conta para continuar.'] } },
    { message: ['Finalize a verificação da conta para continuar.'] },
    { errors: { envio: ['Finalize a verificação da conta para continuar.'] } },
    ['Finalize a verificação da conta para continuar.'],
  ]) {
    const erro = new api.ErroMelhorEnvio(422, '/cart', resposta)
    assert.match(erro.mensagemAdministrativa, /Motivo informado pelo Melhor Envio: Finalize a verificação/)
    assert.doesNotMatch(erro.message, /Finalize a verificação/)
    assert.doesNotMatch(JSON.stringify(erro), /Finalize a verificação/)
  }
  const circular = {}; circular.data = circular
  assert.doesNotThrow(() => new api.ErroMelhorEnvio(422, '/cart', circular))
  assert.ok(new api.ErroMelhorEnvio(422, '/cart', { message: 'a '.repeat(2000) }).mensagemAdministrativa.length < 1000)
})

test('motivo administrativo oculta credenciais e valores pessoais do pedido sem perder a orientação do fornecedor', async t => {
  const originalFetch = global.fetch, originalWarn = console.warn, logs = [], anterior = process.env.MELHOR_ENVIO_TOKEN
  process.env.MELHOR_ENVIO_TOKEN = 'segredo-de-teste'
  console.warn = (...args) => logs.push(args)
  t.after(() => { global.fetch = originalFetch; console.warn = originalWarn; if (anterior === undefined) delete process.env.MELHOR_ENVIO_TOKEN; else process.env.MELHOR_ENVIO_TOKEN = anterior })
  global.fetch = async () => Response.json({ error: { message: [
    'Finalize o cadastro da conta. Cliente Particular; CPF 123.456.789-01; (47) 99999-9999; cliente@example.test; Rua Privada, 10; CEP 89209-452; Bearer segredo-de-teste.',
  ] } }, { status: 422 })
  await assert.rejects(api.requisitarMelhorEnvio('/cart', { to: {
    name: 'Cliente Particular', document: '12345678901', phone: '47999999999', email: 'cliente@example.test', address: 'Rua Privada', number: '10', postal_code: '89209452',
  } }), erro => {
    assert.match(erro.mensagemAdministrativa, /Finalize o cadastro da conta/)
    assert.match(erro.mensagemAdministrativa, /oculto/)
    assert.doesNotMatch(erro.mensagemAdministrativa, /Cliente Particular|123\.456\.789-01|99999-9999|cliente@example|Rua Privada|89209-452|segredo-de-teste/)
    assert.doesNotMatch(erro.message, /Finalize o cadastro/)
    return true
  })
  assert.doesNotMatch(JSON.stringify(logs), /Finalize o cadastro|Particular|Privada|segredo-de-teste|99999|example.test/)
})

test('resposta pública e logs da API não expõem o motivo reservado ao administrador', async t => {
  const logs = [], originalError = console.error
  console.error = (...args) => logs.push(args)
  t.after(() => { console.error = originalError })
  const erro = new api.ErroMelhorEnvio(422, '/shipment/calculate', { message: 'Diagnóstico reservado da conta da loja' })
  const response = loadTs('lib/autorizacao').responderErro(erro)
  assert.equal(response.status, 500)
  assert.doesNotMatch(JSON.stringify(await response.json()), /Diagnóstico reservado/)
  assert.doesNotMatch(JSON.stringify(logs), /Diagnóstico reservado/)
})
