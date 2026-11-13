const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto')
const {loadTs,createDb,adapter}=require('./helpers.cjs')
const base='https://loja.test',email='cliente@example.test',sku='10000000-0000-4000-8000-000000000001'
process.env.NEXTAUTH_SECRET='fixture-auditoria';process.env.MP_ACCESS_TOKEN='fixture-only';process.env.SITE_URL=base
const req=(path,body,headers={})=>new Request(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...headers},body:JSON.stringify(body)})
async function setup(t){
 const db=await createDb('bigint','bigint');t.after(()=>db.close());const client=adapter(db)
 await db.exec("alter table usuarios add data_nascimento text;insert into usuarios(email,nome,senha,email_verificado,senha_politica_versao,saldo_cashback) values('cliente@example.test','Cliente','fixture',true,1,0)")
 await db.query("insert into produtos(id,nome,slug,preco,estoque,fotos) values($1,'Colar','colar',100,30,array['/icon.svg'])",[sku])
 const user={id:1,email,nome:'Cliente',db:client,admin:false},callbacks=[],preferencias=new Map()
 const mocks={'@/lib/supabase-admin':{getSupabaseAdmin:()=>client},'@/lib/request-user':{getRequestUser:async()=>({id:'1',email,sessaoVersao:1,senhaAtual:true,mfa:false})},'next/server':{...require('next/server'),after:fn=>callbacks.push(fn)},mercadopago:{MercadoPagoConfig:class{},Preference:class{async create({body}){const p={...body,id:'pref-'+body.external_reference,init_point:'https://pagamento.example.test'};preferencias.set(p.id,p);return p}async get({preferenceId}){return preferencias.get(preferenceId)}}}}
 const checkout=loadTs('app/api/checkout/route',mocks)
 const comprar=(cupom,chave=randomUUID())=>checkout.POST(req('/api/checkout',{itens:[{id:sku,quantidade:1}],codigoCupom:cupom},{'Idempotency-Key':chave}))
 return {db,client,user,mocks,callbacks,comprar}
}
test('benefício de primeira compra não se multiplica em checkouts concorrentes',async t=>{
 const s=await setup(t),respostas=await Promise.all([s.comprar('BEMVINDO10'),s.comprar('BEMVINDO10'),s.comprar('OFERTA15')])
 assert.equal(respostas.filter(r=>r.status===200).length,1)
 assert.deepEqual(respostas.map(r=>r.status).sort(),[200,409,409])
 assert.equal((await s.db.query('select count(*)::int n from pedidos')).rows[0].n,1)
})
test('retomar o mesmo checkout continua idempotente; expiração sem pagamento libera o benefício',async t=>{
 const s=await setup(t),chave=randomUUID(),a=await s.comprar('BEMVINDO10',chave),id=(await a.json()).pedidoId
 assert.equal(a.status,200);assert.equal((await s.comprar('BEMVINDO10',chave)).status,200)
 assert.equal((await s.db.query('select count(*)::int n from pedidos')).rows[0].n,1)
 await s.db.query("update pedidos set status='cancelado' where id=$1",[id])
 assert.equal((await s.comprar('OFERTA15')).status,200)
})
test('logout revoga o JWT copiado; repetir logout antigo não encerra uma sessão nova',async t=>{
 const s=await setup(t);let options
 loadTs('app/api/auth/[...nextauth]/route',{'@/lib/supabase-admin':{getSupabaseAdmin:()=>s.client},'next-auth':config=>{options=config;return()=>{}}})
 const token={sub:'1',email,sessaoVersao:1},session={id:'1',email,sessaoVersao:1,senhaAtual:true,mfa:false}
 const auth=loadTs('lib/autorizacao',{'@/lib/supabase-admin':{getSupabaseAdmin:()=>s.client},'@/lib/request-user':{getRequestUser:async()=>session}})
 assert.equal((await auth.exigirUsuario(req('/api/usuario',{}))).id,1)
 await options.events.signOut({token})
 await assert.rejects(()=>auth.exigirUsuario(req('/api/usuario',{})),error=>error.status===401)
 session.sessaoVersao=2
 assert.equal((await auth.exigirUsuario(req('/api/usuario',{}))).id,1)
 await options.events.signOut({token})
 assert.equal((await s.db.query('select sessao_versao from usuarios where id=1')).rows[0].sessao_versao,2)
 assert.equal((await auth.exigirUsuario(req('/api/usuario',{}))).id,1)
})
test('consulta de pagamento tem limite por conta antes do provedor e respeita propriedade do pedido',async t=>{
 const s=await setup(t),a=await s.comprar(''),id=String((await a.json()).pedidoId);let consultas=0
 const route=loadTs('app/api/pedidos/[id]/pagamento/route',{...s.mocks,
  '@/lib/pagamentos':{sincronizarPagamentoPedido:async(_,pedido)=>{consultas++;return pedido}},
  '@/lib/eventos-pedido':{incluirEventosPedidos:async(_,p)=>p},'@/lib/retirada-pedidos':{incluirRetiradas:async(_,p)=>p},'@/lib/cancelamentos':{incluirCancelamentos:async(_,p)=>p}})
 for(let i=0;i<30;i++)assert.equal((await route.POST(req('/api/pedidos/'+id+'/pagamento',{paymentId:'123'}),{params:Promise.resolve({id})})).status,200)
 assert.equal((await route.POST(req('/api/pedidos/'+id+'/pagamento',{paymentId:'123'}),{params:Promise.resolve({id})})).status,429)
 assert.equal(consultas,30)
 await s.db.exec('delete from seguranca_limites')
 await s.db.query('update pedidos set cliente_email=$1 where id=$2',['outra@example.test',id])
 assert.equal((await route.POST(req('/api/pedidos/'+id+'/pagamento',{}),{params:Promise.resolve({id})})).status,404)
 assert.equal(consultas,30)
})
test('corpo sem Content-Length tem teto real; upload limitado não começa a ler o formulário',async t=>{
 const s=await setup(t),security=loadTs('lib/seguranca',s.mocks);let cancelado=false
 const stream=new ReadableStream({pull(c){c.enqueue(new Uint8Array(6000))},cancel(){cancelado=true}},{highWaterMark:0})
 const request=new Request(base+'/api/uploads',{method:'POST',body:stream,duplex:'half'})
 await assert.rejects(()=>security.lerCorpoLimitado(request,8192),error=>error.status===413)
 assert.equal(cancelado,true)
 const upload=loadTs('app/api/uploads/route',s.mocks)
 for(let i=0;i<30;i++)await security.limitar(req('/api/uploads',{}),'upload-requisicoes',30,600,'1')
 let leituras=0
 const bloqueado=new Request(base+'/api/uploads',{method:'POST',headers:{Origin:base,'Content-Type':'multipart/form-data; boundary=test'},body:'--test--'})
 Object.defineProperty(bloqueado,'body',{get(){leituras++;throw Error('Não deve iniciar leitura')}})
 assert.equal((await upload.POST(bloqueado)).status,429)
 assert.equal(leituras,0)
})
test('mutações com cookies exigem origem local e rejeitam Fetch Metadata de outro site',()=>{
 const {validarOrigem}=loadTs('lib/autorizacao')
 assert.throws(()=>validarOrigem(new Request(base+'/api/usuario',{headers:{cookie:'session=fixture'}})),e=>e.status===403)
 assert.throws(()=>validarOrigem(new Request(base+'/api/usuario',{headers:{origin:base,'sec-fetch-site':'cross-site'}})),e=>e.status===403)
 assert.throws(()=>validarOrigem(new Request(base+'/api/usuario',{headers:{origin:'https://fraude.test'}})),e=>e.status===403)
 assert.doesNotThrow(()=>validarOrigem(new Request(base+'/api/usuario',{headers:{cookie:'session=fixture',referer:base+'/minha-conta'}})))
 assert.doesNotThrow(()=>validarOrigem(req('/api/usuario',{})))
 assert.doesNotThrow(()=>validarOrigem(new Request(base+'/api/usuario',{headers:{authorization:'Bearer fixture'}})))
 assert.doesNotThrow(()=>validarOrigem(new Request('http://localhost:3000/api/usuario',{headers:{host:'127.0.0.1:3000',cookie:'session=fixture',referer:'http://127.0.0.1:3000/minha-conta'}})))
 assert.throws(()=>validarOrigem(new Request(base+'/api/usuario',{headers:{host:'loja.test',cookie:'session=fixture',referer:'https://fraude.test','x-forwarded-host':'fraude.test'}})),e=>e.status===403)
 assert.throws(()=>validarOrigem(new Request(base+'/api/usuario',{headers:{host:'loja.test@fraude.test',origin:base}})),e=>e.status===403)
})
test('recuperação responde igualmente sem aguardar SMTP para conta existente ou inexistente',async t=>{
 const s=await setup(t),envios=[]
 const route=loadTs('app/api/auth/recuperar/route',{...s.mocks,'@/lib/mail':{enviarEmailStatus:async(...args)=>envios.push(args)}})
 const conhecido=await route.POST(req('/api/auth/recuperar',{email})),desconhecido=await route.POST(req('/api/auth/recuperar',{email:'inexistente@example.test'}))
 assert.equal(conhecido.status,200);assert.equal(desconhecido.status,200)
 assert.deepEqual(await conhecido.json(),await desconhecido.json())
 assert.equal(envios.length,0);assert.equal(s.callbacks.length,2)
 for(const fn of s.callbacks)await fn()
 assert.equal(envios.length,1);assert.equal(envios[0][0],email)
})
test('Storage já negava escrita; reforço resiste a ALLOW futuro e mantém devoluções privadas',async t=>{
 const {PGlite}=require('@electric-sql/pglite'),fs=require('node:fs'),path=require('node:path'),db=new PGlite();t.after(()=>db.close())
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
  create schema storage;grant usage on schema storage to anon,authenticated,service_role;
  create table storage.objects(id text primary key,bucket_id text);alter table storage.objects enable row level security;
  create table storage.buckets(id text primary key,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  grant all on storage.objects to anon,authenticated,service_role;
  insert into storage.buckets values('joias',true,null,null),('devolucoes',false,null,null);
  insert into storage.objects values('catalogo','joias'),('foto-privada','devolucoes');
  create policy joias_sem_upload_publico on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'joias');
  create policy joias_sem_update_publico on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'joias') with check(bucket_id<>'joias');
  create policy joias_sem_delete_publico on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'joias');`)
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role)
  await assert.rejects(()=>db.exec("insert into storage.objects values('antes','outro')"),/row-level security/)
  await db.exec('reset role')
 }
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261113190459_storage_acesso_restrito.sql'),'utf8'))
 await db.exec('create policy permissao_futura_acidental on storage.objects for all to anon,authenticated using(true) with check(true)')
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role)
  await assert.rejects(()=>db.exec("insert into storage.objects values('depois','outro')"),/row-level security/)
  assert.equal((await db.query("update storage.objects set bucket_id='outro' returning id")).rows.length,0)
  assert.equal((await db.query('delete from storage.objects returning id')).rows.length,0)
  assert.deepEqual((await db.query('select id from storage.objects')).rows,[{id:'catalogo'}])
  await db.exec('reset role')
 }
 await db.exec("set role service_role;insert into storage.objects values('api','devolucoes');reset role")
 const buckets=(await db.query('select * from storage.buckets order by id')).rows
 assert.equal(buckets[0].public,false);assert.equal(Number(buckets[0].file_size_limit),5242880)
 assert.deepEqual(buckets[0].allowed_mime_types,['image/jpeg','image/png','image/webp'])
})
test('novos objetos do deploy nascem privados, incluindo EXECUTE implícito de PUBLIC',async t=>{
 const {PGlite}=require('@electric-sql/pglite'),fs=require('node:fs'),path=require('node:path'),db=new PGlite();t.after(()=>db.close())
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
  alter default privileges for role postgres in schema public grant all on tables to anon,authenticated;
  alter default privileges for role postgres in schema public grant all on sequences to anon,authenticated;
  alter default privileges for role postgres in schema public grant execute on functions to anon,authenticated;`)
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261113193709_public_default_deny.sql'),'utf8'))
 await db.exec("create table public.futura(id bigint generated always as identity);create function public.futura_rpc() returns int language sql as $$select 1$$")
 for(const role of ['anon','authenticated']){
  const p=(await db.query("select has_table_privilege($1,'public.futura','SELECT,INSERT,UPDATE,DELETE') t,has_sequence_privilege($1,'public.futura_id_seq','USAGE,SELECT,UPDATE') s,has_function_privilege($1,'public.futura_rpc()','EXECUTE') f",[role])).rows[0]
  assert.deepEqual(p,{t:false,s:false,f:false})
 }
 const p=(await db.query("select has_table_privilege('service_role','public.futura','SELECT,INSERT,UPDATE,DELETE') t,has_sequence_privilege('service_role','public.futura_id_seq','USAGE') s,has_function_privilege('service_role','public.futura_rpc()','EXECUTE') f")).rows[0]
 assert.deepEqual(p,{t:true,s:true,f:true})
})
test('avaliações públicas preservam a vitrine sem expor identificador interno ou colunas futuras',async t=>{
 const s=await setup(t),fs=require('node:fs'),path=require('node:path')
 await s.db.exec("alter table avaliacoes add foto_url text;grant select on avaliacoes to anon,authenticated;create policy avaliacoes_leitura on avaliacoes for select to anon,authenticated using(true)")
 await s.db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261113194059_avaliacoes_colunas_publicas.sql'),'utf8'))
 await s.db.exec("alter table avaliacoes add campo_privado_futuro text;insert into avaliacoes(usuario_nome,nota,comentario,produto_id,comprador_id) values('Cliente',5,'Muito bom','10000000-0000-4000-8000-000000000001','pseudonimo-interno')")
 for(const role of ['anon','authenticated']){
  await s.db.exec('set role '+role)
  const reviews=await s.db.query("select id,nota,usuario_nome,comentario from avaliacoes where produto_id='10000000-0000-4000-8000-000000000001' order by created_at desc limit 50")
  assert.equal(reviews.rows.length,1);assert.equal(reviews.rows[0].comentario,'Muito bom')
  for(const col of ['comprador_id','foto_url','campo_privado_futuro'])await assert.rejects(()=>s.db.query('select '+col+' from avaliacoes'),/permission denied/)
  await s.db.exec('reset role')
 }
})
