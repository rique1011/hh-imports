const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const { createDb, loadTs, adapter } = require('./helpers.cjs')
const { prazoPagamento, pedidoNaoConcluido, nomePagamento } = loadTs('lib/pagamento-pedido')
const email = 'cliente@example.test', sku = 'e11f2fa1-5b4d-40ab-974d-8e6b993d35dc'
const endereco = { cep: '01310100', logradouro: 'Rua Casa', numero: '10', complemento: '', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP' }
const outroEndereco = { ...endereco, cep: '89209452', logradouro: 'Rua Trabalho', numero: '20', cidade: 'Joinville', uf: 'SC' }
process.env.MP_ACCESS_TOKEN = 'fixture_only'; process.env.SITE_URL = 'https://loja.example.test'; process.env.NEXTAUTH_SECRET = 'fixture_only_secret'
async function setup(t) {
  const db = await createDb('bigint', 'bigint'); t.after(() => db.close())
  await db.exec("insert into usuarios(email,nome,saldo_cashback) values('cliente@example.test','Cliente',50),('outra@example.test','Outra',0)")
  await db.query('insert into produtos(id,nome,preco,estoque) values($1,\'Colar\',100,10)', [sku])
  const client = adapter(db), auth = loadTs('lib/autorizacao')
  let owner = { email, id: 1, db: client }, payment, search = [], created = [], prefs = {}, gets = 0
  const callbacks = []
  const mocks = {
    '@/lib/supabase-admin': { getSupabaseAdmin: () => client },
    '@/lib/request-user': { getRequestUser: async () => ({ email: owner.email, name: 'Cliente' }) },
    '@/lib/autorizacao': { ...auth, exigirUsuario: async () => { if (!owner) throw new auth.ErroHttp(401,'Login'); return owner } },
    '@/lib/notificacoes': { processarNotificacoes: async () => ({}) },
    '@/lib/envio-automatico': { processarEnvioAutomatico: async () => { throw Error('Não comprar etiquetas neste teste') } },
    'next/server': { ...require('next/server'), after: fn => callbacks.push(fn) },
    mercadopago: { MercadoPagoConfig: class {}, Payment: class { async get() { gets++; return payment } async search() { return { results: search } } },
      Preference: class { async get({preferenceId}) { return prefs[preferenceId] } async create({body}) { created.push(body); const id='pref-'+created.length; return prefs[id]={...body,id,init_point:'https://pagar.example.test/'+id} } } },
  }
  const addressRoute = loadTs('app/api/usuario/enderecos/route', mocks), payments = loadTs('lib/pagamentos', mocks)
  const read = async id => JSON.parse(JSON.stringify((await db.query('select * from pedidos where id=$1',[id])).rows[0]))
  const create = async (cashback=0,total=100) => {
    const r=await client.rpc('hh_criar_pedido_com_envio',{p_email:email,p_nome:'Cliente',p_total:total,p_itens:[{id:sku,nome:'Colar',preco:100,quantidade:1}],p_cashback:cashback,p_entrega:{...endereco,documento:'12345678901',telefone:'11999999999',email},p_frete:null});assert.equal(r.error,null);return r.data
  }
  const request = (url,body,origin='https://loja.example.test') => new Request('https://loja.example.test'+url,{method:'POST',headers:{origin,'content-type':'application/json','Idempotency-Key':require('node:crypto').randomUUID()},body:JSON.stringify(body)})
  const address = body => addressRoute.POST(request('/api/usuario/enderecos',body))
  return {db,client,mocks,payments,read,create,request,address,addressRoute,created,prefs,setOwner:x=>owner=x,setPayment:x=>payment=x,setSearch:x=>search=x,getGets:()=>gets}
}

test('janela de 24h é fixa, filtra não concluídos sem apagar histórico e nunca arquiva compra paga', () => {
 const p={created_at:'2026-11-06T12:00:00Z',status:'pendente'}
 assert.equal(prazoPagamento(p),'2026-11-07T12:00:00.000Z')
 assert.equal(pedidoNaoConcluido(p,Date.parse('2026-11-07T11:59:59Z')),false)
 assert.equal(pedidoNaoConcluido(p,Date.parse('2026-11-07T12:00:00Z')),true)
 assert.equal(pedidoNaoConcluido({...p,status:'confirmado'},Date.parse('2030-01-01')),false)
 assert.equal(prazoPagamento({...p,created_at:'inválida'}),'')
})
test('rótulos mostram Pix, cartão, parcelas, boleto e distinguem método ainda não escolhido', () => {
 for(const [pagamento,nome] of [[{metodo:'pix'},'Pix'],[{tipo:'credit_card',parcelas:3},'Cartão de crédito · 3x'],[{tipo:'debit_card'},'Cartão de débito'],[{tipo:'ticket'},'Boleto bancário'],[{metodo:'cashback'},'Créditos da loja']]) assert.equal(nomePagamento({status:'confirmado',pagamento}),nome)
 assert.equal(nomePagamento({status:'pendente'}),'A escolher no Mercado Pago')
 assert.equal(nomePagamento({status:'confirmado'}),'Meio de pagamento não registrado')
})
test('migração importa endereço legado com ID bigint e bloqueia tabela/funções para público', async t => {
 const s=await setup(t)
 const file=fs.readdirSync(path.join(__dirname,'../supabase/migrations')).find(f=>f.endsWith('_conta_enderecos_pagamentos.sql'))
 await s.db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8'))
 const rows=(await s.db.query('select * from usuario_enderecos order by usuario_id')).rows
 assert.equal(rows.length,2);assert.equal(rows[0].usuario_id,1);assert.equal(rows[0].padrao,true)
 for(const role of ['anon','authenticated']) {
   assert.equal((await s.db.query("select has_table_privilege($1,'public.usuario_enderecos','select,insert,update,delete') as ok",[role])).rows[0].ok,false)
   assert.equal((await s.db.query("select has_function_privilege($1,'public.hh_sincronizar_pagamento(text,text,numeric,jsonb)','execute') as ok",[role])).rows[0].ok,false)
 }
 assert.equal((await s.db.query("select relrowsecurity from pg_class where oid='public.usuario_enderecos'::regclass")).rows[0].relrowsecurity,true)
})
test('endereços: vários cadastros, edição, padrão único, remoção e isolamento do dono', async t => {
 const s=await setup(t)
 let lista
 for(const [apelido,dados] of [['Casa',endereco],['Trabalho',outroEndereco],['Presente',{...endereco,numero:'30'}]]) {
  const r=await s.address({acao:'salvar',apelido,dados});assert.equal(r.status,200);lista=await r.json()
 }
 assert.equal(lista.length,3);assert.equal(lista.filter(e=>e.padrao).length,1)
 const trabalho=lista.find(e=>e.apelido==='Trabalho'),casa=lista.find(e=>e.apelido==='Casa')
 assert.equal((await s.address({acao:'padrao',id:trabalho.id})).status,200)
 assert.equal(JSON.parse((await s.db.query('select endereco from usuarios where id=1')).rows[0].endereco).cep,outroEndereco.cep)
 assert.equal((await s.address({acao:'salvar',id:casa.id,apelido:'Casa nova',dados:{...endereco,numero:'15'}})).status,200)
 s.setOwner({email:'outra@example.test',id:2,db:s.client})
 assert.equal((await s.address({acao:'excluir',id:trabalho.id})).status,404)
 assert.equal((await s.address({acao:'salvar',id:casa.id,apelido:'Roubo',dados:outroEndereco})).status,404)
 s.setOwner({email,id:1,db:s.client})
 lista=await(await s.address({acao:'excluir',id:trabalho.id})).json();assert.equal(lista.length,2);assert.equal(lista.filter(e=>e.padrao).length,1)
 const r=await s.addressRoute.POST(s.request('/api/usuario/enderecos',{acao:'padrao',id:casa.id},'https://invasor.test'));assert.equal(r.status,403)
 assert.equal((await s.address({acao:'salvar',apelido:'Inválido',dados:{...endereco,uf:'ZZ'}})).status,400)
})
test('preferência usa prazo original e retorno ao pedido; pagar novamente reutiliza link sem renovar prazo', async t => {
 const s=await setup(t),p=await s.create()
 const link=await s.payments.criarPreferenciaPedido(s.client,p,email,true)
 const pref=s.created[0];assert.equal(pref.expires,true);assert.equal(Date.parse(pref.expiration_date_to)-Date.parse(p.created_at),24*3600_000)
 assert.equal(pref.back_urls.success,'https://loja.example.test/sucesso?pedido='+p.id);assert.equal(pref.back_urls.pending,pref.back_urls.success)
 assert.equal(await s.payments.criarPreferenciaPedido(s.client,await s.read(p.id),email),link);assert.equal(s.created.length,1)
 await s.db.query("update pedidos set pagamento_expira_em=now()-interval '1 second' where id=$1",[p.id])
 await assert.rejects(s.payments.criarPreferenciaPedido(s.client,await s.read(p.id),email),/24 horas/)
})
test('Pix pendente persiste método; aprovação após 24h vale e replay não duplica estoque, créditos ou e-mails', async t => {
 const s=await setup(t),p=await s.create(10,90),id=String(p.id)
 const payment={id:123,external_reference:id,currency_id:'BRL',transaction_amount:90,status:'pending',payment_method_id:'pix',payment_type_id:'bank_transfer',date_last_updated:'2026-11-06T12:00:00Z'}
 await s.payments.registrarPagamentoVerificado(s.client,payment,'123')
 await s.db.query("update pedidos set pagamento_expira_em=now()-interval '1 day' where id=$1",[p.id])
 assert.equal((await s.read(p.id)).pagamento.metodo,'pix')
 const approved={...payment,status:'approved',date_last_updated:'2026-11-07T13:00:00Z',date_approved:'2026-11-07T13:00:00Z'}
 await s.payments.registrarPagamentoVerificado(s.client,approved,'123');await s.payments.registrarPagamentoVerificado(s.client,approved,'123')
 assert.equal((await s.read(p.id)).status,'confirmado')
 assert.deepEqual((await s.db.query('select estoque,estoque_reservado from produtos')).rows[0],{estoque:9,estoque_reservado:0})
 assert.equal(Number((await s.db.query('select saldo_cashback from usuarios where id=1')).rows[0].saldo_cashback),44.5)
 assert.equal((await s.db.query("select count(*)::int n from pedido_notificacoes where evento='pagamento_aprovado'")).rows[0].n,2)
 await s.payments.registrarPagamentoVerificado(s.client,payment,'123');assert.equal((await s.read(p.id)).pagamento.status,'approved')
})
test('consulta privada não aceita status da URL/corpo, ID de outro pedido ou valor divergente; não expõe dados de cartão', async t => {
 const s=await setup(t),p=await s.create(),route=loadTs('app/api/pedidos/[id]/pagamento/route',s.mocks)
 const api=body=>route.POST(s.request('/api/pedidos/'+p.id+'/pagamento',body),{params:Promise.resolve({id:String(p.id)})})
 s.setPayment({id:123,external_reference:'outro',currency_id:'BRL',transaction_amount:100,status:'approved'})
 assert.equal((await api({paymentId:'123',status:'approved'})).status,404);assert.equal((await s.read(p.id)).status,'pendente')
 const base={id:123,external_reference:String(p.id),currency_id:'BRL',transaction_amount:100,status:'approved',payment_method_id:'visa',payment_type_id:'credit_card',installments:3,date_approved:new Date().toISOString(),card:{first_six_digits:'444444',last_four_digits:'9999',security_code:'123'}}
 s.setPayment({...base,transaction_amount:1});assert.equal((await api({paymentId:'123'})).status,503)
 s.setPayment(base);const r=await api({paymentId:'123'}),dto=await r.json();assert.equal(r.status,200);assert.equal(dto.pagamento.tipo,'credit_card');assert.equal(dto.pagamento.parcelas,3)
 const json=JSON.stringify(dto);for(const secret of ['first_six_digits','last_four_digits','security_code','documento','telefone','preferencia_id'])assert.equal(json.includes(secret),false)
 s.setOwner({email:'outra@example.test',id:2,db:s.client});const gets=s.getGets();assert.equal((await api({paymentId:'123'})).status,404);assert.equal(s.getGets(),gets)
})
test('expiração só libera reserva quando provedor confirma ausência de tentativas e preferência vencida', async t => {
 const s=await setup(t),p=await s.create(10,90);await s.payments.criarPreferenciaPedido(s.client,p,email,true)
 await s.db.query("update pedidos set pagamento_expira_em=now()-interval '1 hour' where id=$1",[p.id])
 s.prefs['pref-1'].expiration_date_to=new Date(Date.now()-3600_000).toISOString();s.setSearch([])
 const resultado=await s.payments.sincronizarPagamentoPedido(s.client,await s.read(p.id));assert.equal(resultado.status,'cancelado');assert.ok(resultado.pagamento.expirado_em)
 assert.deepEqual((await s.db.query('select estoque,estoque_reservado from produtos')).rows[0],{estoque:10,estoque_reservado:0})
 assert.equal(Number((await s.db.query('select saldo_cashback from usuarios where id=1')).rows[0].saldo_cashback),50)
 const approved={id:999,external_reference:String(p.id),currency_id:'BRL',transaction_amount:90,status:'approved',payment_method_id:'pix',date_last_updated:new Date().toISOString()}
 await s.payments.registrarPagamentoVerificado(s.client,approved,'999')
 assert.equal((await s.read(p.id)).status,'pagamento_em_analise')
 assert.equal((await s.db.query('select count(*)::int n from envio_automatico_fila')).rows[0].n,0)
 const avisos=(await s.db.query("select destinatario from pedido_notificacoes where evento='pagamento_aprovado'")).rows;assert.deepEqual(avisos,[{destinatario:'admin'}])
})
test('boleto/Pix em processamento e preferências antigas não são cancelados pelo relógio', async t => {
 const s=await setup(t),p=await s.create();await s.payments.criarPreferenciaPedido(s.client,p,email,true)
 await s.db.query("update pedidos set pagamento_expira_em=now()-interval '1 hour' where id=$1",[p.id])
 s.prefs['pref-1'].expiration_date_to=new Date(Date.now()-3600_000).toISOString()
 const payment={id:123,external_reference:String(p.id),currency_id:'BRL',transaction_amount:100,status:'pending',payment_method_id:'bolbradesco',payment_type_id:'ticket',date_last_updated:new Date().toISOString()}
 s.setSearch([payment]);s.setPayment(payment)
 assert.equal((await s.payments.sincronizarPagamentoPedido(s.client,await s.read(p.id))).status,'pendente')
 assert.equal(nomePagamento(await s.read(p.id)),'Boleto bancário')
 const legado=await s.create();await s.db.query("update pedidos set pagamento_expira_em=now()-interval '1 hour' where id=$1",[legado.id]);s.setSearch([])
 assert.equal((await s.payments.sincronizarPagamentoPedido(s.client,await s.read(legado.id))).status,'pendente')
})
test('frete e snapshot usam endereço selecionado; trocar o padrão não muda pedido antigo', async t => {
 const s=await setup(t),checkout=loadTs('app/api/checkout/route',s.mocks)
 await s.db.exec('update produtos set preco=23')
 const casa=await(await s.address({acao:'salvar',apelido:'Casa',dados:endereco})).json()
 const lista=await(await s.address({acao:'salvar',apelido:'Trabalho',dados:outroEndereco})).json(),trabalho=lista.find(e=>e.apelido==='Trabalho')
 const frete=loadTs('lib/frete'),itens=[{id:sku,quantidade:1,preco:23}]
 const quote=cep=>frete.assinarCotacao(cep,20,{servico:1,transportadora:'Correios',nome:'PAC',prazo:5,origem:(process.env.CEP_ORIGEM || '').replace(/\D/g,''),ambiente:'production',itensHash:frete.hashItensFrete(itens),volume:frete.volumeDosItens(itens)})
 const body={itens:[{id:sku,quantidade:1}],enderecoId:trabalho.id,freteToken:quote(endereco.cep)}
 assert.equal((await checkout.POST(s.request('/api/checkout',body))).status,400)
 body.freteToken=quote(outroEndereco.cep)
 const r=await checkout.POST(s.request('/api/checkout',body));assert.equal(r.status,200);const result=await r.json()
 assert.equal((await s.read(result.pedidoId)).entrega.cep,outroEndereco.cep)
 await s.address({acao:'excluir',id:trabalho.id});await s.address({acao:'padrao',id:casa[0].id})
 assert.equal((await s.read(result.pedidoId)).entrega.logradouro,outroEndereco.logradouro)
 s.setOwner({email:'outra@example.test',id:2,db:s.client})
 assert.equal((await checkout.POST(s.request('/api/checkout',body))).status,404)
})

test('linha do tempo prefere a data autenticada do pagamento ao horário posterior da notificação', async () => {
 const { incluirEventosPedidos }=loadTs('lib/eventos-pedido')
 const q={select:()=>q,in:()=>q,eq:()=>q,then:resolve=>Promise.resolve({data:[{pedido_id:'1',evento:'pagamento_aprovado',criado_em:'2026-11-06T15:00:00Z'}],error:null}).then(resolve)}
 const [p]=await incluirEventosPedidos({from:()=>q},[{id:1,itens:[],created_at:'2026-11-06T12:00:00Z',pagamento:{aprovado_em:'2026-11-06T12:05:00Z'}}])
 assert.equal(p.linha_tempo.find(e=>e.etapa==='pagamento_aprovado').ocorrido_em,'2026-11-06T12:05:00Z')
})
