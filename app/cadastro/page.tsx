'use client'

import CampoSenha from '@/components/CampoSenha'
import { MIN_SENHA_CLIENTE } from '@/lib/politica-senha'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, ArrowRight, ShieldCheck } from 'lucide-react'

export default function PaginaCadastro() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)

  const [aceitouTermos, setAceitouTermos] = useState(false)
  const [erroTermos, setErroTermos] = useState(false)

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!aceitouTermos) {
      setErroTermos(true)
      return
    }

    setErroTermos(false)
    setCarregando(true)

    try {
      // ✅ Chama a nova rota para não conflitar com NextAuth
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, senha })
      })

      const data = await res.json().catch(() => null)

      if (res.ok && data?.sucesso) {
        // Redireciona para a tela de digitar o código enviado por e-mail
        router.push(`/verificar?email=${encodeURIComponent(email.toLowerCase().trim())}`)
      } else {
        alert(data?.error || "Erro ao criar conta. Tente novamente.")
      }
    } catch {
      alert("Erro de conexão ao tentar contatar o servidor.")
    } finally {
      setCarregando(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 py-10 md:py-12 px-4 md:px-6">
      <div className="max-w-md w-full bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-md animate-in fade-in slide-in-from-bottom-4 duration-700">

        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-light text-gray-900 uppercase tracking-widest italic mb-2">
            Criar Conta
          </h1>
          <p className="text-[10px] md:text-xs text-gray-600 uppercase tracking-widest font-medium">
            Junte-se à experiência H&H IMPORTS
          </p>
        </div>

        <form onSubmit={handleCadastro} className="space-y-4 md:space-y-5">
          <div>
            <label htmlFor="cadastro-nome" className="block text-[10px] md:text-xs font-bold text-gray-700 uppercase tracking-widest mb-1 md:mb-2">
              Nome Completo
            </label>
            <input
              id="cadastro-nome" type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 p-3 rounded text-base md:text-sm outline-none focus:border-black focus:ring-1 focus:ring-black transition shadow-sm"
              placeholder="Ex: João da Silva"
            />
          </div>

          <div>
            <label htmlFor="cadastro-email" className="block text-[10px] md:text-xs font-bold text-gray-700 uppercase tracking-widest mb-1 md:mb-2">
              E-mail
            </label>
            <input
              id="cadastro-email" type="email" autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 p-3 rounded text-base md:text-sm outline-none focus:border-black focus:ring-1 focus:ring-black transition shadow-sm"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label htmlFor="cadastro-senha" className="block text-[10px] md:text-xs font-bold text-gray-700 uppercase tracking-widest mb-1 md:mb-2">
              Senha
            </label>
            <CampoSenha
              id="cadastro-senha" autoComplete="new-password" minLength={MIN_SENHA_CLIENTE} aria-describedby="ajuda-cadastro-senha"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 p-3 rounded text-base md:text-sm outline-none focus:border-black focus:ring-1 focus:ring-black transition shadow-sm"
              placeholder="••••••••"
            />
            <p id="ajuda-cadastro-senha" className="mt-2 text-xs text-gray-500">Mínimo de {MIN_SENHA_CLIENTE} caracteres.</p>
          </div>

          <div className="pt-2">
            <label className={`flex items-start gap-3 p-3 rounded cursor-pointer border transition-all ${erroTermos ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
              <div className="flex items-center h-5 mt-0.5 md:mt-0">
                <input
                  type="checkbox"
                  checked={aceitouTermos}
                  onChange={(e) => {
                    setAceitouTermos(e.target.checked)
                    if (e.target.checked) setErroTermos(false)
                  }}
                  className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black accent-black cursor-pointer shrink-0"
                />
              </div>
              <div className="flex-1 text-[11px] md:text-[10px] text-gray-700 leading-snug md:leading-tight">
                Eu li e concordo com os{' '}
                <Link href="/termos" className="font-bold text-black hover:underline">Termos de Uso</Link>
                {' '}e a{' '}
                <Link href="/privacidade" className="font-bold text-black hover:underline">Política de Privacidade</Link>.
              </div>
            </label>
            {erroTermos && (
              <p className="text-[9px] font-bold text-red-600 uppercase tracking-widest mt-2 flex items-center gap-1">
                <ShieldCheck size={12} className="md:w-3 md:h-3" /> Aceite obrigatório
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={carregando || !aceitouTermos}
            className="w-full bg-black text-white py-3 md:py-4 font-bold text-[10px] md:text-xs uppercase tracking-widest hover:bg-gray-800 transition flex items-center justify-center gap-2 mt-2 md:mt-4 disabled:opacity-50 disabled:cursor-not-allowed rounded shadow-sm"
          >
            {carregando ? <Loader2 size={16} className="animate-spin" /> : <>Criar Minha Conta <ArrowRight size={14} /></>}
          </button>
        </form>

        <div className="mt-6 md:mt-8 text-center border-t border-gray-200 pt-5 md:pt-6">
          <p className="text-[10px] md:text-xs text-gray-600">
            Já possui uma conta?{' '}
            <Link href="/login" className="font-bold text-black uppercase tracking-widest hover:underline">
              Fazer Login
            </Link>
          </p>
        </div>

      </div>
    </main>
  )
}
