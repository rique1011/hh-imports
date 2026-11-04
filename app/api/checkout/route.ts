import { validarFretePedido } from '@/lib/frete'
import { snapshotEntrega } from '@/lib/entrega'
import { validarCupom } from '@/lib/cupons'
import { ErroHttp, validarOrigem } from '@/lib/autorizacao'
import { NextResponse, after } from 'next/server'
import { Preference } from 'mercadopago'
import { BRAND_NAME } from '@/lib/brand'
import { getRequestUser } from '@/lib/request-user'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getMercadoPagoClient } from '@/lib/mercadopago'
import { getSiteUrl } from '@/lib/site-url'
import { processarNotificacoes } from '@/lib/notificacoes'

export const runtime = 'nodejs'
export const maxDuration = 120

function valor(value: unknown) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number) || number < 0) throw new Error('Valor monetario invalido.')
  return Math.round(number * 100) / 100
}

export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await getRequestUser(request)
    if (!user) return NextResponse.json({ error: 'Faca login para comprar.' }, { status: 401 })
    const body = await request.json()
    if (!Array.isArray(body.itens) || body.itens.length === 0 || body.itens.length > 100) {
      return NextResponse.json({ error: 'Carrinho invalido.' }, { status: 400 })
    }
    if (body.itens.some((item: { id?: unknown; quantidade?: unknown }) =>
      !item.id || !Number.isSafeInteger(Number(item.quantidade)) || Number(item.quantidade) < 1)) {
      return NextResponse.json({ error: 'Itens ou quantidades invalidos.' }, { status: 400 })
    }
    const db = getSupabaseAdmin()
    // Usa os precos do catalogo, evitando confirmar um pedido com valores adulterados.
    const ids = [...new Set(body.itens.map((item: { id: string | number }) => item.id))]
    const { data: produtos, error: produtosError } = await db.from('produtos')
      .select('id, nome, preco, fotos, slug').in('id', ids)
    if (produtosError) throw new Error('Falha ao consultar produtos.')
    const itens = body.itens.map((item: { id: string | number; quantidade: number; foto?: string; slug?: string }) => {
      const produto = produtos?.find(produto => String(produto.id) === String(item.id))
      if (!produto) throw new Error('Produto indisponivel.')
      return { id: item.id, nome: produto.nome, preco: valor(produto.preco),
        quantidade: Number(item.quantidade), foto: produto.fotos?.[0] || '', slug: produto.slug || '' }
    })
    const subtotal = valor(itens.reduce((sum: number, item: { preco: number; quantidade: number }) =>
      sum + item.preco * item.quantidade, 0))
    const { data: cadastro, error: cadastroError } = await db.from('usuarios')
      .select('nome,email,cpf_cnpj,whatsapp,endereco').eq('email', user.email).single()
    if (cadastroError || !cadastro) throw new Error('Falha ao consultar o endereço de entrega.')
    const entrega = snapshotEntrega(cadastro)
    if (!/^\d{8}$/.test(entrega.cep) || !entrega.logradouro || !entrega.numero || !entrega.bairro || !entrega.cidade || !entrega.uf) {
      return NextResponse.json({ error: 'Complete o endereço de entrega no seu cadastro.' }, { status: 400 })
    }
    let frete = 0
    const cotacao = body.freteToken ? validarFretePedido(body.freteToken, entrega.cep, itens) : null
    if (subtotal < 100) {
      if (cotacao === null) return NextResponse.json({ error: 'Calcule novamente o frete para o CEP do seu cadastro.' }, { status: 400 })
      frete = cotacao.centavos / 100
    }
    const embalagem = body.embalagemPresente ? 15 : 0
    const cupom = body.codigoCupom ? await validarCupom(db, user.email, body.codigoCupom) : null
    const desconto = cupom ? valor(subtotal * cupom.desconto / 100) : 0
    const cashback = valor(body.cashbackUsado)
    const antesCashback = valor(subtotal + frete + embalagem - desconto)
    if (cashback > antesCashback) {
      return NextResponse.json({ error: 'Cashback maior que o total do pedido.' }, { status: 400 })
    }
    const total = valor(antesCashback - cashback)
    const baseUrl = getSiteUrl()
    // Validar credenciais antes de criar o pedido.
    const mp = total > 0 ? getMercadoPagoClient() : null
    const { data: pedido, error: pedidoError } = await db.rpc('hh_criar_pedido_com_envio', {
      p_email: user.email, p_nome: user.name, p_total: total,
      p_itens: itens, p_cashback: cashback, p_entrega: entrega, p_frete: cotacao,
    })
    if (pedidoError && /Estoque insuficiente|Produto indisponivel/.test(pedidoError.message)) return NextResponse.json({ error: 'Estoque insuficiente. Atualize sua sacola.' }, { status: 409 })
    if (pedidoError || !pedido) throw new Error('Falha ao criar pedido: ' + (pedidoError?.message || 'Sem resultado.'))

    // O trigger ja registrou cliente e admin; falha SMTP nao desfaz a compra.
    after(async () => {
      try { await processarNotificacoes(String(pedido.id), 6) }
      catch (error) { console.error('[checkout] Notificacoes persistidas aguardam retry:', error) }
    })
    if (total === 0) {
      return NextResponse.json({ pedidoId: pedido.id,
        urlPagamento: baseUrl + '/sucesso?external_reference=' + encodeURIComponent(pedido.id) })
    }
    const preference = await new Preference(mp!).create({
      body: {
        items: [{ id: String(pedido.id), title: 'Pedido ' + BRAND_NAME,
          quantity: 1, unit_price: total, currency_id: 'BRL' }],
        payer: { email: user.email },
        external_reference: String(pedido.id),
        notification_url: baseUrl + '/api/webhooks/mercadopago',
        back_urls: { success: baseUrl + '/sucesso', failure: baseUrl + '/carrinho', pending: baseUrl + '/carrinho' },
        ...(baseUrl.startsWith('https://') ? { auto_return: 'approved' as const } : {}),
      },
    })
    if (!preference.init_point) throw new Error('Mercado Pago nao retornou o link de pagamento.')
    return NextResponse.json({ pedidoId: pedido.id, urlPagamento: preference.init_point })
  } catch (error) {
    if (error instanceof ErroHttp) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[checkout] Falha:', error)
    return NextResponse.json({ error: 'Nao foi possivel criar o pagamento. Tente novamente.' }, { status: 500 })
  }
}
