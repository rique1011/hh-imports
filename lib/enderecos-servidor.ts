import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { EnderecoSalvo } from '@/types/loja'
export async function listarEnderecos(db: ReturnType<typeof getSupabaseAdmin>, usuarioId: string | number): Promise<EnderecoSalvo[]> {
  const { data, error } = await db.from('usuario_enderecos').select('id,apelido,dados,padrao').eq('usuario_id', usuarioId).order('criado_em')
  if (error) throw error
  return (data || []).map(e => ({ ...e.dados, id: e.id, apelido: e.apelido, padrao: e.padrao }))
}
