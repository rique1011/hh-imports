import 'server-only'
import { ambienteMelhorEnvio, melhorEnvio } from '@/lib/melhor-envio'
import { dataEntregaDosItens, dataRecebimentoValida, diaNaLoja } from '@/lib/prazo-devolucao'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { ItemPedido } from '@/types/loja'

type Db = ReturnType<typeof getSupabaseAdmin>
interface PedidoRastreado {
  id: string | number; status: string; itens: ItemPedido[]; codigo_rastreio: string | null; created_at: string
}
interface EnvioRastreado {
  pedido_id: string | number; me_id: string; ambiente: string; codigo_rastreio: string | null; atualizado_em: string
  pedido: PedidoRastreado
}
export interface RastreioMelhorEnvio {
  id: string; status: string; tracking?: string | null; delivered_at?: string | null
  created_at?: string | null; paid_at?: string | null; generated_at?: string | null; posted_at?: string | null
}
const CAMPOS_ENVIO = 'pedido_id,me_id,ambiente,codigo_rastreio,atualizado_em,pedido:pedidos!inner(id,status,itens,codigo_rastreio,created_at)'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Exige fuso explícito: a data da consulta nunca substitui a data da transportadora.
export function instanteEntrega(valor: unknown, agora = new Date()): Date | null {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(valor)
    || !dataRecebimentoValida(valor.slice(0, 10))) return null
  const instante = new Date(valor)
  return Number.isFinite(instante.getTime()) && instante <= agora ? instante : null
}

export async function registrarRecebimento(db: Db, envio: EnvioRastreado, remoto: RastreioMelhorEnvio, agora = new Date()) {
  if (envio.ambiente !== 'production' || ambienteMelhorEnvio() !== 'production' || remoto.id !== envio.me_id
    || remoto.status !== 'delivered' || !UUID.test(envio.me_id)) return false
  const instante = instanteEntrega(remoto.delivered_at, agora)
  if (!instante) return false
  // Releitura após a consulta externa, para respeitar correções e cancelamentos concorrentes.
  const { data: pedido, error } = await db.from('pedidos').select('id,status,itens,codigo_rastreio,created_at')
    .eq('id', envio.pedido_id).maybeSingle()
  if (error) throw new Error('Falha ao conferir o recebimento do pedido.')
  if (!pedido || !['enviado', 'entregue'].includes(pedido.status) || !pedido.codigo_rastreio
    || pedido.codigo_rastreio !== envio.codigo_rastreio
    || (remoto.tracking && remoto.tracking !== pedido.codigo_rastreio)
    || !Array.isArray(pedido.itens) || !pedido.itens.length
    || pedido.itens.some(item => !item || typeof item !== 'object')
    || !Number.isFinite(Date.parse(pedido.created_at)) || instante.getTime() < Date.parse(pedido.created_at)) return false
  // Datas já conferidas não são reescritas em retentativas; metadados parciais pedem revisão manual.
  const registrada = dataEntregaDosItens(pedido.itens)
  if (registrada || pedido.itens.some(item => item.data_recebimento != null)) return false
  const itens = pedido.itens.map(item => ({ ...item, data_recebimento: diaNaLoja(instante),
    recebimento_origem: 'melhor_envio', recebimento_confirmado_em: instante.toISOString() }))
  const { data, error: updateError } = await db.from('pedidos').update({ status: 'entregue', itens })
    .eq('id', pedido.id).eq('status', pedido.status).eq('codigo_rastreio', pedido.codigo_rastreio)
    .eq('itens', JSON.stringify(pedido.itens)).select('id')
  if (updateError) throw new Error('Falha ao registrar o recebimento do pedido.')
  // Status e data são atômicos. O trigger existente enfileira o e-mail, com deduplicação.
  return !!data?.length
}

export async function sincronizarRecebimentos(db: Db, opcoes: { clienteEmail?: string; limite?: number } = {}) {
  const total = { consultadas: 0, entregues: 0, falhas: 0 }
  if (!process.env.MELHOR_ENVIO_TOKEN?.trim() || ambienteMelhorEnvio() !== 'production') return total
  const limite = Math.min(30, Math.max(1, Math.trunc(opcoes.limite || 30)))
  let query = db.from('pedido_envios').select(CAMPOS_ENVIO)
    .eq('ambiente', 'production').eq('estado', 'pronta').is('lease_id', null)
    .eq('pedido.status', 'enviado').lt('atualizado_em', new Date(Date.now() - 15 * 60_000).toISOString())
  if (opcoes.clienteEmail) query = query.eq('pedido.cliente_email', opcoes.clienteEmail)
  const { data, error } = await query.order('atualizado_em', { ascending: true }).limit(limite)
  if (error) throw new Error('Falha ao consultar entregas pendentes.')
  const envios = (data || []) as unknown as EnvioRastreado[]
  // Cinco consultas simultâneas, até seis lotes de 15 s, dentro da duração do cron.
  for (let inicio = 0; inicio < envios.length; inicio += 5) {
    await Promise.all(envios.slice(inicio, inicio + 5).map(async envio => {
      if (!UUID.test(envio.me_id || '') || !envio.codigo_rastreio
        || envio.codigo_rastreio !== envio.pedido.codigo_rastreio) return
      try {
        // Compare-and-swap durável impede consultas repetidas por abas/instâncias concorrentes.
        // Em etiquetas prontas este timestamp serve também para ordenar a próxima conferência.
        const { data: claim, error: claimError } = await db.from('pedido_envios')
          .update({ atualizado_em: new Date().toISOString() }).eq('pedido_id', envio.pedido_id)
          .eq('me_id', envio.me_id).eq('atualizado_em', envio.atualizado_em)
          .eq('estado', 'pronta').is('lease_id', null).select('pedido_id')
        if (claimError) throw new Error('Falha ao reservar conferência.')
        if (!claim?.length) return
        total.consultadas++
        const remoto = await melhorEnvio<RastreioMelhorEnvio>('/orders/' + encodeURIComponent(envio.me_id))
        if (await registrarRecebimento(db, envio, remoto)) total.entregues++
        else if (remoto.id !== envio.me_id || (remoto.status === 'delivered' && !instanteEntrega(remoto.delivered_at))) total.falhas++
      } catch {
        total.falhas++
        console.error('[recebimento] Conferência pendente; próxima execução tentará novamente.', { pedidoId: envio.pedido_id })
      }
    }))
  }
  return total
}
