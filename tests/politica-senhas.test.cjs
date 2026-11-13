const { test } = require('node:test'), assert = require('node:assert/strict'), bcrypt = require('bcryptjs')
const { createDb, adapter, loadTs } = require('./helpers.cjs')
const cliente = 'cliente8@example.test', admin = 'admin15@example.test', antiga = 'Frase exclusiva atual 2026!', curta = 'Joia2026'
process.env.NEXTAUTH_SECRET = 'fixture-politicas-senhas'
async function setup(t) {
 const db = await createDb('bigint','bigint');t.after(()=>db.close());const client=adapter(db),emails=[],callbacks=[]
 const mocks={'next/server':{...require('next/server'),after:fn=>callbacks.push(fn)},'@/lib/supabase-admin':{getSupabaseAdmin:()=>client},'@/lib/mail':{escapeHtml:x=>x,enviarEmailLoja:async(...args)=>{emails.push(args);return{sucesso:true}}}}
 let options
 loadTs('app/api/auth/[...nextauth]/route',{...mocks,'next-auth':config=>{options=config;return()=>{}},'next-auth/providers/credentials':config=>config})
 const login=(email,password)=>options.providers[0].authorize({email,password},{headers:{}})
 const req=body=>new Request('https://loja.test/api/teste',{method:'POST',headers:{origin:'https://loja.test'},body:JSON.stringify(body)})
 const sec=loadTs('lib/seguranca',mocks)
 const criar=async(email,administrador=false)=>{await db.query('insert into usuarios(email,nome,senha,email_verificado,senha_politica_versao,perfil,role) values($1,$2,$3,true,1,$4,$4)',[email,'Pessoa Teste',await bcrypt.hash(antiga,4),administrador?'admin':'cliente']);return(await db.query('select * from usuarios where email=$1',[email])).rows[0]}
 return{db,client,mocks,emails,login,req,sec,criar,flush:async()=>{while(callbacks.length)await callbacks.shift()()}}
}
test('cadastro aceita oito caracteres, rejeita sete e mantém confirmação de e-mail antes de entrar',async t=>{
 const s=await setup(t),cadastro=loadTs('app/api/register/route',s.mocks)
 assert.equal((await cadastro.POST(s.req({nome:'Cliente Teste',email:cliente,senha:'Joia026'}))).status,400)
 assert.equal((await cadastro.POST(s.req({nome:'Cliente Teste',email:cliente,senha:curta,role:'admin'}))).status,200)
 await s.flush()
 await assert.rejects(s.login(cliente,curta))
 const codigo=s.emails[0][2].match(/<strong>(\d{6})<\/strong>/)[1]
 assert.equal((await loadTs('app/api/verificar/route',s.mocks).POST(s.req({email:cliente,codigo}))).status,200)
 const user=await s.login(cliente,curta);assert.equal(user.role,'cliente');assert.equal(user.senhaAtual,true);assert.equal(user.mfa,false)
 const auth=loadTs('lib/autorizacao',{...s.mocks,'@/lib/request-user':{getRequestUser:async()=>({id:user.id,email:cliente,sessaoVersao:user.sessaoVersao,senhaAtual:user.senhaAtual,mfa:user.mfa})}})
 assert.equal((await auth.exigirUsuario(new Request('https://loja.test'))).email,cliente)
 await assert.rejects(auth.exigirAdmin(new Request('https://loja.test')),e=>e.status===403)
})
test('troca de senha usa perfil do banco: cliente aceita oito, admin continua exigindo quinze',async t=>{
 const s=await setup(t),c=await s.criar(cliente),a=await s.criar(admin,true);let user=c
 const mocks={...s.mocks,'@/lib/request-user':{getRequestUser:async()=>({id:String(user.id),email:user.email,sessaoVersao:user.sessao_versao,senhaAtual:true,mfa:false})}}
 const route=loadTs('app/api/usuario/seguranca/route',mocks)
 assert.equal((await route.POST(s.req({acao:'senha',senha:antiga,novaSenha:curta}))).status,200)
 assert.equal(await bcrypt.compare(curta,(await s.db.query('select senha from usuarios where id=$1',[c.id])).rows[0].senha),true)
 user=a
 const r=await route.POST(s.req({acao:'senha',senha:antiga,novaSenha:curta,administrador:false,role:'cliente'}));assert.equal(r.status,400);assert.match((await r.json()).error,/15 caracteres/)
 assert.equal((await route.POST(s.req({acao:'senha',senha:antiga,novaSenha:'Frase nova exclusiva 2026!'}))).status,200)
})
test('recuperação mantém senha de oito para clientes, quinze para admin e token de uso único',async t=>{
 const s=await setup(t),c=await s.criar(cliente),a=await s.criar(admin,true),route=loadTs('app/api/auth/redefinir/route',s.mocks)
 for(const [u,token]of [[c,'c'.repeat(64)],[a,'a'.repeat(64)]])await s.db.query("update usuarios set recovery_token=$1,recovery_token_expires=now()+interval '1 hour' where id=$2",[s.sec.hash(token),u.id])
 const r=await route.POST(s.req({token:'c'.repeat(64),novaSenha:curta}));assert.equal(r.status,200)
 assert.equal((await route.POST(s.req({token:'c'.repeat(64),novaSenha:curta}))).status,400)
 const rejeitado=await route.POST(s.req({token:'a'.repeat(64),novaSenha:curta,administrador:false,role:'cliente'}));assert.equal(rejeitado.status,400);assert.equal((await rejeitado.json()).minimoSenha,15)
 assert.equal((await route.POST(s.req({token:'a'.repeat(64),novaSenha:'Frase nova exclusiva 2026!'}))).status,200)
 assert.deepEqual((await s.db.query('select sessao_versao,recovery_token from usuarios order by id')).rows,[{sessao_versao:2,recovery_token:null},{sessao_versao:2,recovery_token:null}])
})
test('promoção concorrente para admin impede redefinir pela regra de cliente',async t=>{
 const s=await setup(t),u=await s.criar(cliente),token='d'.repeat(64)
 await s.db.query("update usuarios set recovery_token=$1,recovery_token_expires=now()+interval '1 hour' where id=$2",[s.sec.hash(token),u.id])
 let interceptar=true
 const client={...s.client,from:tabela=>{const q=s.client.from(tabela),update=q.update.bind(q);q.update=values=>{if(tabela==='usuarios'&&values.senha&&interceptar){interceptar=false;const execute=q.execute.bind(q);q.execute=async(...args)=>{await s.db.query("update usuarios set role='admin' where id=$1",[u.id]);return execute(...args)}}return update(values)};return q}}
 const route=loadTs('app/api/auth/redefinir/route',{...s.mocks,'@/lib/supabase-admin':{getSupabaseAdmin:()=>client}})
 assert.equal((await route.POST(s.req({token,novaSenha:curta}))).status,400)
 const atual=(await s.db.query('select * from usuarios where id=$1',[u.id])).rows[0];assert.equal(atual.role,'admin');assert.equal(atual.senha,u.senha);assert.equal(atual.recovery_token,s.sec.hash(token))
})
