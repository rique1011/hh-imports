import 'server-only'
import { unstable_cache } from 'next/cache'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { ConfigRetirada } from '@/types/retirada'
import { enderecoCompleto } from '@/lib/cadastro-compra'

export const COLUNAS_CONFIG_RETIRADA = 'ativa,local,endereco,instrucoes,prazo_dias,versao'
export const getConfigRetirada = unstable_cache(async (): Promise<ConfigRetirada> => {
  const { data, error } = await getSupabaseAdmin().from('loja_retirada').select(COLUNAS_CONFIG_RETIRADA).eq('id', true).single()
  if (error || !data) throw Error('Não foi possível consultar a retirada presencial.')
  if (data.ativa && !enderecoCompleto(data.endereco)) throw Error('Confira o endereço de retirada no admin.')
  return data as ConfigRetirada
}, ['hh-retirada-config-v1'], { revalidate: 60, tags: ['retirada-config'] })

