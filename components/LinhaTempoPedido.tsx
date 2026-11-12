import { CheckCircle2, CircleCheck, Package, Truck, MapPin } from 'lucide-react'
import { horarioEvento, progressoPedido } from '@/lib/linha-tempo-pedido'
import type { EtapaPedido, Pedido } from '@/types/loja'

const etapas: { id: EtapaPedido; titulo: string; icone: typeof CheckCircle2 }[] = [
  { id: 'realizado', titulo: 'Realizado', icone: CheckCircle2 },
  { id: 'pagamento_aprovado', titulo: 'Pagamento aprovado', icone: CircleCheck },
  { id: 'preparando', titulo: 'Preparando', icone: Package },
  { id: 'enviado', titulo: 'Enviado', icone: Truck },
  { id: 'entregue', titulo: 'Entregue', icone: MapPin },
]

export default function LinhaTempoPedido({ pedido }: { pedido: Pedido }) {
  const etapasPedido = pedido.retirada ? [...etapas.slice(0,3),{id:'disponivel_retirada' as const,titulo:'Pronto para retirar',icone:MapPin},{...etapas[4],titulo:'Retirado'}] : etapas
  const progresso = pedido.retirada?.estado === 'disponivel' ? 4 : progressoPedido(pedido.status)
  return <section aria-label={`Status do pedido #${pedido.id}`}>
    <h4 className="mb-2 text-[11px] font-light uppercase tracking-widest text-white md:text-sm">Status do pedido</h4>
    <p className="mb-6 text-[10px] leading-5 text-gray-400">Horários de atualização do pedido, no fuso de Brasília.</p>
    <ol aria-label={`Linha do tempo do pedido #${pedido.id}`} className="grid gap-0 sm:grid-cols-5">
      {etapasPedido.map(({ id, titulo, icone: Icone }, indice) => {
        const evento = pedido.linha_tempo?.find(evento => evento.etapa === id)
        const horario = horarioEvento(evento)
        const concluido = indice < progresso || !!evento
        const proximoConcluido = indice + 1 < progresso || !!pedido.linha_tempo?.some(evento => evento.etapa === etapasPedido[indice + 1]?.id)
        return <li key={id} aria-current={indice === progresso - 1 ? 'step' : undefined}
          className="relative grid min-w-0 grid-cols-[2rem_1fr] gap-x-3 pb-6 last:pb-0 sm:flex sm:flex-col sm:items-center sm:gap-0 sm:px-1 sm:pb-0 sm:text-center">
          {indice < etapasPedido.length - 1 && <span aria-hidden="true" className={`absolute bottom-0 left-4 top-8 w-px sm:bottom-auto sm:left-1/2 sm:top-4 sm:h-px sm:w-full ${proximoConcluido ? 'bg-hb-gold/60' : 'bg-gray-800'}`} />}
          <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-hb-black ${concluido ? 'border-hb-gold text-hb-gold' : 'border-gray-700 text-gray-500'}`}>
            <Icone size={14} aria-hidden="true" />
          </span>
          <div className="min-w-0 pt-1 sm:mt-3 sm:pt-0">
            <p className={`text-[10px] font-bold uppercase leading-4 tracking-wider sm:min-h-8 ${concluido ? 'text-white' : 'text-gray-400'}`}>{titulo}</p>
            {horario ? <>
              <time dateTime={horario.dateTime} className="mt-1 block text-xs tabular-nums text-gray-300">
                {horario.data}{horario.hora && <span className="ml-2 font-medium text-hb-gold sm:ml-0 sm:mt-1 sm:block">às {horario.hora}</span>}
              </time>
              {!horario.hora && <span className="mt-1 block text-[10px] leading-4 text-gray-400">Horário não registrado</span>}
            </> : <span className="mt-1 block text-[10px] leading-4 text-gray-400">{concluido ? 'Horário não registrado' : 'Aguardando'}</span>}
          </div>
        </li>
      })}
    </ol>
  </section>
}
