import { NextResponse } from 'next/server'
import { exigirUsuario, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'

export const dynamic = 'force-dynamic'
const CAMPOS = 'id,nome,email,cpf_cnpj,whatsapp,data_nascimento,endereco,saldo_cashback,created_at,perfil,role'

export async function GET(request: Request) {
  try {
    const user = await exigirUsuario(request)
    const [{ data, error }, { count, error: ordersError }] = await Promise.all([
      user.db.from('usuarios').select(CAMPOS).eq('id', user.id).single(),
      user.db.from('pedidos').select('id', { count: 'exact', head: true }).eq('cliente_email', user.email),
    ])
    if (error || ordersError) throw error || ordersError
    return NextResponse.json({ ...data, possui_pedidos: Boolean(count) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return responderErro(error) }
}

export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirUsuario(request)
    const body = await request.json()
    const campos = ['cpf_cnpj','whatsapp','data_nascimento','endereco'] as const
    const update: Record<string, string> = {}
    for (const campo of campos) {
      if (typeof body[campo] !== 'string' || body[campo].length > (campo === 'endereco' ? 2000 : 100)) {
        throw new ErroHttp(400, 'Dados de cadastro inválidos.')
      }
      update[campo] = body[campo]
    }
    const { error } = await user.db.from('usuarios').update(update).eq('id', user.id)
    if (error) throw error
    return NextResponse.json({ sucesso: true })
  } catch (error) { return responderErro(error) }
}
