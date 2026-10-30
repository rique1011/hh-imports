import 'server-only'
import type { getSupabaseAdmin } from '@/lib/supabase-admin'
import { ErroHttp } from '@/lib/autorizacao'
type Banco = ReturnType<typeof getSupabaseAdmin>

async function boasVindas(db: Banco, email: string) {
  const [{ data: cadastro, error }, { count, error: pedidosError }] = await Promise.all([
    db.from('usuarios').select('created_at').eq('email', email).single(),
    db.from('pedidos').select('id', { count: 'exact', head: true }).eq('cliente_email', email)
      .in('status', ['pago','confirmado','processando','enviado','entregue']),
  ])
  if (error || pedidosError || !cadastro) throw new Error('Falha ao consultar elegibilidade.')
  const idade = Date.now() - new Date(cadastro.created_at).getTime()
  return Number.isFinite(idade) && idade >= 0 && idade <= 7 * 86400000 && count === 0
}

export async function validarCupom(db: Banco, email: string, entrada: unknown) {
  if (typeof entrada !== 'string' || entrada.length > 80) throw new ErroHttp(400, 'Cupom inválido.')
  const codigo = entrada.toUpperCase().trim()
  const { data: cupom, error } = await db.from('cupons').select('desconto,usuario_id')
    .eq('codigo', codigo).eq('ativo', true).maybeSingle()
  if (error) throw new Error('Falha ao consultar cupom.')
  if (cupom?.usuario_id) {
    const { data: dono, error } = await db.from('usuarios').select('id').eq('email', email).single()
    if (error || String(dono?.id) !== String(cupom.usuario_id)) throw new ErroHttp(400, 'Cupom indisponível para esta conta.')
  }
  let percentual = Number(cupom?.desconto || 0)
  if (codigo === 'BEMVINDO10') {
    if (!await boasVindas(db, email)) throw new ErroHttp(400, 'Cupom exclusivo para primeira compra em até 7 dias.')
    percentual = percentual || 10
  }
  if (!percentual && codigo === 'NAOVAEMBORA') percentual = 5
  if (!percentual && /^OFERTA\d+$/.test(codigo)) {
    const solicitado = Number(codigo.slice(6))
    const { data: bases, error } = await db.from('cupons').select('desconto')
      .eq('ativo', true).is('usuario_id', null).eq('desconto', solicitado - 5).limit(1)
    if (error) throw new Error('Falha ao consultar oferta.')
    if (bases?.length || (solicitado === 15 && await boasVindas(db, email))) percentual = solicitado
  }
  if (!Number.isFinite(percentual) || percentual <= 0 || percentual > 100) throw new ErroHttp(400, 'Cupom inválido ou expirado.')
  return { codigo, desconto: percentual }
}
