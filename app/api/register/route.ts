import { NextResponse, after } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import bcrypt from 'bcryptjs'
import { enviarEmailLoja, escapeHtml } from '@/lib/mail'
import { validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
import { codigoVerificacao, emailNormalizado, lerJson, limitarConta, novoCodigo, validarSenha } from '@/lib/seguranca'
export async function POST(request: Request) {
 try {
  validarOrigem(request)
  const {nome,email:raw,senha}=await lerJson(request); const email=emailNormalizado(raw)
  if(typeof nome!=='string' || nome.trim().length<2 || nome.length>100) throw new ErroHttp(400,'Informe seu nome.')
  await limitarConta(request,'cadastro',email,3,3600); validarSenha(senha)
  const codigo=novoCodigo(), senhaHash=await bcrypt.hash(senha,12)
  const {data,error}=await getSupabaseAdmin().rpc('hh_cadastrar',{p_email:email,p_nome:nome.trim(),p_senha:senhaHash,p_codigo:codigoVerificacao(email,codigo)})
  if(error) throw Error('Falha ao cadastrar.')
  after(async()=>{if(data)try{const envio=await enviarEmailLoja(email,'Confirme seu cadastro na H&H IMPORTS',`<p>Olá, ${escapeHtml(nome)}.</p><p>Seu código é <strong>${codigo}</strong>. Ele expira em 15 minutos e permite até cinco tentativas.</p>`);if(!envio.sucesso)console.error('[cadastro] Envio indisponível.')}catch{console.error('[cadastro] Envio indisponível.')}})
  return NextResponse.json({sucesso:true,mensagem:'Se o e-mail estiver disponível, você receberá um código. Para uma conta existente, faça login ou recupere a senha.'})
 }catch(e){return responderErro(e)}
}
