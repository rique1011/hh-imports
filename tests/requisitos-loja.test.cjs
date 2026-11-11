const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto')
const { loadTs, adapter, createDb } = require('./helpers.cjs')
const { FILTROS_INICIAIS, filtrarCatalogo, grupoMaterial } = loadTs('lib/filtros-catalogo')
const { snapshotDevolucao } = loadTs('lib/devolucoes')
const sku = 'e11f2fa1-5b4d-40ab-974d-8e6b993d35dc', outro = 'b11f2fa1-5b4d-40ab-974d-8e6b993d35dc'
process.env.NEXTAUTH_SECRET='fixture-requisitos';process.env.SITE_URL='https://loja.test';process.env.MELHOR_ENVIO_AMBIENTE='production';process.env.MELHOR_ENVIO_TOKEN='fixture-only';process.env.CEP_ORIGEM='89209452'
process.env.MELHOR_ENVIO_REMETENTE=JSON.stringify({nome:'Loja',documento:'12345678901',telefone:'47999999999',logradouro:'Rua Loja',numero:'1',bairro:'Centro',cidade:'Joinville',uf:'SC'})
const entrega={nome:'Cliente',email:'cliente@example.test',documento:'98765432100',telefone:'11999999999',logradouro:'Rua Cliente',numero:'2',bairro:'Centro',cidade:'São Paulo',uf:'SP',cep:'01310100'}
const req=(url,body,origin='https://loja.test')=>new Request('https://loja.test'+url,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)})
async function setup(t) {
 const db=await createDb('bigint','bigint');t.after(()=>db.close());const client=adapter(db)
 await db.exec("insert into usuarios(nome,email,perfil,role,email_verificado,senha_politica_versao,mfa_secret) values('Admin','admin@example.test','admin','admin',true,1,'fixture'),('Cliente','cliente@example.test','cliente','cliente',true,1,null),('Outra pessoa','outra@example.test','cliente','cliente',true,1,null)")
 const item={id:sku,nome:'Colar folheado',preco:100,quantidade:1,foto:'/icon.svg',data_recebimento:loadTs('lib/prazo-devolucao').diaNaLoja()}
 await db.query('insert into produtos(id,nome,preco)values($1,$2,100)',[sku,item.nome])
 const pedido=(await db.query("insert into pedidos(cliente_email,cliente_nome,status,total,itens,entrega,resumo_compra)values('cliente@example.test','Cliente','entregue',100,$1,$2,$3) returning id",[JSON.stringify([item]),JSON.stringify(entrega),JSON.stringify({subtotal:100,total:100})])).rows[0]
 let session={id:'2',email:entrega.email,sessaoVersao:1,senhaAtual:true,mfa:false}
 const mocks={'@/lib/supabase-admin':{getSupabaseAdmin:()=>client},'@/lib/request-user':{getRequestUser:async()=>session},'next/server':{...require('next/server'),after:()=>{}},'next/cache':{unstable_cache:f=>f,revalidateTag:()=>{}}}
 const usuario=async(id,mfa=false)=>{const u=(await db.query('select * from usuarios where id=$1',[id])).rows[0];session={id:String(id),email:u.email,sessaoVersao:u.sessao_versao,senhaAtual:true,mfa}}
 const route=loadTs('app/api/trocas/route',mocks)
 const criar=async(extras={})=>{const r=await route.POST(req('/api/trocas',{pedidoId:pedido.id,produtoId:sku,motivo:'arrependimento',...extras}));assert.equal(r.status,200,JSON.stringify(await r.clone().json()));return(await db.query('select * from trocas order by criado_em desc')).rows[0]}
 return{db,client,item,pedido,mocks,route,criar,usuario,setSession:s=>{session=s}}
}
test('filtros combinam categoria personalizada, composição, preço e estoque real sem alterar a lista original',()=>{
 const cats=[{id:'cat',slug:'tornozeleiras',nome:'Tornozeleiras'}]
 const produtos=[{id:'1',nome:'Tornozeleira Coração',preco:40,material:'Folheado a ouro',estoque:3,estoque_reservado:2,categoria_slug:'tornozeleiras'},{id:'2',nome:'Anel Prata',preco:50,material:'Prata 925',estoque:1,estoque_reservado:1,categoria_slug:'aneis'},{id:'3',nome:'Brinco',preco:20,material:'Bijuteria',estoque:10}]
 assert.equal(grupoMaterial('Banhado a Ouro'),'Joias folheadas')
 assert.deepEqual(filtrarCatalogo(produtos,{...FILTROS_INICIAIS,busca:'coracao',categoria:'tornozeleiras',material:'Joias folheadas',precoMin:'30',precoMax:'45',disponivel:true},cats).map(p=>p.id),['1'])
 assert.deepEqual(filtrarCatalogo(produtos,{...FILTROS_INICIAIS,disponivel:true,ordem:'menor-preco'}).map(p=>p.id),['3','1'])
 assert.equal(filtrarCatalogo(produtos,{...FILTROS_INICIAIS,precoMin:'100',precoMax:'10'}).length,0)
 assert.deepEqual(produtos.map(p=>p.id),['1','2','3'])
})
test('devolução usa o snapshot da compra e rateia descontos e custos sem inventar preço de pedido antigo',()=>{
 const p={itens:[{id:sku,nome:'A',preco:100,quantidade:1},{id:outro,nome:'B',preco:50,quantidade:1}],total:160,cashback_debitado:10,resumo_compra:{subtotal:150,total:160}}
 assert.equal(snapshotDevolucao(p,sku).valor_restituicao,113.33)
 assert.equal(snapshotDevolucao(p,outro).valor_restituicao,56.67)
 assert.equal(snapshotDevolucao({...p,resumo_compra:null},sku).valor_restituicao,null)
 assert.equal(snapshotDevolucao(p,'inexistente'),null)
})
test('admin cria, renomeia e oculta categorias com MFA, CSRF e controle de concorrência',async t=>{
 const s=await setup(t),route=loadTs('app/api/admin/categorias/route',s.mocks)
 s.setSession(null);assert.equal((await route.GET(new Request('https://loja.test/api/admin/categorias'))).status,401)
 await s.usuario(2);assert.equal((await route.GET(new Request('https://loja.test/api/admin/categorias'))).status,403)
 await s.usuario(1);assert.equal((await route.GET(new Request('https://loja.test/api/admin/categorias'))).status,403)
 await s.usuario(1,true)
 const body={nome:'Tornozeleiras',ativo:true,ordem:7}
 assert.equal((await route.POST(req('/api/admin/categorias',body,'https://externa.test'))).status,403)
 const criada=await route.POST(req('/api/admin/categorias',body));assert.equal(criada.status,200);const c=(await criada.json()).categoria
 assert.equal(c.slug,'tornozeleiras')
 const editar={id:c.id,versao:c.versao,nome:'Tornozeleiras especiais',ativo:false,ordem:2}
 const respostas=await Promise.all([route.POST(req('/api/admin/categorias',editar)),route.POST(req('/api/admin/categorias',editar))])
 assert.deepEqual(respostas.map(r=>r.status).sort(),[200,409]);assert.equal((await s.db.query('select slug,ativo from categorias where id=$1',[c.id])).rows[0].slug,'tornozeleiras')
 for(const role of ['anon','authenticated'])assert.equal((await s.db.query("select has_table_privilege($1,'public.categorias','insert,update,delete') ok",[role])).rows[0].ok,false)
 const file=fs.readdirSync(path.join(__dirname,'../supabase/migrations')).find(f=>f.endsWith('_categorias_editaveis.sql'));await s.db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8'))
 assert.equal((await s.db.query('select ativo from categorias where id=$1',[c.id])).rows[0].ativo,false)
})
test('solicitação guarda dados reais, aceita promoção no prazo e rejeita crédito imposto e acesso a outra conta',async t=>{
 const s=await setup(t)
 assert.equal((await s.route.POST(req('/api/trocas',{pedidoId:s.pedido.id,produtoId:sku,motivo:'arrependimento',resolucao:'credito'}))).status,400)
 const troca=await s.criar({precoProduto:9999,descricao:'Quero devolver.',resolucao:'credito',creditoAceito:true})
 assert.equal(troca.produto_snapshot.preco,100);assert.equal(troca.produto_snapshot.valor_restituicao,100);assert.ok(troca.credito_aceito_em)
 assert.equal((await s.route.POST(req('/api/trocas',{pedidoId:s.pedido.id,produtoId:sku,motivo:'arrependimento'}))).status,409)
 assert.equal((await(await s.route.GET(new Request('https://loja.test/api/trocas'))).json()).solicitacoes.length,1)
 await s.usuario(3);assert.equal((await(await s.route.GET(new Request('https://loja.test/api/trocas'))).json()).solicitacoes.length,0)
 assert.equal((await s.route.POST(req('/api/trocas',{pedidoId:s.pedido.id,produtoId:sku,motivo:'arrependimento'}))).status,404)
 const fila=(await s.db.query('select destinatario from troca_notificacoes')).rows;assert.equal(fila.length,2)
 for(const role of ['anon','authenticated']) {
  for(const tabela of ['trocas','troca_notificacoes'])assert.equal((await s.db.query('select has_table_privilege($1,$2,\'select,insert,update,delete\') ok',[role,'public.'+tabela])).rows[0].ok,false)
  assert.equal((await s.db.query("select has_function_privilege($1,'public.hh_creditar_devolucao(uuid,numeric,text)','execute') ok",[role])).rows[0].ok,false)
 }
})
test('crédito exige opção expressa e recebimento; concorrência não duplica saldo e cashback promocional é ajustado',async t=>{
 const s=await setup(t),troca=await s.criar({resolucao:'credito',creditoAceito:true})
 const creditar=valor=>s.client.rpc('hh_creditar_devolucao',{p_troca_id:troca.id,p_valor:valor,p_observacao:'Devolução conferida na loja.'})
 assert.ok((await creditar(100)).error)
 await s.db.query("update trocas set status='recebido',recebido_em=now(),versao=versao+1 where id=$1",[troca.id])
 assert.ok((await creditar(101)).error)
 await s.db.exec("update usuarios set saldo_cashback=5 where email='cliente@example.test';update pedidos set cashback_creditado_em=now()")
 const resultados=await Promise.all([creditar(100),creditar(100)]);for(const r of resultados)assert.equal(r.error,null)
 assert.equal(Number((await s.db.query("select saldo_cashback from usuarios where email='cliente@example.test'")).rows[0].saldo_cashback),100)
 assert.equal(Number((await s.db.query('select devolvido_credito from pedidos')).rows[0].devolvido_credito),100)
 assert.equal((await s.db.query('select status from trocas')).rows[0].status,'concluido')
})
test('central de trocas grava código e recebimento reais, exige justificativa e fecha escritas pelo proxy antigo',async t=>{
 const s=await setup(t),troca=await s.criar(),route=loadTs('app/api/admin/devolucoes/route',s.mocks)
 await s.usuario(1,true)
 const agir=(acao,versao,extras={})=>route.POST(req('/api/admin/devolucoes',{trocaId:troca.id,acao,versao,...extras}))
 assert.equal((await agir('codigo-manual',1,{codigo:'123456789',codigoConfirmado:true})).status,409)
 assert.equal((await agir('aprovar',1)).status,200)
 assert.equal((await agir('recusar',1,{observacao:'Pedido duplicado.'})).status,409)
 assert.equal((await agir('codigo-manual',2,{codigo:'123456789',codigoConfirmado:true})).status,200)
 assert.equal((await s.db.query('select codigo_postagem from trocas')).rows[0].codigo_postagem,'123456789')
 assert.equal((await agir('receber',3)).status,400)
 assert.equal((await agir('receber',3,{confirmarRecebimento:true})).status,200)
 assert.equal((await agir('creditar',4,{valor:100})).status,409)
 const proxy=loadTs('app/api/admin/dados/route',s.mocks)
 assert.equal((await proxy.POST(req('/api/admin/dados',{tabela:'trocas',operacao:'update',valores:{status:'concluido'},filtros:[{campo:'id',op:'eq',valor:troca.id}]}))).status,403)
})
test('reversa usa rota específica dos Correios, não confunde rastreio com código e retoma sem nova compra',async t=>{
 const s=await setup(t),troca=await s.criar(),calls=[],meId=randomUUID();let pago=false,gerado=false
 await s.db.query("update trocas set status='aprovado',versao=2 where id=$1",[troca.id])
 const melhor=async(route,body)=>{calls.push({route,body});if(route==='/shipment/calculate')return[{id:1,name:'PAC',price:'12.50'}];if(route==='/cart/reverse')return{id:meId,price:'12.50'};if(route==='/shipment/checkout'){pago=true;return{}};if(route==='/shipment/generate'){gerado=true;return{}};if(route==='/orders/'+meId)return{id:meId,status:pago?'released':'pending',paid_at:pago?'agora':null,generated_at:gerado?'agora':null,tracking:'RASTREIO-NAO-E-CODIGO',...(gerado?{authorization_code:'123456789'}:{})};throw Error(route)}
 const reversa=loadTs('lib/reversa',{...s.mocks,'@/lib/melhor-envio':{...loadTs('lib/melhor-envio'),melhorEnvio:melhor}})
 const opcoes=await reversa.cotarReversa(s.client,troca.id)
 assert.equal((await reversa.gerarReversa(s.client,troca.id,{freteToken:opcoes[0].token,confirmarDados:true})).estado,'gerando')
 const final=await reversa.gerarReversa(s.client,troca.id);assert.equal(final.codigo,'123456789');assert.equal(final.estado,'pronta')
 await reversa.gerarReversa(s.client,troca.id)
 assert.equal(calls.filter(c=>c.route==='/cart/reverse').length,1);assert.equal(calls.filter(c=>c.route==='/shipment/checkout').length,1)
 const payload=calls.find(c=>c.route==='/cart/reverse').body;assert.equal(payload.products[0].unitary_value,100);assert.equal(payload.from.postal_code,'01310100');assert.equal(payload.to.postal_code,'89209452');assert.equal(payload.service,1)
 assert.equal((await s.db.query('select codigo_postagem,status from trocas')).rows[0].status,'aguardando_retorno')
})
test('custo maior ou inserção incerta nunca dispara checkout ou cria uma segunda reversa',async t=>{
 const s=await setup(t),troca=await s.criar();let carts=0,compras=0,incerta=false
 await s.db.query("update trocas set status='aprovado' where id=$1",[troca.id])
 const m=loadTs('lib/melhor-envio'),reversa=loadTs('lib/reversa',{...s.mocks,'@/lib/melhor-envio':{...m,melhorEnvio:async(route)=>{if(route==='/shipment/calculate')return[{id:1,name:'PAC',price:'10'}];if(route==='/cart/reverse'){carts++;if(incerta)throw new m.ErroMelhorEnvio(0,'/cart/reverse');return{id:randomUUID(),price:'11'}};if(route==='/shipment/checkout')compras++}}})
 let token=(await reversa.cotarReversa(s.client,troca.id))[0].token
 assert.equal((await reversa.gerarReversa(s.client,troca.id,{freteToken:token,confirmarDados:true})).estado,'bloqueada');assert.equal(compras,0)
 await s.db.query("update trocas set reversa='{}' where id=$1",[troca.id]);incerta=true;token=(await reversa.cotarReversa(s.client,troca.id))[0].token
 await assert.rejects(reversa.gerarReversa(s.client,troca.id,{freteToken:token,confirmarDados:true}))
 assert.equal((await reversa.gerarReversa(s.client,troca.id)).estado,'insercao_incerta');assert.equal(carts,2);assert.equal(compras,0)
})
test('falha SMTP deixa atualização persistida para retry e nunca usa destinatário informado no navegador',async t=>{
 const s=await setup(t);await s.criar();const enviados=[];let sucesso=false
 const worker=loadTs('lib/troca-notificacoes',{...s.mocks,'@/lib/mail':{...loadTs('lib/mail'),enviarEmailLoja:async(to,subject,content)=>{enviados.push({to,subject,content});return{sucesso,messageId:'fixture'}}}})
 await worker.processarNotificacoesTrocas();assert.equal((await s.db.query("select count(*)::int n from troca_notificacoes where status='pendente'")).rows[0].n,2)
 await s.db.exec("update troca_notificacoes set disponivel_em=now()");sucesso=true;await worker.processarNotificacoesTrocas()
 assert.equal((await s.db.query("select count(*)::int n from troca_notificacoes where status='enviada'")).rows[0].n,2)
 assert.ok(enviados.some(e=>e.to===entrega.email));assert.ok(enviados.every(e=>e.content.includes('Colar folheado')))
 const antes=enviados.length;await worker.processarNotificacoesTrocas();assert.equal(enviados.length,antes)
})
test('reembolso só é concluído depois da confirmação financeira e não usa o mesmo valor duas vezes',async t=>{
 const s=await setup(t),troca=await s.criar()
 await s.db.query("update trocas set status='recebido',recebido_em=now(),versao=2 where id=$1",[troca.id])
 const registrar=valor=>s.client.rpc('hh_registrar_reembolso_devolucao',{p_troca_id:troca.id,p_valor:valor,p_referencia:'refund-fixture'})
 assert.ok((await registrar(100)).error)
 await s.db.exec(`update pedidos set pagamento='{"status":"refunded","valor_reembolsado":100}'`)
 assert.equal((await registrar(100)).error,null)
 assert.equal((await registrar(100)).error,null)
 assert.equal(Number((await s.db.query('select sum(reembolso_valor) total from trocas')).rows[0].total),100)
})
test('compras simultâneas de reversa usam uma única inserção e uma única compra',async t=>{
 const s=await setup(t),troca=await s.criar(),meId=randomUUID();let carts=0,checkout=0,pago=false
 await s.db.query("update trocas set status='aprovado' where id=$1",[troca.id])
 const m=loadTs('lib/melhor-envio'),reversa=loadTs('lib/reversa',{...s.mocks,'@/lib/melhor-envio':{...m,melhorEnvio:async(route)=>{
  if(route==='/shipment/calculate')return[{id:1,name:'PAC',price:'10'}]
  if(route==='/cart/reverse'){carts++;await new Promise(r=>setTimeout(r,25));return{id:meId,price:'10'}}
  if(route==='/orders/'+meId)return{id:meId,status:pago?'released':'pending',paid_at:pago?'agora':null}
  if(route==='/shipment/checkout'){checkout++;pago=true;return{}}
  if(route==='/shipment/generate')return{}
 }}})
 const freteToken=(await reversa.cotarReversa(s.client,troca.id))[0].token
 const respostas=await Promise.allSettled([reversa.gerarReversa(s.client,troca.id,{freteToken,confirmarDados:true}),reversa.gerarReversa(s.client,troca.id,{freteToken,confirmarDados:true})])
 assert.equal(respostas.filter(r=>r.status==='fulfilled').length,1);assert.equal(carts,1);assert.equal(checkout,1)
})
