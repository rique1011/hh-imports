'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'

export default function PaginaEsqueciSenha() {
  const [email, setEmail] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')

  const handleRecuperarSenha = async (e: React.FormEvent) => {
    e.preventDefault()
    setCarregando(true)
    setErro('')

    try {
      const res = await fetch('/api/auth/recuperar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      if (res.ok) {
        setSucesso(true)
      } else {
        const data = await res.json()
        setErro(data.error || "Não encontramos uma conta com este e-mail.")
      }
    } catch (error) {
      setErro("Erro de conexão. Tente novamente.")
    } finally {
      setCarregando(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-hb-black py-10 md:py-12 px-4 md:px-6">
      <div className="max-w-md w-full bg-hb-gray p-6 md:p-8 rounded-2xl border border-gray-800 shadow-sm animate-in fade-in zoom-in-95 duration-500">
        
        <Link href="/login" className="inline-flex items-center gap-2 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-hb-gold transition mb-6 md:mb-8">
          <ArrowLeft size={14} className="md:w-4 md:h-4" /> Voltar ao Login
        </Link>

        {!sucesso ? (
          <>
            <div className="mb-6 md:mb-8">
              <h1 className="text-xl md:text-2xl font-light text-white uppercase tracking-widest italic mb-2">
                Recuperar Senha
              </h1>
              <p className="text-[10px] md:text-xs text-gray-400 leading-relaxed">
                Digite o e-mail cadastrado e enviaremos as instruções para você redefinir sua senha.
              </p>
            </div>

            <form onSubmit={handleRecuperarSenha} className="space-y-4 md:space-y-5">
              <div>
                <label className="block text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 md:mb-2">
                  E-mail
                </label>
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full border p-3 rounded text-base md:text-sm bg-hb-black text-white outline-none transition placeholder-gray-600 ${erro ? 'border-red-500 focus:border-red-400' : 'border-gray-700 focus:border-hb-gold'}`}
                  placeholder="seu@email.com"
                />
                {erro && <p className="text-[9px] md:text-[10px] text-red-500 font-bold mt-2">{erro}</p>}
              </div>

              <button 
                type="submit" 
                disabled={carregando || !email}
                className="w-full bg-hb-gold text-hb-black py-3 md:py-4 font-bold text-[10px] md:text-xs uppercase tracking-widest hover:bg-hb-goldLight transition flex items-center justify-center gap-2 mt-2 md:mt-4 disabled:opacity-50 rounded"
              >
                {carregando ? <Loader2 size={16} className="animate-spin" /> : 'Enviar Link'}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-4 md:py-6 animate-in slide-in-from-right-4 duration-500">
            <div className="flex justify-center mb-5 md:mb-6">
              <div className="bg-green-900/20 p-3 md:p-4 rounded-full border border-green-800">
                <MailCheck size={32} className="text-green-400 md:w-10 md:h-10" />
              </div>
            </div>
            <h2 className="text-lg md:text-xl font-light text-white uppercase tracking-widest italic mb-2 md:mb-3">
              E-mail Enviado!
            </h2>
            <p className="text-xs md:text-sm text-gray-400 leading-relaxed mb-6 md:mb-8">
              Se o e-mail <strong className="text-gray-200">{email}</strong> estiver em nosso sistema, você receberá um link para redefinir sua senha em instantes.
            </p>
            <Link 
              href="/login"
              className="block w-full border border-gray-700 text-white py-3 md:py-4 font-bold text-[10px] md:text-xs uppercase tracking-widest hover:bg-hb-black hover:border-hb-gold hover:text-hb-gold transition rounded"
            >
              Retornar ao Login
            </Link>
          </div>
        )}

      </div>
    </main>
  )
}
