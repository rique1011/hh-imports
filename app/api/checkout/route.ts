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

async function podeUsarBoasVindas(db: ReturnType<typeof getSupabaseAdmin>, email: string) {
  const { data: cadastro, error: cadastroError } = await db.from('usuarios')
    .select('created_at').eq('email', email).single()
  const { count, error: comprasError } = await db.from('pedidos')
    .select('id', { count: 'exact', head: true }).eq('cliente_email', email)
    .in('status', ['pago', 'confirmado', 'processando', 'enviado', 'entregue'])
  if (cadastroError || comprasError || !cadastro) throw new Error('Falha ao validar elegibilidade do cupom.')
  const idade = Date.now() - new Date(cadastro.created_at).getTime()
  return Number.isFinite(idade) && idade >= 0 && idade <= 7 * 86400000 && count === 0
}

export async function POST(request: Request) {
  try {
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
      .select('id, nome, preco').in('id', ids)
    if (produtosError) throw new Error('Falha ao consultar produtos.')
    const itens = body.itens.map((item: { id: string | number; quantidade: number; foto?: string; slug?: string }) => {
      const produto = produtos?.find(produto => String(produto.id) === String(item.id))
      if (!produto) throw new Error('Produto indisponivel.')
      return { id: item.id, nome: produto.nome, preco: valor(produto.preco),
        quantidade: Number(item.quantidade), foto: item.foto || '', slug: item.slug || '' }
    })
    const subtotal = valor(itens.reduce((sum: number, item: { preco: number; quantidade: number }) =>
      sum + item.preco * item.quantidade, 0))
    const frete = subtotal >= 100 ? 0 : valor(body.frete)
    const embalagem = body.embalagemPresente ? 15 : 0
    // O percentual do cupom e validado no servidor; valores enviados pelo cliente sao ignorados.
    let desconto = 0
    if (body.codigoCupom) {
      const { data: cupom, error: cupomError } = await db.from('cupons').select('desconto')
        .eq('codigo', String(body.codigoCupom).toUpperCase().trim()).eq('ativo', true).maybeSingle()
      if (cupomError) throw new Error('Falha ao consultar cupom.')
      const codigo = String(body.codigoCupom).toUpperCase().trim()
      let percentual = Number(cupom?.desconto || 0)
      if (codigo === 'BEMVINDO10') {
        if (!await podeUsarBoasVindas(db, user.email)) {
          return NextResponse.json({ error: 'Cupom exclusivo para primeira compra em ate 7 dias.' }, { status: 400 })
        }
        percentual = percentual || 10
      }
      // A oferta extra de 5% precisa partir de um cupom real ou de boas-vindas elegivel.
      if (!percentual && codigo === 'NAOVAEMBORA') percentual = 5
      if (!percentual && /^OFERTA\d+$/.test(codigo)) {
        const solicitado = Number(codigo.slice(6))
        const { data: bases, error: baseError } = await db.from('cupons').select('desconto')
          .eq('ativo', true).eq('desconto', solicitado - 5).limit(1)
        if (baseError) throw new Error('Falha ao validar oferta.')
        if (bases?.length || (solicitado === 15 && await podeUsarBoasVindas(db, user.email))) {
          percentual = solicitado
        }
      }
      if (!Number.isFinite(percentual) || percentual <= 0 || percentual > 100) {
        return NextResponse.json({ error: 'Cupom invalido. Remova-o ou escolha um cupom ativo.' }, { status: 400 })
      }
      desconto = valor(subtotal * percentual / 100)
    }
    const cashback = valor(body.cashbackUsado)
    const antesCashback = valor(subtotal + frete + embalagem - desconto)
    if (cashback > antesCashback) {
      return NextResponse.json({ error: 'Cashback maior que o total do pedido.' }, { status: 400 })
    }
    const total = valor(antesCashback - cashback)
    const baseUrl = getSiteUrl()
    // Validar credenciais antes de criar o pedido.
    const mp = total > 0 ? getMercadoPagoClient() : null
    const { data: pedido, error: pedidoError } = await db.rpc('hh_criar_pedido', {
      p_email: user.email, p_nome: user.name, p_total: total,
      p_itens: itens, p_cashback: cashback,
    })
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
    console.error('[checkout] Falha:', error)
    return NextResponse.json({ error: 'Nao foi possivel criar o pagamento. Tente novamente.' }, { status: 500 })
  }
}
