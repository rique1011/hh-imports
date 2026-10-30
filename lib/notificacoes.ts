import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  enviarEmailPedidoRecebido, enviarEmailStatus, notificarAdminNovoPedido,
  notificarAdminPagamentoAprovado, type PedidoEmail, type ResultadoEmail,
} from '@/lib/mail'

interface Notificacao {
  id: number
  lease_id: string
  pedido_id: string
  evento: 'novo_pedido' | 'pagamento_aprovado' | 'enviado' | 'entregue'
  destinatario: 'cliente' | 'admin'
  tentativas: number
  payload: PedidoEmail
}

async function enviarNotificacao(item: Notificacao): Promise<ResultadoEmail> {
  const pedido = item.payload
  if (item.destinatario === 'admin') {
    return item.evento === 'novo_pedido'
      ? notificarAdminNovoPedido(pedido) : notificarAdminPagamentoAprovado(pedido)
  }
  if (item.evento === 'novo_pedido') return enviarEmailPedidoRecebido(pedido)
  return enviarEmailStatus(pedido.cliente_email, pedido.cliente_nome,
    item.evento === 'pagamento_aprovado' ? 'confirmado' : item.evento,
    pedido.codigo_rastreio || undefined, pedido)
}

export async function processarNotificacoes(pedidoId?: string, limite = 10) {
  const db = getSupabaseAdmin()
  const { data, error } = await db.rpc('hh_claim_notifications', {
    p_pedido_id: pedidoId || null, p_limite: limite,
  })
  if (error) throw new Error('Falha ao consultar a fila de notificacoes: ' + error.message)
  let enviadas = 0
  let falhas = 0
  await Promise.all(((data || []) as Notificacao[]).map(async item => {
    try {
      let resultado: ResultadoEmail
      try { resultado = await enviarNotificacao(item) }
      catch (error) {
        resultado = { sucesso: false, error: error instanceof Error ? error.message : 'Falha no envio.' }
      }
      const delay = Math.min(3600, 30 * 2 ** Math.min(item.tentativas - 1, 7))
      const update = resultado.sucesso
        ? { status: 'enviada', enviada_em: new Date().toISOString(), erro: null, locked_until: null }
        : { status: 'pendente', erro: resultado.error.slice(0, 500), locked_until: null,
            disponivel_em: new Date(Date.now() + delay * 1000).toISOString() }
      const { data: updated, error: updateError } = await db.from('pedido_notificacoes')
        .update(update).eq('id', item.id).eq('lease_id', item.lease_id)
        .eq('status', 'processando').select('id')
      if (updateError || !updated?.length) throw new Error('Falha ao registrar resultado da notificacao.')
      if (resultado.sucesso) enviadas++
      else {
        falhas++
        console.error('[notificacao] Envio pendente para nova tentativa:', {
          id: item.id, pedidoId: item.pedido_id, evento: item.evento, erro: resultado.error,
        })
      }
    } catch (error) {
      falhas++
      console.error('[notificacao] Falha; o lease permite retomar o envio:', {
        id: item.id, erro: error instanceof Error ? error.message : 'Erro desconhecido.',
      })
    }
  }))
  return { processadas: (data || []).length, enviadas, falhas }
}
