import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { consumirMfa, emailNormalizado, limitarConta, senhaConfere, senhaForte } from '@/lib/seguranca'
const handler=NextAuth({
 providers:[CredentialsProvider({name:'Credenciais',credentials:{email:{type:'email'},password:{type:'password'},codigo:{type:'text'}},
 async authorize(credentials, req) {
  try {
   const email=emailNormalizado(credentials?.email)
   const headers=new Headers(); for(const [k,v] of Object.entries(req.headers || {})) if(typeof v==='string') headers.set(k,v)
   const request=new Request('https://local.invalid',{headers})
   await limitarConta(request,'login',email)
   const db=getSupabaseAdmin()
   const {data:u,error}=await db.from('usuarios').select('id,nome,email,senha,perfil,role,email_verificado,sessao_versao,bloqueado,senha_politica_versao,mfa_secret').eq('email',email).single()
   const correta=await senhaConfere(credentials?.password,u?.senha || '')
   if(error || !u || !correta || !u.email_verificado || u.bloqueado) throw Error()
   const mfa=!!u.mfa_secret && await consumirMfa(db,u,credentials?.codigo?.trim() || '')
   if(u.mfa_secret && !mfa) throw Error()
   const senhaAtual=senhaForte(credentials?.password)
   if(senhaAtual && u.senha_politica_versao!==1){const {error}=await db.from('usuarios').update({senha_politica_versao:1}).eq('id',u.id); if(error) throw Error()}
   return {id:String(u.id),name:u.nome,email:u.email,role:[u.perfil,u.role].includes('admin')?'admin':'cliente',sessaoVersao:u.sessao_versao,mfa,senhaAtual}
  } catch { throw new Error('Não foi possível entrar. Confira e-mail, senha e código do autenticador, ou aguarde antes de tentar novamente.') }
 }} )],
 session:{maxAge:8*60*60},
 callbacks:{async jwt({token,user}){if(user){token.sub=user.id;token.role=user.role;token.sessaoVersao=user.sessaoVersao;token.mfa=user.mfa;token.senhaAtual=user.senhaAtual}return token},
 async session({session,token}){if(session.user){session.user.role=token.role;session.user.mfa=token.mfa;session.user.senhaAtual=token.senhaAtual} return session}},
 pages:{signIn:'/login'},secret:process.env.NEXTAUTH_SECRET
})
export { handler as GET, handler as POST }
