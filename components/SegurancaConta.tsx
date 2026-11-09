'use client'
import Image from 'next/image'
import CampoSenha from '@/components/CampoSenha'
import { MIN_SENHA_ADMIN } from '@/lib/politica-senha'
import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
export default function SegurancaConta(){
 const [ativa,setAtiva]=useState(false),[senha,setSenha]=useState(''),[nova,setNova]=useState(''),[codigo,setCodigo]=useState(''),[erro,setErro]=useState(''),[busy,setBusy]=useState(false)
 const [setup,setSetup]=useState<{secret:string;qr:string}|null>(null),[codigos,setCodigos]=useState<string[]>([])
 useEffect(()=>{fetch('/api/usuario/seguranca').then(async r=>{if(!r.ok)throw Error();return r.json()}).then(d=>setAtiva(!!d.mfaAtiva)).catch(()=>setErro('Não foi possível carregar a segurança.'))},[])
 async function agir(acao:string){setBusy(true);setErro('');try{
  const r=await fetch('/api/usuario/seguranca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao,senha,novaSenha:nova,codigo})});const d=await r.json();if(!r.ok)throw Error(d.error||'Falha na operação.')
  if(d.codigos){setCodigos(d.codigos);setSetup(null);setSenha('');setCodigo('');return}
  if(d.secret){setSetup(d);setCodigo('')}
  if(d.entrarNovamente)await signOut({callbackUrl:'/login'})
 }catch(e){setErro(e instanceof Error?e.message:'Tente novamente.')}finally{setBusy(false)}}
 const input='w-full rounded border border-gray-700 bg-hb-black p-3 text-base text-white'
 return <section className="space-y-6 max-w-xl"><h2 className="text-xl text-hb-gold">Segurança do administrador</h2>
 <p className="text-sm text-gray-300">Use uma senha exclusiva de pelo menos 15 caracteres. Para administrar a loja, ative um aplicativo autenticador, como Google Authenticator ou Microsoft Authenticator.</p>
 {erro&&<p role="alert" className="text-red-300">{erro}</p>}
 {codigos.length>0?<div className="space-y-4"><p>Autenticador ativado. Guarde estes códigos em um local seguro. Cada um funciona uma única vez se você perder o celular. Eles não serão exibidos novamente.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-sm break-all">{codigos.map(c=><code key={c}>{c}</code>)}</div><button className="btn-luxury p-3" onClick={()=>signOut({callbackUrl:'/login'})}>Guardei os códigos. Entrar novamente</button></div>:<>
 <div className="block text-sm space-y-2"><label htmlFor="admin-senha-atual">Senha atual</label><CampoSenha id="admin-senha-atual" nomeCampo="senha atual" className={input} autoComplete="current-password" value={senha} onChange={e=>setSenha(e.target.value)} /></div>
 {(ativa||setup)&&<label className="block text-sm space-y-2"><span>Código do aplicativo{ativa?' ou código de recuperação':''}</span><input className={input} autoComplete="one-time-code" value={codigo} onChange={e=>setCodigo(e.target.value.trim())}/></label>}
 {setup?<div className="space-y-4"><p>Escaneie no aplicativo e confirme o código de seis dígitos. A configuração expira em dez minutos.</p>{/* QR local, sem serviço de terceiros. */}
 <Image unoptimized src={setup.qr} alt="QR para configurar o autenticador" width={220} height={220}/><p className="text-sm break-all">Chave manual: <code>{setup.secret}</code></p><button disabled={busy} className="btn-luxury p-3" onClick={()=>agir('ativar')}>Confirmar e ativar</button></div>:<button disabled={busy||!senha} className="btn-luxury p-3" onClick={()=>agir(ativa?'desativar':'configurar')}>{ativa?'Desativar autenticador':'Configurar autenticador'}</button>}
 <div className="border-t border-gray-800 pt-6 space-y-3"><div className="block text-sm space-y-2"><label htmlFor="admin-nova-senha">Nova senha (pelo menos {MIN_SENHA_ADMIN} caracteres)</label><CampoSenha id="admin-nova-senha" nomeCampo="nova senha" className={input} minLength={MIN_SENHA_ADMIN} autoComplete="new-password" value={nova} onChange={e=>setNova(e.target.value)}/></div><button disabled={busy||!senha||[...nova].length<MIN_SENHA_ADMIN} className="btn-luxury p-3" onClick={()=>agir('senha')}>Atualizar senha e sair dos dispositivos</button></div>
 <button disabled={busy||!senha} className="text-sm text-hb-gold underline min-h-11" onClick={()=>agir('sair')}>Sair de todos os dispositivos</button>
 {busy&&<p role="status">Processando…</p>}</>}
 </section>
}
