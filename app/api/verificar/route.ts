import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
import { codigoVerificacao, emailNormalizado, lerJson, limitarConta } from '@/lib/seguranca'
export async function POST(request: Request){try{
 validarOrigem(request); const body=await lerJson(request),email=emailNormalizado(body.email)
 await limitarConta(request,'verificar',email,10,900)
 if(typeof body.codigo!=='string'||!/^\d{6}$/.test(body.codigo)) throw new ErroHttp(400,'Código inválido ou expirado.')
 const {data,error}=await getSupabaseAdmin().rpc('hh_verificar_email',{p_email:email,p_codigo:codigoVerificacao(email,body.codigo)})
 if(error) throw Error('Verificação indisponível.'); if(!data) throw new ErroHttp(400,'Código inválido ou expirado. Solicite novo cadastro para reenviar.')
 return NextResponse.json({sucesso:true})
}catch(e){return responderErro(e)}}
