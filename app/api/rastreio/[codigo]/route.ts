import { NextResponse } from 'next/server'
import { exigirUsuario, responderErro, ErroHttp } from '@/lib/autorizacao'
import { CONTACT_EMAIL } from '@/lib/brand'
import { limitar } from '@/lib/seguranca'

export async function GET(request: Request, props: { params: Promise<{ codigo: string }> }) {
  try {
    const user = await exigirUsuario(request)
    await limitar(request,'consultar-rastreio',20,60,String(user.id))
    const { codigo } = await props.params
    if (!/^[a-zA-Z0-9-]{5,100}$/.test(codigo)) throw new ErroHttp(400, 'Código inválido.')
    let query = user.db.from('pedidos').select('id').eq('codigo_rastreio', codigo)
    if (!user.admin) query = query.eq('cliente_email', user.email)
    const { data: pedido, error } = await query.limit(1).maybeSingle()
    if (error) throw error
    if (!pedido) throw new ErroHttp(404, 'Rastreio indisponível para esta conta.')
    if (!process.env.MELHOR_ENVIO_TOKEN) throw new ErroHttp(503, 'Rastreio indisponível no momento.')
    const response = await fetch('https://www.melhorenvio.com.br/api/v2/me/shipment/tracking', {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json',
        Authorization: 'Bearer ' + process.env.MELHOR_ENVIO_TOKEN,
        'User-Agent': 'H&H IMPORTS (' + CONTACT_EMAIL + ')' },
      body: JSON.stringify({ orders: [codigo] }),
    })
    if (!response.ok) throw new ErroHttp(502, 'O fornecedor não retornou o rastreio.')
    const data = await response.json()
    return NextResponse.json(data[codigo]?.events || [], { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return responderErro(error) }
}
