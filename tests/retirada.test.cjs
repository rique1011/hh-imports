const { test }=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto')
const {loadTs,createDb,adapter}=require('./helpers.cjs')
const base='https://loja.test',sku='10000000-0000-4000-8000-000000000001'
process.env.NEXTAUTH_SECRET='fixture-retirada';process.env.SITE_URL=base;process.env.MP_ACCESS_TOKEN='fixture-only'
const endereco={cep:'89209452',logradouro:'Rua Loja',numero:'155',complemento:'',bairro:'Centro',cidade:'Joinville',uf:'SC'}
const req=(path,body,origin=base)=>new Request(base+path,{method:'POST',headers:{origin,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify(body)})
async function setup(t){
 const db=await createDb('bigint','bigint');t.after(()=>db.close());const client=adapter(db)
 await db.exec("alter table produtos add material text,add descricao text,add video_url text,add categoria_id uuid,add categoria_slug text,add criado_em timestamptz default now(),add visitas int;insert into usuarios(nome,email,role,perfil,email_verificado,senha_politica_versao,mfa_secret,saldo_cashback) values('Admin','admin@example.test','admin','admin',true,1,'fixture',0),('Cliente','cliente@example.test','cliente','cliente',true,1,null,100),('Outra','outra@example.test','cliente','cliente',true,1,null,0);update usuarios set endereco='{}' where email='cliente@example.test';update envio_automatico_config set ativa=true,limite_centavos=8000")
 await db.query("insert into produtos(id,nome,slug,preco,estoque,fotos)values($1,'Colar','colar',23,10,array['/icon.svg'])",[sku])
 await db.query('update loja_retirada set ativa=true,endereco=$1',[JSON.stringify(endereco)])
 let session=null,smtp=true,timeout=false;const pagamentos=new Map(),refunds=[],emails=[],callbacks=[]
 const mocks={
  '@/lib/supabase-admin':{getSupabaseAdmin:()=>client},'@/lib/request-user':{getRequestUser:async()=>session},
  'next/cache':{unstable_cache:f=>f,revalidateTag:()=>{}},'next/server':{...require('next/server'),after:fn=>callbacks.push(fn)},
  mercadopago:{MercadoPagoConfig:class{},Preference:class{async create(){return{id:'fixture',init_point:'https://pagamento.example.test'}}},Payment:class{async get({id}){return{...pagamentos.get(String(id))}}},PaymentRefund:class{async total({payment_id,requestOptions}){refunds.push({payment_id,key:requestOptions.idempotencyKey});const p=pagamentos.get(String(payment_id));p.status='refunded';p.transaction_amount_refunded=p.transaction_amount;p.date_last_updated=new Date().toISOString();if(timeout)throw Error('Timeout após sucesso remoto');return{id:99,status:'approved'}}}},
 }
 const enviar=async(p,event)=>{emails.push({p,event});return{sucesso:true,messageId:'fixture'}}
 mocks['@/lib/mail']={enviarEmailRetirada:async(p,event)=>{if(!smtp)return{sucesso:false,error:'SMTP simulado indisponível'};return enviar(p,event)},enviarEmailPedidoRecebido:p=>enviar(p,'novo'),enviarEmailStatus:async()=>({sucesso:true,messageId:'fixture'}),notificarAdminNovoPedido:p=>enviar(p,'novo-admin'),notificarAdminPagamentoAprovado:p=>enviar(p,'pago-admin')}
 const usuario=async(id,mfa=false)=>{const u=(await db.query('select * from usuarios where id=$1',[id])).rows[0];session={id:String(id),email:u.email,sessaoVersao:u.sessao_versao,senhaAtual:true,mfa}}
 await usuario(2)
 const checkout=loadTs('app/api/checkout/route',mocks)
 const comprar=async(extra={})=>{const r=await checkout.POST(req('/api/checkout',{itens:[{id:sku,quantidade:1}],modalidade:'retirada',aceiteRetirada:true,retiradaVersao:1,...extra}));assert.equal(r.status,200,JSON.stringify(await r.clone().json()));return String((await r.json()).pedidoId)}
 const pago=async(id)=>{const p=(await db.query('select * from pedidos where id=$1',[id])).rows[0];if(Number(p.total)>0){const payment={id:2000+Number(id),external_reference:id,currency_id:'BRL',status:'approved',transaction_amount:Number(p.total),transaction_amount_refunded:0,date_approved:new Date().toISOString(),date_last_updated:new Date().toISOString(),payment_method_id:'pix',payment_type_id:'bank_transfer'};pagamentos.set(String(payment.id),payment);await loadTs('lib/pagamentos',mocks).registrarPagamentoVerificado(client,payment)}}
 const retirada=async(id)=>(await db.query('select * from pedido_retiradas where pedido_id=$1',[id])).rows[0]
 const acao=async(id,acao,codigo='')=>client.rpc('hh_acao_retirada',{p_pedido_id:id,p_acao:acao,p_versao:(await retirada(id)).versao,p_codigo:codigo})
 const notificar=()=>loadTs('lib/notificacoes',mocks).processarNotificacoes(undefined,30)
 const processar=()=>loadTs('lib/retirada-reembolsos',mocks).processarReembolsosRetirada()
 return{db,client,mocks,usuario,checkout,comprar,pago,retirada,acao,notificar,processar,refunds,emails,callbacks,pagamentos,setSmtp:v=>smtp=v,setTimeout:v=>timeout=v}
}
test('retirada permite checkout sem endereço residencial, não cobra frete e exige condições atuais aceitas',async t=>{
 const s=await setup(t),id=await s.comprar({freteToken:'ignorado-na-retirada',cashbackUsado:3})
 const p=(await s.db.query('select * from pedidos where id=$1',[id])).rows[0]
 assert.equal(Number(p.total),20);assert.equal(p.frete_cotacao,null);assert.equal(p.resumo_compra.frete,0);assert.equal(p.entrega.modalidade,'retirada');assert.equal(p.entrega.logradouro,endereco.logradouro)
 for(const extra of [{aceiteRetirada:false},{retiradaVersao:0},{modalidade:'injetado'}])assert.equal((await s.checkout.POST(req('/api/checkout',{itens:[{id:sku,quantidade:1}],modalidade:'retirada',aceiteRetirada:true,retiradaVersao:1,...extra}))).status,extra.retiradaVersao===0?409:400)
 await s.db.exec('update loja_retirada set ativa=false')
 assert.equal((await s.checkout.POST(req('/api/checkout',{itens:[{id:sku,quantidade:1}],modalidade:'retirada',aceiteRetirada:true,retiradaVersao:1}))).status,400)
 assert.equal((await s.retirada(id)).config.prazo_dias,30)
})
test('disponibilidade só ocorre após pagamento, não gera etiqueta e prazo começa após envio confirmado do aviso',async t=>{
 const s=await setup(t),id=await s.comprar()
 assert.ok((await s.acao(id,'pronto')).error);await s.pago(id);assert.equal((await s.acao(id,'pronto')).error,null)
 assert.equal((await s.db.query('select count(*)::int n from envio_automatico_fila')).rows[0].n,0)
 assert.equal((await s.retirada(id)).prazo_final,null)
 s.setSmtp(false);await s.notificar();assert.equal((await s.retirada(id)).prazo_final,null)
 s.setSmtp(true);await s.db.exec("update pedido_notificacoes set disponivel_em=now() where status='pendente'");await s.notificar()
 const r=await s.retirada(id);assert.ok(r.avisado_em);assert.ok(Math.abs(Date.parse(r.prazo_final)-Date.now()-30*86400_000)<60000)
 const etiqueta=loadTs('lib/etiquetas',s.mocks);await assert.rejects(etiqueta.carregarPedidoEnvio(s.client,id),/retirada presencial/)
})
test('código só é mostrado ao comprador; confirmação presencial registra o recebimento real e bloqueia reembolso',async t=>{
 const s=await setup(t),id=await s.comprar();await s.pago(id);await s.acao(id,'pronto')
 const route=loadTs('app/api/pedidos/[id]/route',s.mocks),get=()=>route.GET(new Request(base+'/api/pedidos/'+id),{params:Promise.resolve({id})})
 const cliente=await(await get()).json(),r=await s.retirada(id);assert.equal(cliente.retirada.codigo,r.codigo)
 await s.usuario(3);assert.equal((await get()).status,404)
 await s.usuario(1,true)
 const admin=loadTs('app/api/admin/dados/route',s.mocks)
 const resposta=await admin.POST(req('/api/admin/dados',{tabela:'pedidos',operacao:'select',filtros:[]}));assert.equal(resposta.status,200);assert.equal(JSON.stringify(await resposta.json()).includes(r.codigo),false)
 assert.ok((await s.acao(id,'retirado','errado')).error);assert.equal((await s.acao(id,'retirado',r.codigo)).error,null)
 const p=(await s.db.query('select * from pedidos where id=$1',[id])).rows[0];assert.equal(p.status,'entregue');assert.equal(p.itens[0].recebimento_origem,'retirada');assert.ok(p.itens[0].recebimento_confirmado_em)
 assert.equal(loadTs('lib/prazo-devolucao').prazoDevolucao(p.itens[0].data_recebimento).aberto,true)
 assert.ok((await s.acao(id,'cancelar')).error);await s.processar();assert.equal(s.refunds.length,0)
})
test('vencimento exige aviso e lembrete com antecedência; reembolso confirma antes de repor estoque e devolve créditos uma única vez',async t=>{
 const s=await setup(t),id=await s.comprar({cashbackUsado:10});await s.pago(id);await s.acao(id,'pronto');await s.notificar()
 await s.db.query("update pedido_retiradas set prazo_final=now()-interval '1 day' where pedido_id=$1",[id])
 await s.processar();assert.equal((await s.retirada(id)).estado,'disponivel');assert.equal(s.refunds.length,0)
 await s.notificar();await s.processar();assert.equal(s.refunds.length,0)
 await s.db.query("update pedido_retiradas set lembrete_em=now()-interval '25 hours' where pedido_id=$1",[id])
 const resultados=await Promise.all([s.processar(),s.processar()]);assert.equal(s.refunds.length,1)
 assert.equal((await s.retirada(id)).estado,'cancelado');assert.equal((await s.db.query('select estoque from produtos')).rows[0].estoque,10)
 assert.equal(Number((await s.db.query("select saldo_cashback from usuarios where id=2")).rows[0].saldo_cashback),100)
 await s.processar();assert.equal(s.refunds.length,1)
 const p=(await s.db.query('select * from pedidos where id=$1',[id])).rows[0]
 await loadTs('lib/pagamentos',s.mocks).registrarPagamentoVerificado(s.client,{id:Number(p.mp_payment_id),external_reference:id,currency_id:'BRL',transaction_amount:13,transaction_amount_refunded:13,status:'refunded',date_last_updated:new Date().toISOString()})
 assert.equal((await s.db.query('select status from pedidos where id=$1',[id])).rows[0].status,'cancelado');assert.equal((await s.db.query('select estoque from produtos')).rows[0].estoque,10)
 assert.ok(resultados.some(r=>r.concluidos===1))
})
test('timeout após reembolso remoto não duplica devolução e permanece pendente até conciliar',async t=>{
 const s=await setup(t),id=await s.comprar();await s.pago(id);await s.acao(id,'cancelar');s.setTimeout(true)
 await s.processar();assert.equal((await s.retirada(id)).estado,'reembolso_pendente');assert.equal((await s.db.query('select estoque from produtos')).rows[0].estoque,9)
 assert.ok((await s.retirada(id)).erro);assert.equal((await s.db.query("select count(*)::int n from pedido_notificacoes where evento='retirada_atencao' and destinatario='admin'")).rows[0].n,1)
 await s.db.exec('update pedido_retiradas set proxima_tentativa=now()');s.setTimeout(false);await s.processar()
 assert.equal(s.refunds.length,1);assert.equal((await s.retirada(id)).estado,'cancelado');assert.equal((await s.db.query('select estoque from produtos')).rows[0].estoque,10)
})
test('pedido pago só com créditos cancela sem chamada financeira externa e devolve o saldo usado',async t=>{
 const s=await setup(t),id=await s.comprar({cashbackUsado:23});assert.equal((await s.db.query('select count(*)::int n from envio_automatico_fila')).rows[0].n,0)
 assert.equal((await s.acao(id,'cancelar')).error,null);await s.processar()
 assert.equal(s.refunds.length,0);assert.equal((await s.retirada(id)).estado,'cancelado');assert.equal(Number((await s.db.query('select saldo_cashback from usuarios where id=2')).rows[0].saldo_cashback),100)
})
test('admin e cancelamento do cliente exigem autorização, origem e estado; RLS mantém dados privados',async t=>{
 const s=await setup(t),id=await s.comprar();await s.pago(id)
 const route=loadTs('app/api/admin/retirada/route',s.mocks);assert.equal((await route.GET(new Request(base+'/api/admin/retirada'))).status,403)
 await s.usuario(1);assert.equal((await route.GET(new Request(base+'/api/admin/retirada'))).status,403)
 await s.usuario(1,true)
 const config={acao:'configurar',ativa:true,local:'Local de retirada',endereco,instrucoes:'Agende antes de vir.',prazo_dias:15,versao:1}
 assert.equal((await route.POST(req('/api/admin/retirada',config,'https://externa.test'))).status,403)
 const resultados=await Promise.all([route.POST(req('/api/admin/retirada',config)),route.POST(req('/api/admin/retirada',config))]);assert.deepEqual(resultados.map(r=>r.status).sort(),[200,409]);assert.equal((await s.retirada(id)).config.prazo_dias,30)
 const cancel=loadTs('app/api/pedidos/[id]/retirada/route',s.mocks),request=()=>cancel.POST(req('/api/pedidos/'+id+'/retirada',{confirmar:true,versao:1}),{params:Promise.resolve({id})})
 await s.usuario(3);assert.equal((await request()).status,404);await s.usuario(2);assert.equal((await request()).status,200)
 for(const role of ['anon','authenticated'])for(const tabela of ['loja_retirada','pedido_retiradas'])assert.equal((await s.db.query('select has_table_privilege($1,$2,\'select,insert,update,delete\') ok',[role,tabela])).rows[0].ok,false)
 for(const role of ['anon','authenticated'])for(const func of ['hh_acao_retirada(text,text,integer,text)','hh_concluir_reembolso_retirada(text,uuid)','hh_claim_retirada_reembolsos(text,integer)'])assert.equal((await s.db.query('select has_function_privilege($1,$2,\'execute\') ok',[role,func])).rows[0].ok,false)
})
test('entrega com código e cancelamento concorrentes nunca liberam produto e reembolso ao mesmo tempo',async t=>{
 const s=await setup(t),id=await s.comprar();await s.pago(id);await s.acao(id,'pronto');const r=await s.retirada(id)
 const resultados=await Promise.all(['retirado','cancelar'].map(acao=>s.client.rpc('hh_acao_retirada',{p_pedido_id:id,p_acao:acao,p_versao:r.versao,p_codigo:r.codigo})))
 assert.equal(resultados.filter(r=>!r.error).length,1)
 const estado=(await s.retirada(id)).estado;await s.processar();assert.equal(s.refunds.length,estado==='retirado'?0:1)
})
test('pagamento de outro pedido ou com valor divergente nunca recebe chamada de reembolso',async t=>{
 const s=await setup(t),id=await s.comprar();await s.pago(id);await s.acao(id,'cancelar')
 const pg=s.pagamentos.values().next().value;pg.external_reference='9999';await s.processar();assert.equal(s.refunds.length,0)
 pg.external_reference=id;pg.transaction_amount=1;await s.db.exec('update pedido_retiradas set proxima_tentativa=now()');await s.processar();assert.equal(s.refunds.length,0)
 assert.equal((await s.retirada(id)).estado,'reembolso_pendente');assert.equal((await s.db.query('select estoque from produtos')).rows[0].estoque,9)
})
test('aviso de disponibilidade atrasado não é enviado após cancelamento concluído',async t=>{
 const s=await setup(t),id=await s.comprar();await s.pago(id);await s.acao(id,'pronto');await s.acao(id,'cancelar');await s.processar();await s.notificar()
 assert.equal(s.emails.some(e=>e.event==='retirada_disponivel'||e.event==='retirada_cancelamento'||e.event==='retirada_atencao'),false)
 assert.equal(s.emails.some(e=>e.event==='retirada_reembolsada'),true)
})
