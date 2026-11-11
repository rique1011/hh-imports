import 'server-only'
import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { supabase } from '@/lib/supabase'
import { MENU_PADRAO, type ItemMenu } from '@/lib/selecoes'

export const COLUNAS_MENU = 'id,slug,nome,descricao,tipo,regra,ativo,ordem,versao'

// Só contém configuração pública. A sessão e os dados de clientes ficam fora deste cache.
export const getNavegacaoPublica = cache(unstable_cache(async (): Promise<readonly ItemMenu[]> => {
  const { data, error } = await supabase.from('loja_navegacao').select(COLUNAS_MENU)
    .order('ordem').order('nome').limit(100).abortSignal(AbortSignal.timeout(5000))
  if (error) {
    console.error('Menu indisponível; usando a navegação padrão.')
    return MENU_PADRAO
  }
  return data || []
}, ['hh-menu-v1'], { revalidate: 60, tags: ['navegacao-publica'] }))
