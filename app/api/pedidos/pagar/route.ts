import { NextResponse } from 'next/server'
import { Preference } from 'mercadopago'
import { getRequestUser } from '@/lib/request-user'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getMercadoPagoClient } from '@/lib/mercadopago'
import { getSiteUrl } from '@/lib/site-url'
import { BRAND_NAME } from '@/lib/brand'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request)
    if (!user) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })
    const { pedidoId } = await request.json()
    if (!pedidoId) return NextResponse.json({ error: 'Pedido invalido.' }, { status: 400 })
    const { data: pedido, error } = await getSupabaseAdmin().from('pedidos')
      .select('*').eq('id', pedidoId).eq('cliente_email', user.email).single()
    if (error || !pedido) return NextResponse.json({ error: 'Pedido nao encontrado.' }, { status: 404 })
    if (pedido.status !== 'pendente' || Number(pedido.total) <= 0) {
      return NextResponse.json({ error: 'Este pedido nao possui pagamento pendente.' }, { status: 409 })
    }
    const baseUrl = getSiteUrl()
    const response = await new Preference(getMercadoPagoClient()).create({
      body: {
        items: [{ id: String(pedido.id), title: 'Pedido ' + BRAND_NAME,
          quantity: 1, unit_price: Number(pedido.total), currency_id: 'BRL' }],
        payer: { email: user.email },
        external_reference: String(pedido.id),
        notification_url: baseUrl + '/api/webhooks/mercadopago',
        back_urls: { success: baseUrl + '/sucesso', failure: baseUrl + '/minha-conta', pending: baseUrl + '/minha-conta' },
        ...(baseUrl.startsWith('https://') ? { auto_return: 'approved' as const } : {}),
      },
    })
    if (!response.init_point) throw new Error('Link de pagamento indisponivel.')
    return NextResponse.json({ urlPagamento: response.init_point })
  } catch (error) {
    console.error('[pagamento] Falha:', error)
    return NextResponse.json({ error: 'Falha ao gerar link de pagamento.' }, { status: 500 })
  }
}
