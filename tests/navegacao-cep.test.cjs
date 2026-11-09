const { test } = require('node:test')
const assert = require('node:assert/strict')
const { loadTs } = require('./helpers.cjs')
const { destinoInterno, linkComRetorno, destinoAposLogin } = loadTs('lib/navegacao')
const { camposCompraPendentes, documentoValido, telefoneValido } = loadTs('lib/cadastro-compra')
const cepRoute = loadTs('app/api/cep/[cep]/route')
const cep = (valor = '89209452') => cepRoute.GET(new Request('https://loja.example.test/api/cep/' + valor), { params: Promise.resolve({ cep: valor }) })

const endereco = { id: 'a', apelido: 'Casa', padrao: true, cep: '89209452', logradouro: 'Rua Teste', numero: '10', complemento: '', bairro: 'João Costa', cidade: 'Joinville', uf: 'SC' }

test('login comum abre a vitrine; contexto de produto, sacola e pedido é preservado', () => {
 assert.equal(destinoAposLogin({ role: 'cliente', senhaAtual: true }, null), '/')
 for (const retorno of ['/carrinho', '/produto/colar', '/categoria/colares?ordem=preco', '/minha-conta?aba=pedidos&pedido=44']) {
  const link = linkComRetorno('/login', retorno)
  const recebido = new URL(link, 'https://loja.example.test').searchParams.get('retorno')
  assert.equal(destinoAposLogin({ role: 'cliente', senhaAtual: true }, recebido), retorno)
 }
 assert.equal(destinoAposLogin({ role: 'admin', mfa: false, senhaAtual: true }, '/carrinho'), '/minha-conta?aba=seguranca')
 assert.equal(destinoAposLogin({ role: 'admin', mfa: true, senhaAtual: false }, '/'), '/minha-conta?aba=seguranca')
 assert.equal(destinoAposLogin({ role: 'admin', mfa: true, senhaAtual: true }, '/carrinho'), '/carrinho')
 assert.match(destinoAposLogin({ role: 'cliente', senhaAtual: false }, '/carrinho'), /^\/minha-conta\?aba=dados&retorno=%2Fcarrinho$/)
})
test('retorno não aceita execução, domínio externo, barras codificadas ou ciclos de autenticação', () => {
 for (const valor of ['https://invasor.test', '//invasor.test', 'javascript:alert(1)', 'data:text/html,x', '/\\invasor.test', '/%2f%2finvasor.test', '/%5cinvasor.test', '/%0ainvasor.test', '/api/checkout', '/%61pi/checkout', '/login?retorno=/login', '/verificar', '/cadastro', '/algo/../login', '/%E0%A4%A', null, {}, 42]) {
  assert.equal(destinoInterno(valor), '/', String(valor))
 }
 assert.equal(destinoInterno('/produto/colar#detalhes'), '/produto/colar#detalhes')
 assert.equal(destinoInterno('//invasor.test', '/carrinho'), '/carrinho')
})
test('dados obrigatórios incluem endereço completo e aceitam documentos e telefone formatados', () => {
 const dados = { cpf_cnpj: '123.456.789-01', whatsapp: '(47) 99999-9999' }
 assert.equal(documentoValido(dados.cpf_cnpj), true); assert.equal(telefoneValido(dados.whatsapp), true)
 assert.deepEqual(camposCompraPendentes({}, []), ['cpf_cnpj', 'whatsapp', 'endereco'])
 assert.deepEqual(camposCompraPendentes(dados, []), ['endereco'])
 assert.deepEqual(camposCompraPendentes(dados, [{ ...endereco, numero: '' }]), ['endereco'])
 assert.deepEqual(camposCompraPendentes(dados, [{ ...endereco, uf: 'ZZ' }]), ['endereco'])
 assert.deepEqual(camposCompraPendentes(dados, [endereco]), [])
 assert.deepEqual(camposCompraPendentes({ cpf_cnpj: '123', whatsapp: '123' }, [endereco]), ['cpf_cnpj', 'whatsapp'])
})
test('consulta de CEP rejeita formato inválido antes de consultar qualquer provedor', async t => {
 const original = global.fetch; t.after(() => { global.fetch = original })
 global.fetch = async () => { throw Error('Não deveria consultar') }
 for (const valor of ['1234567', '123456789', '89x09452', 'https://invasor.test']) assert.equal((await cep(valor)).status, 400)
})
test('CEP retorna apenas os dados públicos de endereço da fonte principal, sem número inventado', async t => {
 const original = global.fetch; t.after(() => { global.fetch = original }); const chamadas = []
 global.fetch = async (url, init) => { chamadas.push({ url, init }); return Response.json({ cep: '89209452', state: 'SC', city: 'Joinville', neighborhood: 'João Costa', street: 'Rua Teste', service: 'provider', campoExtra: 'não repassar' }) }
 const res = await cep(); assert.equal(res.status, 200)
 assert.deepEqual(await res.json(), { cep: '89209452', uf: 'SC', cidade: 'Joinville', bairro: 'João Costa', logradouro: 'Rua Teste' })
 assert.equal(chamadas.length, 1); assert.equal(chamadas[0].url, 'https://brasilapi.com.br/api/cep/v1/89209452')
 assert.equal(chamadas[0].init.redirect, 'error'); assert.equal(chamadas[0].init.headers, undefined)
 assert.match(res.headers.get('cache-control'), /s-maxage=86400/)
})
test('CEP usa a segunda fonte em falha de rede e preserva CEP genérico para completar manualmente', async t => {
 const original = global.fetch; t.after(() => { global.fetch = original }); let chamadas = 0
 global.fetch = async () => { chamadas++; if (chamadas === 1) throw Error('rede'); return Response.json({ cep: '89209-452', logradouro: 'Rua Teste', bairro: 'João Costa', localidade: 'Joinville', uf: 'SC' }) }
 const res = await cep(); assert.equal(res.status, 200); assert.equal((await res.json()).cidade, 'Joinville'); assert.equal(chamadas, 2)
 global.fetch = async () => Response.json({ cep: '12345678', state: 'SC', city: 'Cidade', neighborhood: '', street: '' })
 const generico = await cep('12345678'); assert.equal(generico.status, 200); assert.equal((await generico.json()).logradouro, '')
})
test('CEP distingue inexistente de serviço temporariamente indisponível, permitindo cadastro manual', async t => {
 const original = global.fetch; t.after(() => { global.fetch = original }); let chamadas = 0
 global.fetch = async () => ++chamadas === 1 ? Response.json({}, { status: 404 }) : Response.json({ erro: true })
 const ausente = await cep(); assert.equal(ausente.status, 404); assert.match((await ausente.json()).error, /manualmente/)
 global.fetch = async () => { throw Error('segredo interno do provedor') }
 const falha = await cep(); assert.equal(falha.status, 503); const dados = await falha.json()
 assert.match(dados.error, /indisponível/); assert.equal(JSON.stringify(dados).includes('segredo'), false)
 assert.equal(falha.headers.get('cache-control'), 'no-store')
})
