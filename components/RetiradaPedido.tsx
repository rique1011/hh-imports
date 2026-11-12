'use client'
import { useState } from 'react'
import { Loader2, Store } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/Modal'
import type { Pedido } from '@/types/loja'
import { textoEndereco } from '@/lib/enderecos'
import { dataRetirada } from '@/lib/retirada'
export default function RetiradaPedidoInfo({pedido,onAtualizado,admin=false}:{pedido:Pedido;onAtualizado:()=>Promise<void>|void;admin?:boolean}){
  const r=pedido.retirada
  const [ocupado,setOcupado]=useState(false),[confirmar,setConfirmar]=useState(false),[codigo,setCodigo]=useState('')
  if(!r)return null
  const pago=['pago','confirmado','processando'].includes(pedido.status)&&!pedido.pagamento?.requer_revisao
  async function agir(acao:string){
    setOcupado(true)
    try{
      const res=await fetch(admin?'/api/admin/retirada':'/api/pedidos/'+encodeURIComponent(pedido.id)+'/retirada',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(admin?{acao,pedidoId:String(pedido.id),versao:r!.versao,codigo}:{confirmar:true,versao:r!.versao})}),b=await res.json()
      if(!res.ok)throw Error(b.error);setConfirmar(false);toast.success(acao==='cancelar'?'Cancelamento registrado. Acompanhe o reembolso neste pedido.':'Retirada atualizada.');await onAtualizado()
    }catch(e){toast.error(e instanceof Error?e.message:'Não foi possível atualizar a retirada.')}finally{setOcupado(false)}
  }
  return <section aria-label={'Retirada do pedido #'+pedido.id} className="mb-6 min-w-0 rounded-xl border border-hb-gold/35 bg-hb-gold/5 p-4 text-sm leading-6 sm:p-6">
    <h3 className="mb-3 flex items-center gap-2 font-serif text-xl text-hb-goldLight"><Store size={20}/>Retirada presencial</h3>
    <p className="break-words text-white">{r.local}</p><p className="break-words text-gray-300">{textoEndereco(r.endereco)}</p><p className="mt-2 whitespace-pre-line text-gray-300">{r.instrucoes}</p>
    {r.estado==='aguardando_preparo'&&<p className="mt-4 text-hb-goldLight">{pago?'Pagamento confirmado. Aguarde o aviso de que o pedido está pronto antes de se deslocar.':'A retirada será preparada após a confirmação do pagamento.'}</p>}
    {r.estado==='disponivel'&&<div className="mt-4 space-y-3"><p className="font-medium text-hb-goldLight">Pronto para retirar{r.prazo_final?' até '+dataRetirada(r.prazo_final):'. O prazo começa após o envio do aviso.'}</p>{r.codigo&&!admin&&<div><p className="text-xs text-gray-400">Informe este código somente ao receber as peças:</p><strong className="mt-2 inline-block rounded border border-hb-gold/40 bg-hb-black px-5 py-3 font-mono text-xl tracking-[0.2em] text-hb-goldLight">{r.codigo}</strong></div>}</div>}
    {r.estado==='retirado'&&<p className="mt-4 text-hb-goldLight">Retirado em {dataRetirada(r.retirado_em)}. A contagem do prazo de arrependimento considera esse recebimento.</p>}
    {r.estado==='reembolso_pendente'&&<p role="status" className="mt-4 text-amber-200">Cancelamento registrado. O reembolso está em processamento. A retirada já não está disponível. O valor só será marcado como devolvido após a confirmação do provedor.</p>}
    {r.estado==='cancelado'&&<p className="mt-4 text-green-300">Cancelamento com reembolso confirmado em {dataRetirada(r.reembolsado_em)}. O prazo para aparecer na conta ou fatura depende do meio de pagamento. Os créditos usados foram devolvidos ao saldo.</p>}
    {admin&&r.erro&&<p role="alert" className="mt-4 text-red-300">{r.erro}</p>}
    {admin&&pago&&r.estado==='aguardando_preparo'&&<button disabled={ocupado} onClick={()=>agir('pronto')} className="luxury-button luxury-button-solid mt-5 w-full">{ocupado?<Loader2 className="animate-spin" size={18}/>:'Marcar pronto e avisar cliente'}</button>}
    {admin&&pago&&r.estado==='disponivel'&&<form onSubmit={e=>{e.preventDefault();void agir('retirado')}} className="mt-5 space-y-3"><label className="block">Código apresentado pelo cliente<input required pattern="[a-fA-F0-9]{8}" maxLength={8} value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase())} autoComplete="off" className="mt-2 min-h-11 w-full rounded border border-gray-700 bg-hb-black p-3 font-mono text-base text-white"/></label><p className="text-xs text-gray-400">Confirme a identidade do comprador e registre somente na entrega física das peças.</p><button disabled={ocupado} className="luxury-button luxury-button-solid w-full">{ocupado?<Loader2 className="animate-spin" size={18}/>:'Confirmar entrega presencial'}</button></form>}
    {admin&&r.estado==='reembolso_pendente'&&<button disabled={ocupado} onClick={()=>agir('retomar')} className="luxury-button luxury-button-outline mt-5 w-full">{ocupado?'Consultando…':'Consultar e retomar reembolso'}</button>}
    {!admin&&pago&&['aguardando_preparo','disponivel'].includes(r.estado)&&<button disabled={ocupado} onClick={()=>setConfirmar(true)} className="mt-4 min-h-11 text-sm text-hb-goldLight underline">Cancelar retirada e solicitar reembolso</button>}
    {confirmar&&<Modal onClose={()=>{if(!ocupado)setConfirmar(false)}} labelledBy={'cancelar-retirada-'+pedido.id} className="w-full max-w-md border border-hb-gold/30 bg-hb-black p-6 text-white"><h3 id={'cancelar-retirada-'+pedido.id} className="font-serif text-2xl text-hb-goldLight">Cancelar esta retirada?</h3><p className="my-5 text-sm leading-7 text-gray-300">O pedido não poderá mais ser retirado. Solicitaremos o reembolso integral pelo meio de pagamento original. O prazo para receber depende do provedor; créditos usados voltam ao saldo da loja.</p><button disabled={ocupado} onClick={()=>agir('cancelar')} className="luxury-button luxury-button-solid w-full">{ocupado?'Registrando…':'Confirmar cancelamento'}</button><button disabled={ocupado} onClick={()=>setConfirmar(false)} className="luxury-button luxury-button-outline mt-3 w-full">Manter meu pedido</button></Modal>}
  </section>
}
