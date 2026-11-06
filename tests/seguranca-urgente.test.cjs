const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto')
const {createDb,adapter,loadTs}=require('./helpers.cjs')
const email='seguranca@example.test',sku='13faf490-7cb6-4e4f-9106-0f0502c50424',senha='Frase exclusiva da loja 2026!'
process.env.NEXTAUTH_SECRET='segredo-apenas-para-testes';process.env.MFA_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64')
async function setup(t){const db=await createDb('bigint','bigint');t.after(()=>db.close());const client=adapter(db),mocks={'@/lib/supabase-admin':{getSupabaseAdmin:()=>client},'@/lib/mail':{enviarEmailLoja:async()=>({sucesso:true}),enviarEmailStatus:async()=>({sucesso:true}),escapeHtml:s=>s}}
 await db.query("insert into produtos(id,nome,preco,estoque) values($1,'Joia',100,20)",[sku])
 const sec=loadTs('lib/seguranca',mocks);const req=body=>new Request('https://loja.test/api/teste',{method:'POST',headers:{origin:'https://loja.test','content-type':'application/json'},body:JSON.stringify(body)})
 return{db,client,mocks,sec,req}}
test('senha fraca rejeitada no servidor; código criptográfico tem validade e cinco tentativas',async t=>{
 const s=await setup(t),route=loadTs('app/api/register/route',s.mocks),ver=loadTs('app/api/verificar/route',s.mocks)
 assert.equal((await route.POST(s.req({nome:'Cliente',email,senha:'x'}))).status,400)
 assert.equal((await route.POST(s.req({nome:'Cliente',email,senha}))).status,200)
 let u=(await s.db.query('select * from usuarios')).rows[0];assert.match(u.codigo_verificacao,/^[a-f0-9]{64}$/);assert.ok(u.verificacao_expires>new Date());assert.equal(u.senha_politica_versao,1)
 await s.db.query('update usuarios set codigo_verificacao=$1',[s.sec.codigoVerificacao(email,'123456')])
 for(let i=0;i<5;i++)assert.equal((await ver.POST(s.req({email,codigo:'111111'}))).status,400)
 assert.equal((await ver.POST(s.req({email,codigo:'123456'}))).status,400)
 await s.db.exec("update usuarios set verificacao_tentativas=0,verificacao_expires=now()-interval '1 second'")
 assert.equal((await ver.POST(s.req({email,codigo:'123456'}))).status,400)
 await s.db.exec("update usuarios set verificacao_expires=now()+interval '1 minute'")
 assert.equal((await ver.POST(s.req({email,codigo:'123456'}))).status,200)
 assert.equal((await ver.POST(s.req({email,codigo:'123456'}))).status,400)
})
test('recuperação concorrente é de uso único e revoga JWT antigo e conta bloqueada',async t=>{
 const s=await setup(t),bcrypt=require('bcryptjs'),token='a'.repeat(64)
 await s.db.query("insert into usuarios(email,nome,senha,email_verificado,senha_politica_versao,perfil,recovery_token,recovery_token_expires) values($1,'Admin',$2,true,1,'admin',$3,now()+interval '1 hour')",[email,await bcrypt.hash(senha,4),s.sec.hash(token)])
 const claims={id:'1',email,sessaoVersao:1,senhaAtual:true,mfa:true}
 const auth=loadTs('lib/autorizacao',{...s.mocks,'@/lib/request-user':{getRequestUser:async()=>claims}})
 assert.equal((await auth.exigirUsuario(new Request('https://loja.test'))).id,1)
 const reset=loadTs('app/api/auth/redefinir/route',s.mocks)
 const results=await Promise.all([1,2].map(()=>reset.POST(s.req({token,novaSenha:'Outra frase exclusiva 2026!'}))))
 assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);assert.equal((await s.db.query('select sessao_versao from usuarios')).rows[0].sessao_versao,2)
 await assert.rejects(auth.exigirUsuario(new Request('https://loja.test')),e=>e.status===401)
 claims.sessaoVersao=2;await s.db.exec('update usuarios set bloqueado=true')
 await assert.rejects(auth.exigirUsuario(new Request('https://loja.test')),e=>e.status===401)
})
test('MFA cifra autenticador; login sem segundo fator não administra; código e backup não repetem',async t=>{
 const s=await setup(t),secret='JBSWY3DPEHPK3PXP',encrypted=s.sec.cifrarMfa(secret)
 assert.notEqual(encrypted,secret);assert.equal(s.sec.decifrarMfa(encrypted),secret)
 await s.db.query("insert into usuarios(email,nome,email_verificado,senha_politica_versao,perfil,mfa_secret,mfa_recuperacao) values($1,'Admin',true,1,'admin',$2,ARRAY[$3])",[email,encrypted,s.sec.hash('a'.repeat(20))])
 let mfa=false;const auth=loadTs('lib/autorizacao',{...s.mocks,'@/lib/request-user':{getRequestUser:async()=>({id:'1',email,sessaoVersao:1,senhaAtual:true,mfa})}})
 await assert.rejects(auth.exigirAdmin(new Request('https://loja.test')),e=>e.status===403)
 const u=(await s.db.query('select * from usuarios')).rows[0],code=s.sec.totp(secret,email).generate()
 assert.equal(await s.sec.consumirMfa(s.client,u,code),true);assert.equal(await s.sec.consumirMfa(s.client,u,code),false)
 assert.equal(await s.sec.consumirMfa(s.client,u,'a'.repeat(20)),true);assert.equal(await s.sec.consumirMfa(s.client,u,'a'.repeat(20)),false)
 mfa=true;assert.equal((await auth.exigirAdmin(new Request('https://loja.test'))).admin,true)
})
test('limitação persistente vale entre instâncias e tabelas/RPCs negam anônimo',async t=>{
 const s=await setup(t),k='1'.repeat(64)
 assert.equal((await s.client.rpc('hh_limitar',{p_chave:k,p_limite:2,p_segundos:60})).data,true)
 assert.equal((await adapter(s.db).rpc('hh_limitar',{p_chave:k,p_limite:2,p_segundos:60})).data,true)
 assert.equal((await s.client.rpc('hh_limitar',{p_chave:k,p_limite:2,p_segundos:60})).data,false)
 await s.db.exec('set role anon');await assert.rejects(s.db.query('select * from seguranca_limites'),/permission denied/);await assert.rejects(s.db.query('select hh_limitar($1,2,60)',[k]),/permission denied/);await s.db.exec('reset role')
})
async function pedido(s,key=crypto.randomUUID(),total=100){const {data,error}=await s.client.rpc('hh_checkout_seguro',{p_email:email,p_nome:'Cliente',p_total:total,p_itens:[{id:sku,nome:'Joia',preco:100,quantidade:1}],p_cashback:0,p_entrega:{nome:'Cliente',email,documento:'12345678901',telefone:'11999999999',cep:'89209452',logradouro:'Rua Casa',numero:'1',bairro:'Centro',cidade:'Joinville',uf:'SC'},p_frete:null,p_chave:key,p_hash:'hash'});assert.equal(error,null);return data}
test('checkout idempotente e máximo de três reservas; órfão novo expira somente após busca sem tentativas',async t=>{
 const s=await setup(t);await s.db.query('insert into usuarios(email,nome) values($1,$2)',[email,'Cliente'])
 const key=crypto.randomUUID(),p=await pedido(s,key);assert.equal((await pedido(s,key)).id,p.id)
 assert.equal((await s.db.query('select estoque_reservado from produtos')).rows[0].estoque_reservado,1)
 await pedido(s);await pedido(s)
 await assert.rejects(pedido(s),/tres pedidos/)
 await s.db.query("update pedidos set pagamento_expira_em=now()-interval '1 hour',pagamento_consultado_em=now() where id=$1",[p.id])
 const row=(await s.db.query('select * from pedidos where id=$1',[p.id])).rows[0]
 const out=await s.client.rpc('hh_expirar_pagamento_sem_tentativa',{p_pedido_id:String(p.id),p_consultado_em:row.pagamento_consultado_em.toISOString()})
 assert.equal(out.error,null);assert.equal(out.data.status,'cancelado');assert.equal((await s.db.query('select estoque_reservado from produtos')).rows[0].estoque_reservado,2)
})
for(const status of ['refunded','charged_back','in_mediation','partial'])test('pagamento '+status+' pausa etiqueta e reverte créditos de forma idempotente',async t=>{
 const s=await setup(t);await s.db.query('insert into usuarios(email,nome) values($1,$2)',[email,'Cliente']);await s.db.exec("update envio_automatico_config set ativa=true,documento_fiscal='declaracao',declaracao_confirmada=true,limite_centavos=2500")
 const p=await pedido(s),sync=d=>s.client.rpc('hh_sincronizar_pagamento',{p_pedido_id:String(p.id),p_pagamento_id:'12345',p_total:100,p_dados:d})
 assert.equal((await sync({status:'approved',atualizado_em:'2026-11-06T10:00:00Z'})).error,null)
 assert.equal((await s.db.query('select saldo_cashback from usuarios')).rows[0].saldo_cashback,'5.00')
 const dados={status:status==='partial'?'approved':status,valor_reembolsado:status==='partial'?50:0,atualizado_em:'2026-11-06T11:00:00Z'}
 for(let i=0;i<2;i++){const r=await sync(dados);assert.equal(r.error,null);assert.equal(r.data.pagamento.requer_revisao,true)}
 const u=(await s.db.query('select saldo_cashback from usuarios')).rows[0];assert.equal(Number(u.saldo_cashback),status==='in_mediation'?5:status==='partial'?2.5:0)
 assert.equal((await s.db.query('select estado from envio_automatico_fila')).rows[0].estado,'atencao')
 const labels=loadTs('lib/etiquetas',s.mocks);await assert.rejects(labels.carregarPedidoEnvio(s.client,String(p.id)),e=>e.status===409)
 assert.equal((await s.db.query('select estoque from produtos')).rows[0].estoque,19)
 await sync({status:'approved',atualizado_em:'2026-11-06T10:00:00Z'});assert.equal((await s.db.query('select pagamento from pedidos')).rows[0].pagamento.requer_revisao,true)
})
test('uploads exigem item entregue e cota transacional; manutenção é de uso único',async t=>{
 const s=await setup(t);await s.db.query('insert into usuarios(email) values($1)',[email])
 const args={p_usuario:'1',p_pedido:'1',p_produto:sku}
 for(let i=0;i<3;i++)assert.equal((await s.client.rpc('hh_reservar_upload',{...args,p_caminho:'trocas/1/'+i})).error,null)
 assert.match((await s.client.rpc('hh_reservar_upload',{...args,p_caminho:'trocas/1/4'})).error.message,/Limite/)
 assert.equal((await s.client.rpc('hh_claim_migracao_fotos',{})).data,true);assert.equal((await s.client.rpc('hh_claim_migracao_fotos',{})).data,false)
 await s.db.exec("update seguranca_tarefas set estado='concluida'");assert.equal((await s.client.rpc('hh_claim_migracao_fotos',{})).data,false)
})
test('avaliações exigem compra entregue e não podem ser duplicadas',async t=>{
 const s=await setup(t);await s.db.query('insert into usuarios(email,nome) values($1,$2)',[email,'Cliente']);const p=await pedido(s)
 const args={p_usuario:'opaque',p_email:email,p_produto:sku,p_nota:5,p_comentario:'Ótima peça',p_nome:'Cliente'}
 assert.match((await s.client.rpc('hh_avaliar',args)).error.message,/compra entregue/)
 await s.db.query("update pedidos set status='entregue' where id=$1",[p.id]);assert.equal((await s.client.rpc('hh_avaliar',args)).error,null);assert.equal((await s.client.rpc('hh_avaliar',args)).error.code,'23505')
})
test('Bearer malformado e JWT antigo sem versão são recusados',async()=>{
 const jwt=require('next-auth/jwt'),get=loadTs('lib/request-user').getRequestUser
 assert.equal(await get(new Request('http://localhost',{headers:{authorization:'Bearer %invalid'}})),null)
 const old=await jwt.encode({secret:process.env.NEXTAUTH_SECRET,token:{email}})
 assert.equal(await get(new Request('http://localhost',{headers:{cookie:'next-auth.session-token='+old}})),null)
})
