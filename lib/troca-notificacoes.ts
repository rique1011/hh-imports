import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { enviarEmailLoja, escapeHtml } from '@/lib/mail'
import { CONTACT_EMAIL } from '@/lib/brand'
import { getSiteUrl } from '@/lib/site-url'
import { STATUS_TROCA, RESOLUCOES, type TrocaCliente } from '@/lib/devolucoes'

export async function processarNotificacoesTrocas(limite = 10) {
  const db = getSupabaseAdmin()
  const { data, error } = await db.rpc('hh_claim_troca_notificacoes', { p_limite: limite })
  if (error) throw new Error('Fila de devoluções indisponível.')
  let enviadas = 0
  for (const n of data || []) {
    let sucesso = false
    try {
      const { data: troca, error: erroTroca } = await db.from('trocas').select('usuario_id').eq('id', n.troca_id).single()
      if (erroTroca || !troca) throw new Error('Solicitação indisponível.')
      const { data: cliente, error: erroCliente } = await db.from('usuarios').select('nome,email').eq('id', troca.usuario_id).single()
      if (erroCliente || !cliente) throw new Error('Cliente indisponível.')
      const p = n.payload as { pedidoId: string; status: string; codigo?: string; validade?: string; observacao?: string; produto?: TrocaCliente['produto_snapshot']; resolucao: TrocaCliente['resolucao']; credito?: number }
      const resumo = '<p>Pedido <strong>#' + escapeHtml(p.pedidoId) + '</strong><br>' + escapeHtml(p.produto?.quantidade || '') + ' × ' + escapeHtml(p.produto?.nome || 'Peça do pedido') + '</p>'
      const mensagem = '<p>Olá, ' + escapeHtml(cliente.nome) + '.</p><p>' + escapeHtml(STATUS_TROCA[p.status] || p.status) + '.</p>' + resumo +
        '<p>Preferência registrada: ' + escapeHtml(RESOLUCOES[p.resolucao]) + '.</p>' +
        (p.codigo ? '<p>Apresente o código de postagem <strong>' + escapeHtml(p.codigo) + '</strong> em uma agência dos Correios. ' + (p.validade ? 'Validade: ' + escapeHtml(p.validade.split('-').reverse().join('/')) + '.' : 'Confira a validade nas instruções dos Correios.') + '</p>' : '') +
        (p.observacao ? '<p>' + escapeHtml(p.observacao).replace(/\n/g, '<br>') + '</p>' : '') +
        (Number(p.credito) > 0 ? '<p>Crédito por devolução: R$ ' + escapeHtml(Number(p.credito).toFixed(2).replace('.', ',')) + '. O cashback promocional correspondente à compra devolvida é ajustado separadamente.</p>' : '') +
        '<p><a href="' + escapeHtml(getSiteUrl(n.destinatario === 'admin' ? '/admin/devolucoes' : '/minha-conta?aba=trocas')) + '">Acompanhar solicitação</a></p>'
      sucesso = (await enviarEmailLoja(n.destinatario === 'admin' ? process.env.ADMIN_EMAIL?.trim() || CONTACT_EMAIL : cliente.email,
        (n.destinatario === 'admin' ? 'Nova devolução' : STATUS_TROCA[p.status] || 'Atualização de devolução') + ' — Pedido #' + p.pedidoId, mensagem)).sucesso
    } catch { console.error('[devolucao] Notificação aguarda nova tentativa.', { id: n.id }) }
    const { error: erroUpdate } = await db.from('troca_notificacoes').update(sucesso
      ? { status: 'enviada', enviada_em: new Date().toISOString(), locked_until: null }
      : { status: 'pendente', disponivel_em: new Date(Date.now() + 60000 * Math.min(60, 2 ** Math.min(n.tentativas, 6))).toISOString(), locked_until: null })
      .eq('id', n.id).eq('lease_id', n.lease_id)
    if (erroUpdate) throw new Error('Resultado da notificação pendente.')
    if (sucesso) enviadas++
  }
  return { processadas: data?.length || 0, enviadas }
}
