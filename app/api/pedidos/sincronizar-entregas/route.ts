import { after, NextResponse } from 'next/server'
import { exigirUsuario, validarOrigem, responderErro } from '@/lib/autorizacao'
import { sincronizarRecebimentos } from '@/lib/recebimento-automatico'
import { processarNotificacoes } from '@/lib/notificacoes'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirUsuario(request)
    // O navegador não escolhe IDs nem fornece datas/status de entrega.
    const resultado = await sincronizarRecebimentos(user.db, user.admin ? {} : { clienteEmail: user.email, limite: 5 })
    if (resultado.entregues > 0) after(async () => {
      try { await processarNotificacoes(undefined, 20) }
      catch { console.error('[recebimento] E-mail persistido para nova tentativa.') }
    })
    return NextResponse.json(resultado, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return responderErro(error) }
}
