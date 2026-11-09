const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto')
const { createDb, adapter, loadTs } = require('./helpers.cjs')
const origem = 'https://fvcbdrvpvbdmmirzffgl.supabase.co'
const { APARENCIA_PADRAO, validarAparencia } = loadTs('lib/aparencia')
const sku = '13faf490-7cb6-4e4f-9106-0f0502c50424', email = 'cliente@example.test'
process.env.NEXT_PUBLIC_SUPABASE_URL = origem
process.env.NEXTAUTH_SECRET = 'fixture-aparencia-frete'
process.env.CEP_ORIGEM = '89209452'
process.env.MELHOR_ENVIO_AMBIENTE = 'production'
process.env.MELHOR_ENVIO_TOKEN = 'fixture-only'
process.env.MP_ACCESS_TOKEN = 'fixture-only'
process.env.SITE_URL = 'https://loja.test'
const request = (url, body, origin = 'https://loja.test', key = randomUUID()) => new Request('https://loja.test' + url, {
  method: 'POST', headers: { origin, 'content-type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body),
})

test('aparência é privada com RLS; migração repetida preserva a edição e restringe as vitrines', async t => {
  const db = await createDb(); t.after(() => db.close())
  await db.query('update loja_aparencia set config=$1,versao=2', [JSON.stringify(APARENCIA_PADRAO)])
  const file = fs.readdirSync(path.join(__dirname, '../supabase/migrations')).find(f => f.endsWith('_loja_aparencia_vitrines.sql'))
  await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations', file), 'utf8'))
  assert.equal((await db.query('select versao from loja_aparencia')).rows[0].versao, 2)
  assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.loja_aparencia'::regclass")).rows[0].relrowsecurity, true)
  for (const role of ['anon', 'authenticated']) assert.equal((await db.query("select has_table_privilege($1,'public.loja_aparencia','select,insert,update,delete') as ok", [role])).rows[0].ok, false)
  assert.equal((await db.query("select has_table_privilege('service_role','public.loja_aparencia','select,update') as ok")).rows[0].ok, true)
  await db.query('insert into produtos(id,nome,preco,vitrines) values($1,$2,100,$3)', [sku, 'Joia', ['masculino', 'presentes']])
  await assert.rejects(db.query('update produtos set vitrines=$1', [['colecao.injetada']]), /produtos_vitrines_validas/)
  await assert.rejects(db.query('update produtos set vitrines=$1', [[null]]), /produtos_vitrines_validas/)
})

test('aparência aceita imagens próprias e rejeita SVG, URL externa, link executável e campos privados', () => {
  const imagem = origem + '/storage/v1/object/public/joias/aparencia/1/' + randomUUID() + '.webp'
  assert.equal(validarAparencia({ ...APARENCIA_PADRAO, logoUrl: imagem }, origem).logoUrl, imagem)
  for (const logoUrl of ['javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'https://externo.test/a.webp', imagem + '?x=1', imagem.replace('.webp', '.svg'), origem + '/storage/v1/object/public/devolucoes/a.webp']) {
    assert.throws(() => validarAparencia({ ...APARENCIA_PADRAO, logoUrl }, origem))
  }
  for (const botaoLink of ['//externo.test', 'https://externo.test', '/api/admin/dados', '/%2fexterno.test']) assert.throws(() => validarAparencia({ ...APARENCIA_PADRAO, botaoLink }, origem))
  assert.throws(() => validarAparencia({ ...APARENCIA_PADRAO, atualizado_por: 'privado' }, origem))
})

test('API de aparência exige admin com MFA e sessão atual; concorrência e CSRF não sobrescrevem configuração', async t => {
  const db = await createDb('bigint','bigint'); t.after(() => db.close())
  await db.exec("insert into usuarios(email,nome,perfil,role,email_verificado,senha_politica_versao,mfa_secret) values('admin@example.test','Admin','admin','admin',true,1,'fixture'),('cliente@example.test','Cliente','cliente','cliente',true,1,null)")
  const client = adapter(db), invalidacoes = []
  let sessao = null
  const mocks = { '@/lib/supabase-admin': { getSupabaseAdmin: () => client }, '@/lib/request-user': { getRequestUser: async () => sessao },
    'next/cache': { unstable_cache: f => f, revalidateTag: (...a) => invalidacoes.push(a) } }
  const route = loadTs('app/api/admin/aparencia/route', mocks)
  const get = () => route.GET(new Request('https://loja.test/api/admin/aparencia'))
  assert.equal((await get()).status, 401)
  const user = async (id, mfa) => { const u=(await db.query('select * from usuarios where id=$1',[id])).rows[0];sessao={id:String(id),email:u.email,sessaoVersao:u.sessao_versao,senhaAtual:true,mfa} }
  await user(2, true); assert.equal((await get()).status, 403)
  await user(1, false); assert.equal((await get()).status, 403)
  await user(1, true); assert.equal((await get()).status, 200)
  const body={config:{...APARENCIA_PADRAO,titulo:'Campanha editada'},versao:1}
  assert.equal((await route.POST(request('/api/admin/aparencia', body, 'https://externo.test'))).status, 403)
  const respostas = await Promise.all([route.POST(request('/api/admin/aparencia',body)), route.POST(request('/api/admin/aparencia',body))])
  assert.deepEqual(respostas.map(r=>r.status).sort(), [200,409]); assert.equal(invalidacoes.length,1)
  const salvo=(await (await get()).json());assert.equal(salvo.config.titulo,'Campanha editada');assert.equal(salvo.versao,2)
  assert.equal(JSON.stringify(salvo).includes('admin@example.test'),false)
  assert.deepEqual(await loadTs('lib/aparencia-servidor',mocks).getAparenciaPublica(),salvo.config)
  await db.exec("update usuarios set role='cliente',perfil='cliente' where id=1")
  assert.equal((await get()).status,401)
})

test('upload de aparência é exclusivo do admin, converte em WebP e não aceita SVG', async t => {
  const db=await createDb();t.after(()=>db.close());const client=adapter(db),enviados=[]
  client.storage={from:bucket=>({upload:async(p,b,o)=>{enviados.push({bucket,p,b,o});return{error:null}},getPublicUrl:p=>({data:{publicUrl:origem+'/storage/v1/object/public/joias/'+p}})})}
  let admin=false
  const auth=loadTs('lib/autorizacao'),route=loadTs('app/api/uploads/route',{'@/lib/supabase-admin':{getSupabaseAdmin:()=>client},'@/lib/autorizacao':{...auth,exigirUsuario:async()=>({id:1,admin,db:client})}})
  const sharp=require('sharp'),image=await sharp({create:{width:20,height:10,channels:4,background:'#c5a059'}}).png().toBuffer()
  const req=(bytes=image,type='image/png')=>{const f=new FormData();f.set('tipo','aparencia');f.set('arquivo',new File([bytes],'logo.png',{type}));return new Request('https://loja.test/api/uploads',{method:'POST',headers:{origin:'https://loja.test'},body:f})}
  assert.equal((await route.POST(req())).status,403);assert.equal(enviados.length,0)
  admin=true;assert.equal((await route.POST(req())).status,200);assert.equal(enviados.length,1)
  assert.match(enviados[0].p,/^aparencia\/1\/[\da-f-]+\.webp$/);assert.equal((await sharp(enviados[0].b).metadata()).format,'webp')
  assert.equal((await route.POST(req(Buffer.from('<svg/>'),'image/svg+xml'))).status,400);assert.equal(enviados.length,1)
})

test('frete grátis inicia em R$ 100 exatos; não depende de desconto, embalagem ou total enviado pelo navegador', () => {
  const {temFreteGratis,faltaParaFreteGratis}=loadTs('lib/politica-frete')
  assert.equal(temFreteGratis(99.99),false);assert.equal(faltaParaFreteGratis(99.99),0.01)
  assert.equal(temFreteGratis(100),true);assert.equal(temFreteGratis(110),true);assert.equal(temFreteGratis(NaN),false)
})

test('cotação real → frete grátis → checkout → pagamento → NF-e → etiqueta única preserva destinatário e custo', async t => {
  const db=await createDb('bigint','bigint');t.after(()=>db.close());const client=adapter(db)
  await db.query("insert into usuarios(email,nome,saldo_cashback) values($1,'Cliente completo',20)",[email])
  await db.query("insert into produtos(id,nome,preco,estoque) values($1,'Colar',100,20)",[sku])
  await db.exec("update envio_automatico_config set ativa=true,documento_fiscal='nfe',limite_centavos=8000,servicos_gratis=array[1,2]")
  process.env.MELHOR_ENVIO_REMETENTE=JSON.stringify({nome:'Loja fixture',email:'loja@example.test',documento:'12345678901',telefone:'11999999999',cep:'89209452',logradouro:'Rua Loja',numero:'1',bairro:'Centro',cidade:'Joinville',uf:'SC'})
  const calls=[],callbacks=[],prefs=[],remoto={id:'12345678-1234-4234-8234-123456789012',status:'pending',paid_at:null,generated_at:null,tracking:null}
  let cotacoes=[{id:99,name:'Outro',price:'5',delivery_time:1},{id:2,name:'SEDEX',price:'20',delivery_time:2},{id:1,name:'PAC',price:'17.37',delivery_time:5}]
  const api=loadTs('lib/melhor-envio'),provider=async(p,b)=>{calls.push({p,b});if(p==='/shipment/calculate')return cotacoes;if(p==='/cart')return{id:remoto.id,price:'17.37'};if(p==='/shipment/checkout'){remoto.paid_at=new Date().toISOString();remoto.status='released';return{purchase:{id:'fixture'}}}if(p==='/shipment/generate'){remoto.generated_at=new Date().toISOString();return{[remoto.id]:true}}if(p.startsWith('/orders/'))return{...remoto};throw Error(p)}
  const auth=loadTs('lib/autorizacao'),mocks={'@/lib/supabase-admin':{getSupabaseAdmin:()=>client},'@/lib/melhor-envio':{...api,melhorEnvio:provider},
    '@/lib/autorizacao':{...auth,exigirUsuario:async()=>({id:1,email,nome:'Cliente completo',db:client})},
    '@/lib/notificacoes':{processarNotificacoes:async()=>({})},'next/cache':{unstable_cache:f=>f},'next/server':{...require('next/server'),after:fn=>callbacks.push(fn)},
    mercadopago:{MercadoPagoConfig:class{},Preference:class{async create({body}){prefs.push(body);return{id:'fixture',init_point:'https://pagamento.example.test'}}}}}
  mocks['@/lib/pagamentos']={...loadTs('lib/pagamentos',mocks),sincronizarPagamentoPedido:async(_db,p)=>({...p,pagamento:{status:'approved'}})}
  const freteRoute=loadTs('app/api/frete/route',mocks),checkout=loadTs('app/api/checkout/route',mocks)
  const quote=async()=>{const r=await freteRoute.POST(request('/api/frete',{cepDestino:'01310100',itens:[{id:sku,quantidade:1,preco:0.01}],subtotal:0}));return{status:r.status,...await r.json()}}
  const q=await quote();assert.equal(q.status,200);assert.equal(q.freteGratis,true);assert.equal(q.opcoes.length,1);assert.equal(q.opcoes[0].servico,1)
  const body={itens:[{id:sku,quantidade:1,preco:0.01}],freteToken:q.opcoes[0].token,cashbackUsado:20,embalagemPresente:true}
  const r=await checkout.POST(request('/api/checkout',body));assert.equal(r.status,200);const id=String((await r.json()).pedidoId)
  const pedido=(await db.query('select * from pedidos where id=$1',[id])).rows[0]
  assert.equal(Number(pedido.total),95);assert.equal(pedido.frete_cotacao.centavos,1737);assert.equal(pedido.frete_cotacao.servico,1)
  assert.equal(pedido.entrega.documento,'12345678901');assert.equal(pedido.entrega.telefone,'11999999999');assert.equal(pedido.entrega.numero,'10');assert.equal(pedido.entrega.cep,'01310100')
  assert.equal(prefs[0].items.reduce((s,i)=>s+i.unit_price*i.quantity,0),95)
  const invalido=await checkout.POST(request('/api/checkout',{...body,freteToken:'adulterado'}));assert.equal(invalido.status,400)
  const automatico=loadTs('lib/envio-automatico',mocks)
  assert.deepEqual(await automatico.processarEnvioAutomatico(id,1),{processado:false});assert.equal(calls.some(c=>c.p==='/cart'),false)
  assert.equal((await client.rpc('hh_confirmar_pagamento',{p_pedido_id:id,p_pagamento_id:'7890',p_total:95})).error,null)
  await automatico.processarEnvioAutomatico(id,1)
  assert.equal((await db.query('select estado from envio_automatico_fila')).rows[0].estado,'aguardando_documento');assert.equal(calls.some(c=>c.p==='/cart'),false)
  assert.equal((await client.rpc('hh_retomar_envio_automatico',{p_pedido_id:id,p_nota_fiscal:'1'.repeat(44)})).error,null)
  await automatico.processarEnvioAutomatico(id,1)
  remoto.tracking='AA123456789BR';await db.exec('update envio_automatico_fila set proxima_tentativa=now()');await automatico.processarEnvioAutomatico(id,1)
  await db.exec('update envio_automatico_fila set proxima_tentativa=now()');await automatico.processarEnvioAutomatico(id,1)
  for(const p of ['/cart','/shipment/checkout','/shipment/generate'])assert.equal(calls.filter(c=>c.p===p).length,1)
  const cart=calls.find(c=>c.p==='/cart').b;assert.equal(cart.to.name,'Cliente completo');assert.equal(cart.to.document,'12345678901');assert.equal(cart.to.number,'10');assert.equal(cart.options.invoice.key,'1'.repeat(44))
  assert.equal((await db.query('select estado from envio_automatico_fila')).rows[0].estado,'concluida')
  assert.equal((await db.query('select codigo_rastreio from pedidos')).rows[0].codigo_rastreio,remoto.tracking)
  await db.exec('update produtos set preco=99.99');const pago=await quote();assert.equal(pago.freteGratis,false);assert.equal(pago.opcoes.length,3)
  await db.exec('update produtos set preco=100');cotacoes=[{id:99,name:'Outro',price:'5',delivery_time:1}];assert.equal((await quote()).status,422)
})
