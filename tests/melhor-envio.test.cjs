const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { loadTs, createDb, adapter } = require('./helpers.cjs')
const sku = '13faf490-7cb6-4e4f-9106-0f0502c50424'
const meId = '12345678-1234-4234-8234-123456789012'
const itens = [{ id: sku, nome: 'Joia', quantidade: 1, preco: 100 }]
const entrega = { nome: 'Cliente', email: 'cliente@example.test', documento: '12345678901', telefone: '11999999999', cep: '01310100', logradouro: 'Rua Teste', numero: '10', complemento: '', bairro: 'Centro', cidade: 'Sao Paulo', uf: 'SP' }
process.env.NEXTAUTH_SECRET = 'segredo-teste-envio'
process.env.CEP_ORIGEM = '89209452'
process.env.MELHOR_ENVIO_AMBIENTE = 'production'
process.env.MELHOR_ENVIO_REMETENTE = JSON.stringify({ ...entrega, nome: 'Loja', documento: '12345678000199', cep: '89209452' })

async function setup(t, options = {}) {
  const db = await createDb('bigint'); t.after(() => db.close())
  await db.query('INSERT INTO usuarios(email,nome) VALUES($1,$2)', [entrega.email, entrega.nome])
  await db.query('INSERT INTO produtos(id,nome,preco,estoque) VALUES($1,$2,100,10)', [sku, 'Joia'])
  const client = adapter(db)
  const pedido = (await client.rpc('hh_criar_pedido_com_envio', { p_email: entrega.email, p_nome: entrega.nome, p_total: 100, p_itens: itens, p_cashback: 0, p_entrega: entrega, p_frete: null })).data
  assert.ok(pedido?.id)
  if (!options.pendente) await db.query("UPDATE pedidos SET status='confirmado' WHERE id=$1", [pedido.id])
  await db.exec('DELETE FROM pedido_notificacoes')
  const api = loadTs('lib/melhor-envio')
  const chamadas = []
  const remoto = { id: meId, status: 'pending', tracking: null, generated_at: null, paid_at: null }
  let falharCart = false, falharCheckout = false, semSaldo = false
  let cartHook
  let precoCart = '17.37'
  const fornecedor = async (path, body) => {
    chamadas.push({ path, body })
    if (path === '/cart') {
      if (cartHook) await cartHook()
      if (falharCart) throw new api.ErroMelhorEnvio(0, path)
      return { id: meId, price: precoCart }
    }
    if (path === '/shipment/checkout') {
      if (semSaldo) throw new api.ErroMelhorEnvio(422, path)
      if (falharCheckout) throw new api.ErroMelhorEnvio(0, path)
      remoto.status = 'released'; remoto.paid_at = new Date().toISOString(); return { purchase: { id: 'pago-fixture' } }
    }
    if (path === '/shipment/generate') { remoto.generated_at = new Date().toISOString(); return { [meId]: true } }
    if (path.startsWith('/orders/')) return { ...remoto }
    throw new Error('Chamada não prevista: ' + path)
  }
  const mocks = { '@/lib/supabase-admin': { getSupabaseAdmin: () => client }, '@/lib/melhor-envio': { ...api, melhorEnvio: fornecedor } }
  const lib = loadTs('lib/etiquetas', mocks)
  const frete = loadTs('lib/frete', mocks)
  const cotacao = { origem: '89209452', ambiente: 'production', itensHash: frete.hashItensFrete(itens), servico: 1, nome: 'PAC', transportadora: 'Correios', volume: { width: 11, height: 3, length: 16, weight: 0.15 }, seguro: 100 }
  const body = { freteToken: frete.assinarCotacao(entrega.cep, 17.37, cotacao), notaFiscal: '1'.repeat(44) }
  const gerar = () => lib.gerarEtiqueta(client, String(pedido.id), body)
  return { db, client, pedido, remoto, chamadas, lib, mocks, cotacao, body, frete, gerar,
    falhaCart: () => { falharCart = true }, falhaCheckout: () => { falharCheckout = true },
    saldo: value => { semSaldo = !value }, hook: value => { cartHook = value }, preco: value => { precoCart = value } }
}

