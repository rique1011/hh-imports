const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTs } = require('./helpers.cjs')
const { grupoPedidoAdmin, filtrarPedidosAdmin, resumoPagamentoAdmin } = loadTs('lib/pedidos-admin')
const pedido = (id, status, pagamento) => ({ id, status, pagamento, cliente_nome: 'João da Silva', cliente_email: 'joao@example.test', total: 100, itens: [] })

test('fila de envio contém somente confirmações pagas e preparação; pendentes, cancelados e histórico permanecem consultáveis', () => {
  const pedidos = ['pendente','Pendente','confirmado','pago','processando','enviado','entregue','cancelado','Carrinho Abandonado'].map((s,i)=>pedido(i+1,s))
  assert.deepEqual(filtrarPedidosAdmin(pedidos,'a_enviar','').map(p=>p.status),['confirmado','pago','processando'])
  assert.equal(filtrarPedidosAdmin(pedidos,'aguardando','').length,2)
  assert.deepEqual(filtrarPedidosAdmin(pedidos,'enviados','').map(p=>p.id),[6])
  assert.deepEqual(filtrarPedidosAdmin(pedidos,'entregues','').map(p=>p.id),[7])
  assert.equal(filtrarPedidosAdmin(pedidos,'todos','').length,9)
  assert.equal(pedidos.length,9)
})
test('estorno, contestação, reembolso parcial e revisão bloqueiam fila de envio mesmo após status logístico avançado', () => {
  for(const status of ['confirmado','processando','enviado','entregue'])for(const pagamento of [
    {status:'refunded'}, {status:'charged_back'}, {status:'in_mediation'}, {status:'approved',valor_reembolsado:0.01}, {status:'approved',requer_revisao:true},
  ]){
    const p=pedido(1,status,pagamento)
    assert.equal(grupoPedidoAdmin(p),'revisao');assert.equal(filtrarPedidosAdmin([p],'a_enviar','').length,0)
    assert.equal(filtrarPedidosAdmin([p],'revisao','').length,1)
  }
  assert.equal(grupoPedidoAdmin(pedido(1,'pagamento_em_analise')),'revisao')
  assert.equal(grupoPedidoAdmin(pedido(1,'confirmado',{status:'pending'})),'revisao')
  assert.equal(grupoPedidoAdmin(pedido(1,'pendente',{status:'approved'})),'aguardando')
})
test('busca por número com #, nome e e-mail funciona dentro do filtro e não exclui pedidos do histórico', () => {
  const a=pedido(41,'confirmado',{status:'approved'}),b={...pedido(45,'pendente'),cliente_nome:'Outra pessoa',cliente_email:'outra@example.test'}
  const lista=[a,b]
  assert.deepEqual(filtrarPedidosAdmin(lista,'a_enviar','#41'),[a])
  assert.deepEqual(filtrarPedidosAdmin(lista,'a_enviar','JOAO DA SILVA'),[a])
  assert.deepEqual(filtrarPedidosAdmin(lista,'todos',' OUTRA@EXAMPLE.TEST '),[b])
  assert.deepEqual(filtrarPedidosAdmin(lista,'a_enviar','45'),[])
  assert.equal(filtrarPedidosAdmin(lista,'todos','').length,2)
})
test('pagamentos quitados com créditos ou sem cobrança continuam na fila confirmada; resumo não inclui URLs e preferências', () => {
  for(const credito of [0,100]){
    const p={...pedido(1,'confirmado'),total:0,cashback_debitado:credito}
    assert.equal(grupoPedidoAdmin(p),'a_enviar')
    assert.equal(resumoPagamentoAdmin(p).metodo,credito?'cashback':'isento')
  }
  const p=pedido(1,'confirmado',{status:'approved',metodo:'pix',valor_reembolsado:0,preferencia_id:'privado',url_pagamento:'https://privado.test'})
  assert.equal(resumoPagamentoAdmin(p).metodo,'pix')
  assert.equal('preferencia_id' in resumoPagamentoAdmin(p),false);assert.equal('url_pagamento' in resumoPagamentoAdmin(p),false)
})
test('API administrativa devolve o resumo financeiro para filtrar revisão sem vazar metadados do provedor', async () => {
  const p=pedido(41,'enviado',{status:'approved',requer_revisao:true,valor_reembolsado:5,preferencia_id:'privado',init_point:'https://privado.test'})
  const q={select(){return this},order(){return this},then(resolve,reject){return Promise.resolve({data:[p],error:null}).then(resolve,reject)}}
  const auth=loadTs('lib/autorizacao'),route=loadTs('app/api/admin/dados/route',{'@/lib/autorizacao':{...auth,exigirAdmin:async()=>({db:{from:()=>q}})}})
  const r=await route.POST(new Request('https://loja.test/api/admin/dados',{method:'POST',body:JSON.stringify({tabela:'pedidos',operacao:'select'})}))
  assert.equal(r.status,200);const data=(await r.json()).data
  assert.equal(data[0].pagamento.requer_revisao,true);assert.equal(grupoPedidoAdmin(data[0]),'revisao')
  assert.equal(JSON.stringify(data).includes('privado'),false)
})
