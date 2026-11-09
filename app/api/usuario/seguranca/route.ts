import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import * as OTPAuth from 'otpauth'
import bcrypt from 'bcryptjs'
import QRCode from 'qrcode'
import { exigirUsuario, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
import { cifrarMfa, consumirMfa, decifrarMfa, hash, lerJson, limitar, passoMfa, senhaConfere, totp, validarSenha } from '@/lib/seguranca'
const headers={'Cache-Control':'no-store'}
export async function GET(request: Request){try{ const user=await exigirUsuario(request,true); if(!user.administrador)throw new ErroHttp(403,'Acesso restrito ao administrador.'); return NextResponse.json({mfaAtiva:user.mfaAtiva,admin:true},{headers}) }catch(e){return responderErro(e)}}
export async function POST(request: Request){try{
 validarOrigem(request); const user=await exigirUsuario(request,true)
 await limitar(request,'seguranca',10,900,String(user.id)); const body=await lerJson(request)
 if(!user.administrador && !['senha','sair'].includes(String(body.acao))) throw new ErroHttp(403,'Autenticador disponível somente para administradores.')
 const {data:u,error}=await user.db.from('usuarios').select('id,email,senha,mfa_secret,mfa_pendente,mfa_pendente_expires,sessao_versao').eq('id',user.id).single()
 if(error||!u||u.sessao_versao!==user.versao) throw new ErroHttp(401,'Entre novamente.')
 if(body.acao==='ativar'){
  if(u.mfa_secret || !u.mfa_pendente || Date.parse(u.mfa_pendente_expires || '')<=Date.now()) throw new ErroHttp(409,'Inicie uma nova configuração.')
  if(typeof body.codigo!=='string'||passoMfa(decifrarMfa(u.mfa_pendente),body.codigo)===null) throw new ErroHttp(400,'Código inválido.')
  const codigos=Array.from({length:10},()=>randomBytes(10).toString('hex'))
  const {data,error}=await user.db.from('usuarios').update({mfa_secret:u.mfa_pendente,mfa_pendente:null,mfa_pendente_expires:null,mfa_recuperacao:codigos.map(hash),mfa_ultimo_passo:-1})
   .eq('id',user.id).eq('mfa_pendente',u.mfa_pendente).eq('sessao_versao',user.versao).select('id')
  if(error||!data?.length) throw new ErroHttp(409,'Configuração alterada. Entre novamente.')
  return NextResponse.json({codigos,entrarNovamente:true},{headers})
 }
 if(!await senhaConfere(body.senha,u.senha)) throw new ErroHttp(400,'Não foi possível confirmar suas credenciais.')
 if(body.acao==='senha')validarSenha(body.novaSenha,user.administrador)
 if(user.administrador && u.mfa_secret && !await consumirMfa(user.db,u,String(body.codigo||'').trim())) throw new ErroHttp(400,'Confirme o código do autenticador ou de recuperação.')
 if(body.acao==='configurar'){
  if(u.mfa_secret) throw new ErroHttp(409,'Autenticador já ativo.')
  const secret=new OTPAuth.Secret({size:20}).base32,encrypted=cifrarMfa(secret)
  const {error}=await user.db.from('usuarios').update({mfa_pendente:encrypted,mfa_pendente_expires:new Date(Date.now()+600000).toISOString()}).eq('id',user.id).eq('sessao_versao',user.versao)
  if(error) throw Error('Falha na configuração.')
  return NextResponse.json({secret,qr:await QRCode.toDataURL(totp(secret,user.email).toString())},{headers})
 }
 const values:Record<string,unknown>={sessao_versao:user.versao+1}
 if(body.acao==='senha'){values.senha=await bcrypt.hash(String(body.novaSenha),12);values.senha_politica_versao=1}
 else if(body.acao==='desativar'){values.mfa_secret=null;values.mfa_recuperacao=[];values.mfa_ultimo_passo=-1}
 else if(body.acao!=='sair') throw new ErroHttp(400,'Ação inválida.')
 const {data,error:update}=await user.db.from('usuarios').update(values).eq('id',user.id).eq('sessao_versao',user.versao).select('id')
 if(update||!data?.length) throw new ErroHttp(409,'Sessão alterada. Entre novamente.')
 return NextResponse.json({sucesso:true,entrarNovamente:true},{headers})
}catch(e){return responderErro(e)}}
