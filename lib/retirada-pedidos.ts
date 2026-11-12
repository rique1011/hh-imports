import 'server-only'
import type { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { ConfigRetirada, RetiradaPedido } from '@/types/retirada'
import type { Pedido } from '@/types/loja'
type Db = ReturnType<typeof getSupabaseAdmin>

export function retiradaParaCliente(r: Record<string, unknown>, codigo = false): RetiradaPedido {
  const config = r.config as ConfigRetirada
  return { estado: r.estado as RetiradaPedido['estado'], local: config.local, endereco: config.endereco, instrucoes: config.instrucoes,
    prazo_dias: config.prazo_dias, disponivel_em: r.disponivel_em as string | null, avisado_em: r.avisado_em as string | null,
    prazo_final: r.prazo_final as string | null, retirado_em: r.retirado_em as string | null,
    reembolsado_em: r.reembolsado_em as string | null, versao: Number(r.versao),
    ...(codigo && r.estado === 'disponivel' ? { codigo: String(r.codigo) } : {}),
  }
}
export async function incluirRetiradas<T extends Pick<Pedido, 'id' | 'entrega'>>(db: Db, pedidos: T[], cliente = false): Promise<(T & { retirada?: RetiradaPedido | null })[]> {
  const ids = pedidos.filter(p => p.entrega?.modalidade === 'retirada').map(p => String(p.id))
  if (!ids.length) return pedidos
  const registros = new Map<string, Record<string, unknown>>()
  for (let inicio = 0; inicio < ids.length; inicio += 100) {
    const { data, error } = await db.from('pedido_retiradas').select('*').in('pedido_id', ids.slice(inicio, inicio + 100))
    if (error) throw Error('Não foi possível carregar as retiradas.')
    for (const r of data || []) registros.set(r.pedido_id, r)
  }
  return pedidos.map(p => {
    const r = registros.get(String(p.id))
    return r ? { ...p, retirada: { ...retiradaParaCliente(r, cliente), ...(!cliente ? { erro: r.erro as string | null } : {}) } } : p
  })
}
