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
    <main className="min-h-screen flex items-center justify-center bg-hb-black py-10 md:py-12 px-4 md:px-6">
      <div className="max-w-md w-full bg-hb-gray p-6 md:p-8 rounded-2xl border border-luxury-line shadow-gold animate-in fade-in slide-in-from-bottom-4 duration-700">

        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-light text-luxury-ivory uppercase tracking-widest italic mb-2">
            Criar Conta
          </h1>
          <p className="text-[10px] md:text-xs text-hb-goldLight uppercase tracking-widest font-medium">
            Junte-se à experiência H&H IMPORTS
          </p>
        </div>

        <form onSubmit={handleCadastro} className="space-y-4 md:space-y-5">
          <div>
            <label htmlFor="cadastro-nome" className="block text-[10px] md:text-xs font-bold text-luxury-muted uppercase tracking-widest mb-1 md:mb-2">
              Nome Completo
            </label>
            <input
              id="cadastro-nome" type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full bg-hb-black text-luxury-ivory placeholder-luxury-muted border border-luxury-line p-3 rounded text-base md:text-sm outline-none focus:border-hb-gold focus:ring-1 focus:ring-hb-gold transition"
              placeholder="Ex: João da Silva"
            />
          </div>

          <div>
            <label htmlFor="cadastro-email" className="block text-[10px] md:text-xs font-bold text-luxury-muted uppercase tracking-widest mb-1 md:mb-2">
              E-mail
            </label>
            <input
              id="cadastro-email" type="email" autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-hb-black text-luxury-ivory placeholder-luxury-muted border border-luxury-line p-3 rounded text-base md:text-sm outline-none focus:border-hb-gold focus:ring-1 focus:ring-hb-gold transition"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label htmlFor="cadastro-senha" className="block text-[10px] md:text-xs font-bold text-luxury-muted uppercase tracking-widest mb-1 md:mb-2">
              Senha
            </label>
            <CampoSenha
              id="cadastro-senha" autoComplete="new-password" minLength={MIN_SENHA_CLIENTE} aria-describedby="ajuda-cadastro-senha"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full bg-hb-black text-luxury-ivory placeholder-luxury-muted border border-luxury-line p-3 rounded text-base md:text-sm outline-none focus:border-hb-gold focus:ring-1 focus:ring-hb-gold transition"
              placeholder="••••••••"
            />
            <p id="ajuda-cadastro-senha" className="mt-2 text-xs text-luxury-muted">Mínimo de {MIN_SENHA_CLIENTE} caracteres.</p>
          </div>

          <div className="pt-2">
            <label className={`flex items-start gap-3 p-3 rounded cursor-pointer border transition-colors ${erroTermos ? 'bg-red-950/30 border-red-400' : 'bg-hb-black border-luxury-line hover:border-hb-gold'}`}>
              <div className="flex items-center h-5 mt-0.5 md:mt-0">
                <input
                  type="checkbox"
                  checked={aceitouTermos}
                  onChange={(e) => {
                    setAceitouTermos(e.target.checked)
                    if (e.target.checked) setErroTermos(false)
                  }}
                  className="w-4 h-4 border-luxury-line rounded focus:ring-hb-gold accent-hb-gold cursor-pointer shrink-0"
                />
              </div>
              <div className="flex-1 text-[11px] md:text-[10px] text-luxury-muted leading-snug md:leading-tight">
                Eu li e concordo com os{' '}
                <Link href="/termos" className="font-bold text-hb-goldLight hover:underline">Termos de Uso</Link>
                {' '}e a{' '}
                <Link href="/privacidade" className="font-bold text-hb-goldLight hover:underline">Política de Privacidade</Link>.
              </div>
            </label>
            {erroTermos && (
              <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest mt-2 flex items-center gap-1">
                <ShieldCheck size={12} className="md:w-3 md:h-3" /> Aceite obrigatório
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={carregando || !aceitouTermos}
            className="w-full min-h-12 bg-hb-gold text-hb-black py-3 md:py-4 font-bold text-[10px] md:text-xs uppercase tracking-widest enabled:hover:bg-hb-goldLight transition-colors flex items-center justify-center gap-2 mt-2 md:mt-4 disabled:opacity-50 disabled:cursor-not-allowed rounded"
          >
            {carregando ? <Loader2 size={16} className="animate-spin" /> : <>Criar Minha Conta <ArrowRight size={14} /></>}
          </button>
        </form>

        <div className="mt-6 md:mt-8 text-center border-t border-luxury-line pt-5 md:pt-6">
          <p className="text-[10px] md:text-xs text-luxury-muted">
            Já possui uma conta?{' '}
            <Link href="/login" className="font-bold text-hb-goldLight uppercase tracking-widest hover:underline">
              Fazer Login
            </Link>
          </p>
        </div>

      </div>
    </main>
  )
}
