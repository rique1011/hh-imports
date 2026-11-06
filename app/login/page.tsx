'use client'

import { getSession, signIn } from 'next-auth/react'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function PaginaLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [codigo,setCodigo]=useState('')
  const [solicitarAutenticador,setSolicitarAutenticador]=useState(false)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const fazerLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCarregando(true)
    setErro('')

    const resultado = await signIn('credentials', {
      redirect: false,
      email: email,
      password: senha, codigo,
    })

    if (resultado?.error) {
      if(resultado.error==='ADMIN_MFA_REQUIRED'){
        setSolicitarAutenticador(true)
        setErro('Confirme o código do aplicativo para acessar sua conta de administrador.')
      }else setErro(solicitarAutenticador ? 'Não foi possível confirmar o acesso. Confira a senha e o código do aplicativo ou use um código de recuperação.' : 'Não foi possível entrar. Confira seu e-mail e senha ou tente novamente em alguns minutos.')
      setCarregando(false)
    } else {
      const session=await getSession()
      router.push(session?.user?.role==='admin' && (session.user.senhaAtual===false || !session.user.mfa) ? '/minha-conta?aba=seguranca' : session?.user?.senhaAtual===false ? '/minha-conta?aba=dados' : '/minha-conta?aba=pedidos')
    }
  }

  return (
    <main className="min-h-[80vh] flex items-center justify-center bg-hb-black px-4 md:px-6 py-8 md:py-12">
      <div className="max-w-md w-full bg-hb-gray p-6 md:p-8 rounded-xl shadow-sm border border-gray-800">
        <h1 className="text-xl md:text-2xl font-light text-center text-white mb-6 md:mb-8 tracking-widest uppercase italic">
          Entrar na minha conta
        </h1>

        <form onSubmit={fazerLogin} className="space-y-5 md:space-y-6">
          {erro && (
            <div className="p-3 bg-red-900/20 text-red-500 text-xs md:text-sm font-medium rounded text-center border border-red-800/30">
              {erro}
            </div>
          )}

          <div>
            <label className="block text-[10px] md:text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {setEmail(e.target.value.toLowerCase());setSolicitarAutenticador(false);setCodigo('')}}
              className="w-full bg-hb-black text-white text-base md:text-sm border border-gray-700 p-3 rounded focus:outline-none focus:border-hb-gold transition"
              required
            />
          </div>

          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-1 sm:gap-0">
              <label className="block text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest">Senha</label>
              <Link href="/esqueci-senha" className="text-[10px] md:text-xs font-bold text-hb-gold hover:text-hb-goldLight transition uppercase tracking-widest inline-block py-1 sm:py-0">
                Esqueceu a senha?
              </Link>
            </div>
            <input
              type="password"
              value={senha}
              onChange={(e) => {setSenha(e.target.value);setSolicitarAutenticador(false);setCodigo('')}}
              className="w-full bg-hb-black text-white text-base md:text-sm border border-gray-700 p-3 rounded focus:outline-none focus:border-hb-gold transition"
              required
            />
          </div>

          {solicitarAutenticador && <label className="block text-xs text-gray-400">Código do autenticador do administrador<input value={codigo} onChange={e=>setCodigo(e.target.value.trim())} autoComplete="one-time-code" autoFocus required className="mt-2 w-full rounded border border-gray-700 bg-hb-black p-3 text-base text-white" /><span className="block text-[11px] mt-2">Se perdeu o acesso ao aplicativo, use um dos seus códigos de recuperação.</span></label>}
          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-hb-gold text-hb-black font-bold text-xs md:text-sm tracking-widest uppercase py-3 md:py-4 rounded hover:bg-hb-goldLight transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {carregando ? (
              <><Loader2 className="animate-spin" size={16} /> ENTRANDO...</>
            ) : (
              solicitarAutenticador ? 'CONFIRMAR ACESSO' : 'ENTRAR'
            )}
          </button>
        </form>

        <div className="mt-6 md:mt-8 pt-5 md:pt-6 border-t border-gray-800 text-center space-y-4">
          <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-widest border-b border-gray-800 pb-4 leading-relaxed">
            Ainda não tem uma conta? <br className="sm:hidden" />
            <Link href="/cadastro" className="text-white font-bold hover:text-hb-gold transition inline-block py-1 sm:py-0 sm:ml-1">
              Cadastre-se aqui
            </Link>
          </p>
          <div>
            <Link href="/" className="text-[9px] md:text-[10px] text-gray-500 font-bold hover:text-hb-gold transition tracking-[0.2em] uppercase p-2 inline-block">
              Voltar para a loja
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
