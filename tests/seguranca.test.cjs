const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createDb, loadTs, adapter } = require('./helpers.cjs')

test('migração bloqueia dados e escritas públicas, mantendo somente catálogo, categorias e avaliações legíveis', async t => {
  const db = await createDb('bigint'); t.after(() => db.close())
  await db.exec(`
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS recovery_token text;
    ALTER TABLE produtos ADD COLUMN categoria_id uuid, ADD COLUMN categoria_slug text, ADD COLUMN criado_em timestamptz;
    CREATE TABLE IF NOT EXISTS categorias(id uuid primary key, nome text);
    CREATE TABLE IF NOT EXISTS avaliacoes(id bigint primary key, produto_id uuid, created_at timestamptz);
    CREATE TABLE IF NOT EXISTS trocas(id uuid primary key,pedido_id text,produto_id uuid,usuario_id uuid);
    CREATE TABLE carrinhos_abandonados(id uuid primary key,cliente_email text);
    CREATE SCHEMA storage; CREATE TABLE storage.objects(id uuid,bucket_id text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA public,storage TO anon,authenticated,service_role;
    GRANT ALL ON usuarios,pedidos,produtos,cupons,categorias,avaliacoes,trocas,carrinhos_abandonados,pedido_notificacoes TO anon,authenticated;
    CREATE POLICY legado ON usuarios FOR ALL TO public USING(true) WITH CHECK(true);
    CREATE POLICY "Permitir uploads no bucket joias" ON storage.objects FOR INSERT TO public WITH CHECK(bucket_id='joias');
    INSERT INTO usuarios(email) VALUES('privado@example.test');
    INSERT INTO produtos(id,nome,preco) VALUES(gen_random_uuid(),'Visível',20);
    INSERT INTO cupons(codigo,desconto,ativo,usuario_id) VALUES('PUBLICO',10,true,null),('INATIVO',50,false,null),('PRIVADO',30,true,gen_random_uuid());
  `)
  const migration = fs.readdirSync(path.join(__dirname,'../supabase/migrations')).find(name => name.endsWith('_fechar_acesso_publico.sql'))
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',migration),'utf8'))
  // A reaplicação mantém as mesmas permissões e não duplica políticas.
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',migration),'utf8'))
  for (const role of ['anon','authenticated']) {
    const lerComo = async sql => db.exec('SET ROLE ' + role).then(() => db.query(sql)).finally(() => db.exec('RESET ROLE'))
    for (const tabela of ['usuarios','pedidos','trocas','carrinhos_abandonados','pedido_notificacoes','pedido_itens','cupons']) {
      await assert.rejects(lerComo('SELECT * FROM ' + tabela), /permission denied/)
      await assert.rejects(lerComo('INSERT INTO ' + tabela + ' DEFAULT VALUES'), /permission denied/)
      await assert.rejects(lerComo('DELETE FROM ' + tabela), /permission denied/)
    }
    assert.equal((await lerComo('SELECT nome FROM produtos')).rows[0].nome, 'Visível')
    assert.deepEqual((await lerComo('SELECT slug FROM categorias ORDER BY slug')).rows.map(c => c.slug), ['aneis','brincos','colares','outros','pulseiras','relogios'])
    assert.deepEqual((await lerComo('SELECT * FROM avaliacoes')).rows, [])
    for (const tabela of ['produtos','categorias','avaliacoes']) {
      await assert.rejects(lerComo('INSERT INTO ' + tabela + ' DEFAULT VALUES'), /permission denied/)
      await assert.rejects(lerComo('DELETE FROM ' + tabela), /permission denied/)
    }
    await assert.rejects(lerComo("UPDATE produtos SET preco=0"), /permission denied/)
    await assert.rejects(lerComo('TRUNCATE usuarios'), /permission denied/)
    await assert.rejects(lerComo("SELECT hh_criar_pedido('x@y.test','x',1,'[]',0)"), /permission denied/)
  }
  await db.exec('SET ROLE service_role')
  assert.equal((await db.query('SELECT count(*)::int AS n FROM usuarios')).rows[0].n, 1)
  await db.exec('RESET ROLE')
})

