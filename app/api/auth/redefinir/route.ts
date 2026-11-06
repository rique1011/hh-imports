import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import bcrypt from 'bcryptjs'
import { validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
import { hash, lerJson, limitar, validarSenha } from '@/lib/seguranca'
export async function POST(request: Request){try{
 validarOrigem(request); await limitar(request,'redefinir',10,900)
 const {token,novaSenha}=await lerJson(request)
 if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token)) throw new ErroHttp(400,'Link inválido ou expirado.')
 validarSenha(novaSenha)
 const {data,error}=await getSupabaseAdmin().rpc('hh_redefinir_senha',{p_token:hash(token),p_senha:await bcrypt.hash(novaSenha,12)})
 if(error) throw Error('Recuperação indisponível.'); if(!data) throw new ErroHttp(400,'Link inválido, já utilizado ou expirado. Solicite outro.')
 return NextResponse.json({success:true})
}catch(e){return responderErro(e)}}