test('carrinho → compra → geração assíncrona → rastreio; repetição usa um único envio e um único e-mail', async t => {
  const s = await setup(t)
  assert.equal((await s.gerar()).estado, 'gerando')
  const semRastreio = await s.gerar()
  assert.equal(semRastreio.estado, 'aguardando_rastreio'); assert.ok(semRastreio.urlEtiqueta)
  assert.equal((await s.db.query('SELECT status FROM pedidos')).rows[0].status, 'confirmado')
  assert.equal((await s.db.query("SELECT * FROM pedido_notificacoes WHERE evento='enviado'")).rows.length, 0)
  s.remoto.tracking = 'AA123456789BR'
  assert.equal((await s.gerar()).codigoRastreio, s.remoto.tracking)
  assert.equal((await s.gerar()).concluido, true)
  for (const path of ['/cart','/shipment/checkout','/shipment/generate']) assert.equal(s.chamadas.filter(c => c.path === path).length, 1)
  assert.deepEqual((await s.db.query('SELECT status,codigo_rastreio FROM pedidos')).rows[0], { status: 'enviado', codigo_rastreio: s.remoto.tracking })
  assert.equal((await s.db.query("SELECT * FROM pedido_notificacoes WHERE evento='enviado'")).rows.length, 1)
  const messages = []
  process.env.EMAIL_USER = 'loja@example.test'; process.env.EMAIL_PASS = 'teste'; process.env.SITE_URL = 'https://loja.example.test'
  const worker = loadTs('lib/notificacoes', { ...s.mocks, nodemailer: { createTransport: () => ({ sendMail: async message => { messages.push(message); return { messageId: 'teste', accepted: [message.to] } } }) } })
  await worker.processarNotificacoes(String(s.pedido.id)); await worker.processarNotificacoes(String(s.pedido.id))
  assert.equal(messages.length, 1); assert.match(messages[0].html, /AA123456789BR/); assert.match(messages[0].html, /https:\/\/loja.example.test\/minha-conta/)
})

test('duas requisições simultâneas não inserem nem compram duas etiquetas', async t => {
  const s = await setup(t)
  let iniciar, continuar
  const iniciada = new Promise(resolve => { iniciar = resolve }), pausa = new Promise(resolve => { continuar = resolve })
  s.hook(async () => { iniciar(); await pausa })
  const primeira = s.gerar(); await iniciada
  await assert.rejects(s.gerar(), /em processamento/)
  continuar(); await primeira
  assert.equal(s.chamadas.filter(c => c.path === '/cart').length, 1)
  assert.equal(s.chamadas.filter(c => c.path === '/shipment/checkout').length, 1)
})

test('timeout de inserção exige conciliação e não cria um segundo frete', async t => {
  const s = await setup(t); s.falhaCart()
  await assert.rejects(s.gerar())
  const retry = await s.gerar()
  assert.equal(retry.estado, 'insercao_incerta'); assert.equal(retry.podeRetomar, false)
  assert.equal(s.chamadas.filter(c => c.path === '/cart').length, 1)
  assert.equal(s.chamadas.filter(c => c.path === '/shipment/checkout').length, 0)
})

test('timeout de checkout consulta o mesmo ID sem cobrar novamente; retoma quando o pagamento aparece', async t => {
  const s = await setup(t); s.falhaCheckout()
  await assert.rejects(s.gerar())
  assert.equal((await s.gerar()).estado, 'compra_incerta')
  s.remoto.status = 'released'; s.remoto.paid_at = new Date().toISOString()
  assert.equal((await s.gerar()).estado, 'gerando')
  s.remoto.tracking = 'AA123456789BR'
  assert.equal((await s.gerar()).concluido, true)
  assert.equal(s.chamadas.filter(c => c.path === '/shipment/checkout').length, 1)
})

test('saldo insuficiente permite retomar checkout do mesmo carrinho após corrigir a carteira', async t => {
  const s = await setup(t); s.saldo(false)
  await assert.rejects(s.gerar(), /saldo/)
  const pendente = await s.lib.consultarEnvio(s.client, String(s.pedido.id))
  assert.equal(s.lib.resultadoEnvio(String(s.pedido.id), pendente).custoEtiqueta,17.37)
  s.saldo(true); await s.gerar()
  assert.equal(s.chamadas.filter(c => c.path === '/cart').length, 1)
  assert.equal(s.chamadas.filter(c => c.path === '/shipment/checkout').length, 2)
})

test('pedido sem pagamento e NF-e inválida são recusados antes de chamar o Melhor Envio', async t => {
  const s = await setup(t, { pendente: true })
  await assert.rejects(s.gerar(), /pagamento confirmado/)
  await s.db.query("UPDATE pedidos SET status='confirmado'")
  await assert.rejects(s.lib.gerarEtiqueta(s.client, String(s.pedido.id), { ...s.body, notaFiscal: '123' }), /44 dígitos/)
  assert.equal(s.chamadas.length, 0)
})

