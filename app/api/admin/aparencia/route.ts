import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { exigirAdmin, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
import { limitar, lerJson } from '@/lib/seguranca'
import { validarAparencia } from '@/lib/aparencia'
import { lerAparencia } from '@/lib/aparencia-servidor'

const headers = { 'Cache-Control': 'private, no-store' }
export async function GET(request: Request) {
  try { await exigirAdmin(request); return NextResponse.json(await lerAparencia(), { headers }) }
  catch (e) { return responderErro(e) }
}
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirAdmin(request)
    await limitar(request, 'aparencia', 20, 600, String(user.id))
    const body = await lerJson(request)
    if (!Number.isSafeInteger(body.versao) || Number(body.versao) < 1) throw new ErroHttp(400, 'Recarregue a configuração antes de salvar.')
    let config
    try { config = validarAparencia(body.config, process.env.NEXT_PUBLIC_SUPABASE_URL || '') }
    catch (e) { throw new ErroHttp(400, e instanceof Error ? e.message : 'Aparência inválida.') }
    const { data, error } = await user.db.from('loja_aparencia')
      .update({ config, versao: Number(body.versao) + 1, atualizado_em: new Date().toISOString(), atualizado_por: user.email })
      .eq('id', true).eq('versao', body.versao).select('versao').maybeSingle()
    if (error) throw error
    if (!data) throw new ErroHttp(409, 'A aparência foi alterada em outra aba. Recarregue antes de salvar novamente.')
    revalidateTag('aparencia-publica', { expire: 0 })
    return NextResponse.json({ config, versao: Number(data.versao) }, { headers })
  } catch (e) { return responderErro(e) }
}
