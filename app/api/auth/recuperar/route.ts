import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { enviarEmailStatus } from '@/lib/mail'
import { validarOrigem, responderErro } from '@/lib/autorizacao'
import { emailNormalizado, hash, lerJson, limitarConta } from '@/lib/seguranca'
export async function POST(request: Request){try{
 validarOrigem(request); const body=await lerJson(request),email=emailNormalizado(body.email)
 await limitarConta(request,'recuperar',email,3,3600)
 const db=getSupabaseAdmin(),token=randomBytes(32).toString('hex')
 const {data:u,error}=await db.from('usuarios').update({recovery_token:hash(token),recovery_token_expires:new Date(Date.now()+3600000).toISOString()}).eq('email',email).eq('bloqueado',false).select('email,nome').maybeSingle()
 if(error) throw Error('Recuperação indisponível.')
 if(u) await enviarEmailStatus(u.email,u.nome,'recuperacao',token)
 return NextResponse.json({success:true})
}catch(e){return responderErro(e)}}