test('snapshot do destino fica estável após alteração do cadastro; RPC é atômica e tabela/funções são privadas', async t => {
  const s = await setup(t)
  await s.db.exec("UPDATE usuarios SET endereco='{}'")
  await s.gerar()
  const cart = s.chamadas.find(c => c.path === '/cart').body
  assert.equal(cart.to.postal_code, entrega.cep); assert.equal(cart.options.non_commercial, false)
  assert.equal(cart.options.invoice.key, '1'.repeat(44))
  await s.db.exec('BEGIN; SET LOCAL ROLE anon')
  await assert.rejects(s.db.query('SELECT * FROM pedido_envios'), /permission denied/); await s.db.exec('ROLLBACK')
  await s.db.exec('BEGIN; SET LOCAL ROLE authenticated')
  await assert.rejects(s.db.query('SELECT hh_claim_envio($1,$2,$3,$4)', [String(s.pedido.id),randomUUID(),'production',null]), /permission denied/); await s.db.exec('ROLLBACK')
  const before = (await s.db.query('SELECT count(*) FROM pedidos')).rows[0].count
  await assert.rejects(s.db.query('SELECT hh_criar_pedido_com_envio($1,$2,$3,$4,$5,$6,$7)', [entrega.email,'Cliente',100,JSON.stringify(itens),0,JSON.stringify({cep:'bad'}),null]), /Endereco/)
  assert.equal((await s.db.query('SELECT count(*) FROM pedidos')).rows[0].count, before)
})

test('cotação usa API dinâmica, quantidade/seguro e preço customizado; assinatura recusa outra sacola/serviço adulterado', async () => {
  const calls = []
  const frete = loadTs('lib/frete', { '@/lib/melhor-envio': { ambienteMelhorEnvio: () => 'production', melhorEnvio: async (path, body) => { calls.push({path,body}); return [{ id:1,name:'PAC',price:'15',custom_price:'17.37',delivery_time:5,custom_delivery_time:7,company:{name:'Correios'} }] } } })
  const lista = [{ ...itens[0], quantidade: 2 }]
  const opcoes = await frete.calcularFrete(entrega.cep, lista)
  assert.equal(opcoes[0].preco,17.37); assert.equal(opcoes[0].prazo,7)
  assert.equal(calls[0].body.volumes[0].weight,0.3); assert.equal(calls[0].body.options.insurance_value,200)
  assert.equal(frete.validarFretePedido(opcoes[0].token,entrega.cep,lista).servico,1)
  assert.equal(frete.validarFretePedido(opcoes[0].token,entrega.cep,itens),null)
  const partes=opcoes[0].token.split('.');const dado=JSON.parse(Buffer.from(partes[0],'base64url'));dado.servico=2
  const alterado=Buffer.from(JSON.stringify(dado)).toString('base64url')+'.'+partes[1]
  assert.equal(frete.validarFretePedido(alterado,entrega.cep,lista),null)
})

test('API exige administrador/origem válida e valida ID antes de qualquer operação financeira', async () => {
  const auth = loadTs('lib/autorizacao')
  for (const status of [401,403]) {
    const route = loadTs('app/api/melhor-envio/gerar-etiqueta/route', { '@/lib/autorizacao': { ...auth, exigirAdmin: async () => { throw new auth.ErroHttp(status,'Acesso recusado') } } })
    assert.equal((await route.POST(new Request('https://loja.example.test/api/melhor-envio/gerar-etiqueta',{method:'POST',body:'{"pedidoId":1}'}))).status,status)
  }
  const route = loadTs('app/api/melhor-envio/gerar-etiqueta/route', { '@/lib/autorizacao': { ...auth, exigirAdmin: async () => ({db:{}}) } })
  assert.equal((await route.POST(new Request('https://loja.example.test/api/melhor-envio/gerar-etiqueta',{method:'POST',headers:{origin:'https://outro.example.test'},body:'{"pedidoId":1}'}))).status,403)
  assert.equal((await route.POST(new Request('https://loja.example.test/api/melhor-envio/gerar-etiqueta',{method:'POST',body:'{"pedidoId":"1 OR 1=1"}'}))).status,400)
})

test('preço maior que o revisado bloqueia checkout e mantém o ID para conciliação', async t => {
  const s = await setup(t); s.preco('20.00')
  assert.equal((await s.gerar()).estado,'bloqueada')
  assert.equal((await s.gerar()).podeRetomar,false)
  assert.equal(s.chamadas.filter(c=>c.path==='/cart').length,1)
  assert.equal(s.chamadas.filter(c=>c.path==='/shipment/checkout').length,0)
  assert.equal((await s.db.query('SELECT me_id FROM pedido_envios')).rows[0].me_id,meId)
})