test('perfil retorna somente DTO e pedidos são filtrados pelo dono autenticado', async t => {
  const db = await createDb('bigint'); t.after(() => db.close())
  await db.exec(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cpf_cnpj text, ADD COLUMN IF NOT EXISTS whatsapp text, ADD COLUMN data_nascimento text,
    ADD COLUMN IF NOT EXISTS endereco text, ADD COLUMN IF NOT EXISTS senha text, ADD COLUMN IF NOT EXISTS recovery_token text;
    INSERT INTO usuarios(email,nome,senha,recovery_token) VALUES('dono@example.test','Dono','hash-privado','token-privado'),('outro@example.test','Outro','hash-outro','token-outro');
    INSERT INTO pedidos(cliente_email,status,total,itens) VALUES('dono@example.test','legado',20,'[]'),('outro@example.test','legado',20,'[]');`)
  const client = adapter(db)
  const user = (await db.query("SELECT id FROM usuarios WHERE email='dono@example.test'")).rows[0]
  const auth = loadTs('lib/autorizacao.ts', { '@/lib/request-user': { getRequestUser: async () => null } })
  const mocks = { '@/lib/autorizacao': { ...auth, exigirUsuario: async () => ({ id: user.id, email: 'dono@example.test', db: client }) } }
  const perfil = await loadTs('app/api/usuario/route.ts', mocks).GET(new Request('https://loja.test/api/usuario'))
  assert.equal(perfil.status, 200)
  const json = await perfil.json()
  assert.equal(json.senha, undefined); assert.equal(json.recovery_token, undefined)
  assert.equal(json.email, 'dono@example.test'); assert.equal(json.possui_pedidos, true)
  // O adaptador mínimo não implementa order, suficiente para testar o endpoint de um pedido.
  const pedidoOutro = (await db.query("SELECT id FROM pedidos WHERE cliente_email='outro@example.test'")).rows[0]
  const route = loadTs('app/api/pedidos/[id]/route.ts', mocks)
  assert.equal((await route.GET(new Request('https://loja.test/api/pedidos/' + pedidoOutro.id), { params: Promise.resolve({ id: String(pedidoOutro.id) }) })).status, 404)
})

test('sem sessão não há perfil; cliente comum não acessa o proxy administrativo; origem externa não altera dados', async () => {
  const semSessao = loadTs('lib/autorizacao.ts', { '@/lib/request-user': { getRequestUser: async () => null } })
  await assert.rejects(semSessao.exigirUsuario(new Request('https://loja.test')), error => error.status === 401)
  assert.throws(() => semSessao.validarOrigem(new Request('https://loja.test', { headers: { origin: 'https://outro.test' } })), error => error.status === 403)
  const comum = loadTs('lib/autorizacao.ts', {
    '@/lib/request-user': { getRequestUser: async () => ({id:'1',sessaoVersao:1,senhaAtual:true,mfa:false,email:'cliente@example.test'}) },
    '@/lib/supabase-admin': { getSupabaseAdmin: () => ({ from: () => ({ select() { return this }, eq() { return this }, async single() { return { data: { id:1,sessao_versao:1,senha_politica_versao:1,bloqueado:false,email:'cliente@example.test', email_verificado: true, perfil: 'cliente', role: 'user' }, error: null } } }) }) },
  })
  await assert.rejects(comum.exigirAdmin(new Request('https://loja.test')), error => error.status === 403)
  const route = loadTs('app/api/admin/dados/route.ts', { '@/lib/autorizacao': comum })
  assert.equal((await route.POST(new Request('https://loja.test/api/admin/dados', { method: 'POST', body: '{}' }))).status, 403)
})
