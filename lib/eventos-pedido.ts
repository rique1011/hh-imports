import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { eventosDosItens, instanteRegistrado } from '@/lib/linha-tempo-pedido'
import type { EtapaPedido, EventoPedido, Identificador, ItemPedido } from '@/types/loja'

interface PedidoComEventos { id: Identificador; created_at: string; itens: ItemPedido[]; pagamento?: { aprovado_em?: string | null } }
interface Confirmacao { pedido_id: string; evento: 'pagamento_aprovado' | 'enviado'; criado_em: string }
const ordem: Record<EtapaPedido, number> = { realizado: 1, pagamento_aprovado: 2, preparando: 3, enviado: 4, entregue: 5 }

// Recebe somente pedidos já autorizados pela API. Nunca retorna payloads da fila de e-mails.
export async function incluirEventosPedidos<T extends PedidoComEventos>(db: ReturnType<typeof getSupabaseAdmin>, pedidos: T[]) {
  const registros = new Map<string, Confirmacao[]>()
  const ids = pedidos.map(pedido => String(pedido.id))
  const lotes: string[][] = []
  for (let inicio = 0; inicio < ids.length; inicio += 100) lotes.push(ids.slice(inicio, inicio + 100))
  await Promise.all(lotes.map(async lote => {
    try {
      const { data, error } = await db.from('pedido_notificacoes').select('pedido_id,evento,criado_em')
        .in('pedido_id', lote).eq('destinatario', 'cliente').in('evento', ['pagamento_aprovado', 'enviado'])
      if (error) throw error
      for (const registro of (data || []) as Confirmacao[]) {
        if (!lote.includes(registro.pedido_id) || !instanteRegistrado(registro.criado_em)) continue
        const anteriores = registros.get(registro.pedido_id) || []
        anteriores.push(registro)
        registros.set(registro.pedido_id, anteriores)
      }
    } catch {
      // Uma falha no histórico não deve impedir a consulta dos pedidos nem do rastreio.
      console.error('[linha-tempo] Horários de confirmação indisponíveis nesta consulta.')
    }
  }))
  return pedidos.map(pedido => {
    const linha: EventoPedido[] = eventosDosItens(pedido.itens)
    if (instanteRegistrado(pedido.created_at)) linha.unshift({ etapa: 'realizado', ocorrido_em: pedido.created_at, data_local: null })
    for (const registro of registros.get(String(pedido.id)) || []) {
      if (Date.parse(registro.criado_em) < Date.parse(pedido.created_at)) continue
      const anterior = linha.find(evento => evento.etapa === registro.evento)
      if (!anterior) linha.push({ etapa: registro.evento, ocorrido_em: registro.criado_em, data_local: null })
      else if (Date.parse(registro.criado_em) < Date.parse(anterior.ocorrido_em!)) anterior.ocorrido_em = registro.criado_em
    }
    const aprovado = pedido.pagamento?.aprovado_em
    if (aprovado && instanteRegistrado(aprovado) && Date.parse(aprovado) >= Date.parse(pedido.created_at)) {
      const anterior = linha.find(e => e.etapa === 'pagamento_aprovado')
      if (anterior) anterior.ocorrido_em = aprovado
      else linha.push({ etapa: 'pagamento_aprovado', ocorrido_em: aprovado, data_local: null })
    }
    return { ...pedido, linha_tempo: linha.sort((a, b) => ordem[a.etapa] - ordem[b.etapa]) }
  })
}
