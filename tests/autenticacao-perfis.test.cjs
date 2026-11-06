const { test } = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const { createDb, adapter, loadTs } = require('./helpers.cjs')
const senha = 'Frase exclusiva para testar 2026!'
process.env.NEXTAUTH_SECRET = 'fixture-autenticacao-perfis'
process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64')

async function setup(t) {
  const db = await createDb('bigint', 'bigint'); t.after(() => db.close())
  const client = adapter(db), mocks = { '@/lib/supabase-admin': { getSupabaseAdmin: () => client } }
  const sec = loadTs('lib/seguranca', mocks)
  const encrypted = sec.cifrarMfa('JBSWY3DPEHPK3PXP')
  await db.query("insert into usuarios(email,nome,perfil,role,senha,email_verificado,senha_politica_versao,mfa_secret) values('cliente@example.test','Cliente','cliente','cliente',$1,true,1,$2),('admin@example.test','Admin','admin','admin',$1,true,1,$2)", [await bcrypt.hash(senha, 4), encrypted])
  let options
  loadTs('app/api/auth/[...nextauth]/route', { ...mocks,
    'next-auth': config => { options = config; return () => {} }, 'next-auth/providers/credentials': config => config })
  const login = (email, password = senha, codigo = '') => options.providers[0].authorize({ email, password, codigo }, { headers: {} })
  const req = body => new Request('https://loja.test/api/usuario/seguranca', { method: 'POST', headers: { origin: 'https://loja.test' }, body: JSON.stringify(body) })
  return { db, client, sec, mocks, login, req }
}

test('cliente entra sem autenticador mesmo que tenha configuração antiga de MFA', async t => {
  const s = await setup(t)
  const user = await s.login('cliente@example.test')
  assert.equal(user.role, 'cliente'); assert.equal(user.mfa, false)
  await assert.rejects(s.login('cliente@example.test', 'errada'), error => !error.message.includes('ADMIN_MFA_REQUIRED'))
})

test('desafio de MFA só é revelado após senha correta de administrador; segundo fator continua obrigatório', async t => {
  const s = await setup(t)
  await assert.rejects(s.login('admin@example.test', 'errada'), error => !error.message.includes('ADMIN_MFA_REQUIRED'))
  await assert.rejects(s.login('inexistente@example.test'), error => !error.message.includes('ADMIN_MFA_REQUIRED'))
  await assert.rejects(s.login('admin@example.test'), /ADMIN_MFA_REQUIRED/)
  await assert.rejects(s.login('admin@example.test', senha, 'errado'), error => !error.message.includes('ADMIN_MFA_REQUIRED'))
  const code = s.sec.totp('JBSWY3DPEHPK3PXP', 'admin@example.test').generate()
  const user = await s.login('admin@example.test', senha, code)
  assert.equal(user.role, 'admin'); assert.equal(user.mfa, true)
  await assert.rejects(s.login('admin@example.test', senha, code))
})

test('cliente não configura MFA nem acessa o painel; alteração normal de senha revoga a sessão', async t => {
  const s = await setup(t)
  const claims = { id: '1', email: 'cliente@example.test', sessaoVersao: 1, senhaAtual: true, mfa: true }
  const mocks = { ...s.mocks, '@/lib/request-user': { getRequestUser: async () => claims } }
  const route = loadTs('app/api/usuario/seguranca/route', mocks)
  assert.equal((await route.GET(new Request('https://loja.test/api/usuario/seguranca'))).status, 403)
  for (const acao of ['configurar', 'ativar', 'desativar']) assert.equal((await route.POST(s.req({ acao, senha, codigo: '123456', role: 'admin' }))).status, 403)
  const auth = loadTs('lib/autorizacao', mocks)
  await assert.rejects(auth.exigirAdmin(new Request('https://loja.test')), error => error.status === 403)
  const r = await route.POST(s.req({ acao: 'senha', senha, novaSenha: 'Outra frase exclusiva 2026!' }))
  assert.equal(r.status, 200)
  await assert.rejects(auth.exigirUsuario(new Request('https://loja.test')), error => error.status === 401)
})

test('administrador sem MFA mantém acesso restrito à configuração do próprio autenticador', async t => {
  const s = await setup(t)
  await s.db.exec("update usuarios set mfa_secret=null where email='admin@example.test'")
  const user = await s.login('admin@example.test')
  assert.equal(user.role, 'admin'); assert.equal(user.mfa, false)
  const claims = { id: user.id, email: user.email, sessaoVersao: user.sessaoVersao, senhaAtual: true, mfa: false }
  const mocks = { ...s.mocks, '@/lib/request-user': { getRequestUser: async () => claims } }
  const auth = loadTs('lib/autorizacao', mocks)
  await assert.rejects(auth.exigirAdmin(new Request('https://loja.test')), error => error.status === 403)
  assert.equal((await loadTs('app/api/usuario/seguranca/route', mocks).GET(new Request('https://loja.test/api/usuario/seguranca'))).status, 200)
})
