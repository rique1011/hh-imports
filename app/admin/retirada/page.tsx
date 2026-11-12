'use client'
import { useEffect, useState } from 'react'
import { Loader2, Store } from 'lucide-react'
import toast from 'react-hot-toast'
import { RETIRADA_PADRAO } from '@/lib/retirada'
import { ESTADOS } from '@/lib/enderecos'
import type { ConfigRetirada } from '@/types/retirada'

const campo = 'mt-2 min-h-11 w-full rounded border border-luxury-line bg-hb-black p-3 text-base text-white outline-none focus:border-hb-gold'
export default function ConfigurarRetirada() {
  const [config, setConfig] = useState<ConfigRetirada>(RETIRADA_PADRAO)
  const [carregando, setCarregando] = useState(true), [salvando, setSalvando] = useState(false), [erro, setErro] = useState('')
  async function carregar() {
    await fetch('/api/admin/retirada',{cache:'no-store'}).then(async r=>{
      const b=await r.json();if(!r.ok)throw Error(b.error)
      setConfig({...b.config,endereco:Object.keys(b.config.endereco).length?b.config.endereco:b.sugestaoEndereco||{}});setErro('')
    }).catch(e=>setErro(e instanceof Error?e.message:'Não foi possível carregar a configuração.')).finally(()=>setCarregando(false))
  }
  useEffect(()=>{void carregar()},[])
  async function salvar(e: React.FormEvent) {
    e.preventDefault();setSalvando(true)
    try {
      const r=await fetch('/api/admin/retirada',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'configurar',...config})}),b=await r.json()
      if(!r.ok)throw Error(b.error);setConfig(b.config);toast.success('Retirada presencial atualizada no checkout.')
    } catch(e){toast.error(e instanceof Error?e.message:'Não foi possível salvar a retirada.')}finally{setSalvando(false)}
  }
  return <main className="max-w-3xl text-luxury-ivory">
    <h1 className="flex items-center gap-3 font-serif text-3xl"><Store className="shrink-0 text-hb-gold"/>Retirada presencial</h1>
    <p className="my-5 text-sm leading-7 text-luxury-muted">Confira o endereço e os horários antes de ativar. O endereço de expedição pode aparecer como sugestão. Apenas o endereço confirmado aqui será mostrado ao cliente.</p>
    {carregando?<Loader2 className="animate-spin" aria-label="Carregando retirada"/>:erro?<div role="alert">{erro}<button className="block min-h-11 text-hb-gold underline" onClick={carregar}>Tentar novamente</button></div>:<form onSubmit={salvar} className="rounded-xl border border-luxury-gold/25 bg-luxury-surface p-4 sm:p-6">
      <fieldset disabled={salvando} className="min-w-0 space-y-5">
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-hb-gold" checked={config.ativa} onChange={e=>setConfig({...config,ativa:e.target.checked})}/>Oferecer retirada presencial no checkout</label>
        <label className="block text-sm">Nome do local<input required minLength={3} maxLength={120} className={campo} value={config.local} onChange={e=>setConfig({...config,local:e.target.value})}/></label>
        <div className="grid gap-4 sm:grid-cols-2">{([['cep','CEP'],['logradouro','Rua'],['numero','Número'],['complemento','Complemento (opcional)'],['bairro','Bairro'],['cidade','Cidade']] as const).map(([key,label])=><label key={key} className="block min-w-0 text-sm">{label}<input required={key!=='complemento'} inputMode={key==='cep'?'numeric':undefined} maxLength={key==='cep'?9:120} className={campo} value={config.endereco[key]||''} onChange={e=>setConfig({...config,endereco:{...config.endereco,[key]:e.target.value}})}/></label>)}</div>
        <label className="block text-sm">Estado<select required value={config.endereco.uf||''} onChange={e=>setConfig({...config,endereco:{...config.endereco,uf:e.target.value}})} className={campo}><option value="">Selecione</option>{ESTADOS.map(uf=><option key={uf}>{uf}</option>)}</select></label>
        <div><label htmlFor="retirada-instrucoes" className="block text-sm">Horários e instruções de agendamento</label><textarea id="retirada-instrucoes" required minLength={3} maxLength={600} rows={4} value={config.instrucoes} onChange={e=>setConfig({...config,instrucoes:e.target.value})} className={campo}/></div>
        <label className="block text-sm">Prazo para retirar (dias corridos após o aviso)<input type="number" required min={7} max={60} step={1} className={campo} value={config.prazo_dias} onChange={e=>setConfig({...config,prazo_dias:Number(e.target.value)})}/></label>
        <div className="rounded border border-luxury-line p-4 text-xs leading-6 text-luxury-muted">Esse prazo é uma política da loja, não um prazo legal geral. A contagem começa após o envio do aviso de disponibilidade. Há lembrete antes do vencimento; se não houver retirada, o sistema solicita reembolso integral pelo pagamento original, sem multa. Os créditos usados voltam ao saldo. O processamento automático roda diariamente e pode aguardar o provedor. Pedidos anteriores preservam as condições aceitas na compra.</div>
        <button type="submit" className="luxury-button luxury-button-solid w-full">{salvando?<Loader2 size={18} className="animate-spin"/>:'Salvar retirada presencial'}</button>
      </fieldset>
    </form>}
  </main>
}
