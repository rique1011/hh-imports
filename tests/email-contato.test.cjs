const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTs } = require('./helpers.cjs')
const contato = 'atendimento@example.test', sender = 'smtp@example.test'
process.env.EMAIL_USER = sender
process.env.EMAIL_PASS = 'abcd efgh ijkl mnop'
process.env.NEXT_PUBLIC_CONTACT_EMAIL = contato
process.env.ADMIN_EMAIL = contato
process.env.NEXTAUTH_SECRET='fixture-mail'
process.env.SITE_URL = 'https://loja.example.test'

function setup(accepted = true) {
  const mensagens = [], configuracoes = [], callbacks=[];let count=0
  const security=loadTs('lib/seguranca');const mocks = {'next/server':{...require('next/server'),after:fn=>callbacks.push(fn)},'@/lib/seguranca':{...security,limitar:async()=>{if(++count>3)throw new security.FalhaSeguranca(429,'Limite')},limitarConta:async()=>{}}, nodemailer: { createTransport: config => {
    configuracoes.push(config)
    return { sendMail: async message => { mensagens.push(message); return { messageId: 'fixture', accepted: accepted ? [message.to] : [] } } }
  } } }
  return { mensagens, configuracoes, mocks, mail: loadTs('lib/mail', mocks), route: loadTs('app/api/contato/route', mocks), flush:async()=>{while(callbacks.length)await callbacks.shift()()} }
}
function request(body, options = {}) {
  return new Request('https://loja.example.test/api/contato', { method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://loja.example.test', 'x-forwarded-for': '192.0.2.1', ...options.headers },
    body: typeof body === 'string' ? body : JSON.stringify(body) })
}
const dados = { nome: 'Cliente de teste', email: 'cliente@example.test', mensagem: 'Preciso de ajuda com meu pedido.' }

test('contato público envia apenas à loja, escapa HTML e permite responder ao visitante', async () => {
  const s = setup()
  const response = await s.route.POST(request({ ...dados, nome: '<b>Cliente</b>', mensagem: '<img src=x onerror=alert(1)>\nMensagem de teste.', to: 'terceiro@example.test' }))
  assert.equal(response.status, 200); assert.equal(s.mensagens.length, 1)
  const message = s.mensagens[0]
  assert.equal(message.to, contato); assert.equal(message.replyTo, dados.email)
  assert.deepEqual(message.from, { name: 'H&H IMPORTS', address: sender })
  assert.match(message.html, /&lt;b&gt;Cliente&lt;\/b&gt;/)
  assert.match(message.html, /&lt;img/); assert.doesNotMatch(message.html, /<img/)
  assert.equal(s.configuracoes[0].auth.user, sender); assert.equal(s.configuracoes[0].auth.pass, 'abcdefghijklmnop')
})

test('origem externa, e-mail inválido, JSON inválido e texto excessivo não disparam mensagens', async () => {
  const s = setup()
  assert.equal((await s.route.POST(request(dados, { headers: { origin: 'https://outro.example.test' } }))).status, 403)
  assert.equal((await s.route.POST(request({ ...dados, email: 'cliente@example.test\r\nBcc:outro@example.test' }))).status, 400)
  assert.equal((await s.route.POST(request('{'))).status, 400)
  assert.equal((await s.route.POST(request({ ...dados, mensagem: 'x'.repeat(13000) }))).status, 413)
  assert.equal((await s.route.POST(request({ ...dados, mensagem: 'curta' }))).status, 400)
  assert.equal(s.mensagens.length, 0)
})

test('honeypot e limite de tentativas contêm envios; SMTP recusado não produz sucesso', async () => {
  const s = setup()
  assert.equal((await s.route.POST(request({ ...dados, website: 'bot.example.test' }))).status, 200)
  assert.equal(s.mensagens.length, 0)
  for (let i = 0; i < 3; i++) assert.equal((await s.route.POST(request(dados))).status, 200)
  assert.equal((await s.route.POST(request(dados))).status, 429)
  assert.equal(s.mensagens.length, 3)
  const falha = setup(false)
  assert.equal((await falha.route.POST(request(dados))).status, 503)
})

test('avisos administrativos e respostas usam contato novo sem trocar implicitamente a conta SMTP', async () => {
  const s = setup()
  const pedido = { id: 1, cliente_nome: 'Cliente', cliente_email: dados.email, total: 100, status: 'confirmado' }
  await s.mail.notificarAdminNovoPedido(pedido)
  await s.mail.notificarAdminPagamentoAprovado(pedido)
  await s.mail.enviarEmailStatus(dados.email, 'Cliente', 'enviado', 'AA123456789BR', pedido)
  assert.deepEqual(s.mensagens.map(m => m.to), [contato, contato, dados.email])
  assert.ok(s.mensagens.every(m => m.replyTo === contato && m.from.address === sender))
  assert.ok(s.mensagens.every(m => m.html.includes('mailto:' + contato)))
})

test('novas etiquetas usam contato oficial mesmo com e-mail antigo no JSON; CPF é preservado', () => {
  const anterior = process.env.MELHOR_ENVIO_REMETENTE
  process.env.CEP_ORIGEM = '89209452'
  process.env.MELHOR_ENVIO_REMETENTE = JSON.stringify({ nome: 'Remetente de Teste', email: 'legado@example.test', documento: '12345678901', telefone: '47999999999', logradouro: 'Rua Teste', numero: '10', bairro: 'Centro', cidade: 'Joinville', uf: 'SC' })
  try {
    const remetente = loadTs('lib/entrega').remetenteMelhorEnvio()
    assert.equal(remetente.email, contato); assert.equal(remetente.document, '12345678901')
    assert.equal(remetente.postal_code, '89209452'); assert.equal(remetente.name, 'Remetente de Teste')
  } finally {
    if (anterior === undefined) delete process.env.MELHOR_ENVIO_REMETENTE
    else process.env.MELHOR_ENVIO_REMETENTE = anterior
  }
})

test('cadastro usa o mesmo remetente autenticado, Reply-To e normalização da senha de app', async () => {
  const s = setup()
  const db={rpc:async()=>({data:true,error:null})}
  for (const caminho of ['app/api/register/route','app/api/cadastro/route']) {
    const route = loadTs(caminho, { ...s.mocks, '@/lib/supabase-admin': { getSupabaseAdmin: () => db } })
    const response = await route.POST(new Request('https://loja.example.test/api/register', { method: 'POST', body: JSON.stringify({ nome: 'Cliente', email: dados.email, senha: 'SenhaExclusivaDeTeste1!' }) }))
    assert.equal(response.status, 200)
    await s.flush()
  }
  assert.equal(s.mensagens.length, 2)
  assert.equal(s.mensagens[0].from.address, sender); assert.equal(s.mensagens[0].replyTo, contato)
  assert.match(s.mensagens[0].subject, /Confirme seu cadastro/)
  assert.equal(s.configuracoes[0].auth.pass, 'abcdefghijklmnop')
})
