import 'server-only'
import { unstable_cache } from 'next/cache'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { APARENCIA_PADRAO, validarAparencia } from '@/lib/aparencia'

export async function lerAparencia() {
  const { data, error } = await getSupabaseAdmin().from('loja_aparencia').select('config,versao').eq('id', true)
    .abortSignal(AbortSignal.timeout(5000)).single()
  if (error || !data) throw new Error('Não foi possível carregar a aparência da loja.')
  return { config: validarAparencia({ ...APARENCIA_PADRAO, ...data.config }, process.env.NEXT_PUBLIC_SUPABASE_URL || ''), versao: Number(data.versao) }
}

// Só o DTO visual é público. E-mail do editor e credenciais nunca entram no cache.
export const getAparenciaPublica = unstable_cache(async () => {
  try { return (await lerAparencia()).config }
  catch { console.error('Aparência indisponível; usando identidade padrão.'); return APARENCIA_PADRAO }
}, ['hh-aparencia-v1'], { revalidate: 60, tags: ['aparencia-publica'] })
