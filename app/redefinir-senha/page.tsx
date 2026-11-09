'use client'

import CampoSenha from '@/components/CampoSenha'
import { MIN_SENHA_CLIENTE, MIN_SENHA_ADMIN } from '@/lib/politica-senha'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, CheckCircle2 } from 'lucide-react'

function ConteudoRedefinir() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Pega o token da URL
  const token = searchParams.get('token')

  const [novaSenha, setNovaSenha] = useState('')
  const [minimo, setMinimo] = useState(MIN_SENHA_CLIENTE)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCarregando(true)
    setErro('')

    try {
      const res = await fetch('/api/auth/redefinir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, novaSenha })
      })

      const data = await res.json().catch(() => null)
      if (res.ok) {
        setSucesso(true)
        // Redireciona para o login depois de 3 segundos
        setTimeout(() => router.push('/login'), 3000)
      } else {
        if(data?.minimoSenha===MIN_SENHA_ADMIN) setMinimo(MIN_SENHA_ADMIN)
        setErro(data?.error || 'Link inválido ou expirado. Peça um novo link.')
        setCarregando(false)
      }
    } catch {
      setErro('Erro ao conectar com o servidor. Tente novamente.')
      setCarregando(false)
    }
  }

  if (sucesso) {
    return (
      <div className="text-center p-6 md:p-8 bg-hb-gray rounded-2xl shadow-gold border border-luxury-line max-w-sm w-full mx-auto animate-in fade-in zoom-in-95 duration-500">
        <CheckCircle2 size={48} className="text-hb-gold mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2 uppercase tracking-widest text-luxury-ivory">Senha Alterada!</h2>
        <p className="text-luxury-muted text-xs">Você será redirecionado para o login em instantes...</p>
      </div>
    )
  }

  return (
    <div className="max-w-md w-full bg-hb-gray p-6 md:p-8 rounded-2xl border border-luxury-line shadow-gold animate-in fade-in zoom-in-95 duration-500 mx-auto">
      <h1 className="text-2xl font-light uppercase tracking-widest italic mb-2 text-luxury-ivory">Nova Senha</h1>
      <p className="text-xs text-luxury-muted mb-6">Digite sua nova senha abaixo para recuperar o acesso.</p>

      <form onSubmit={handleUpdate} className="space-y-4">
        <div>
          <label htmlFor="redefinir-nova-senha" className="block text-[10px] font-bold text-luxury-muted uppercase tracking-widest mb-2">
            Sua nova senha
          </label>
          <CampoSenha
            id="redefinir-nova-senha" nomeCampo="nova senha" autoComplete="new-password" aria-describedby="ajuda-redefinir-senha"
            placeholder="••••••••"
            className="w-full bg-hb-black text-luxury-ivory placeholder-luxury-muted border border-luxury-line p-3 rounded text-base md:text-sm outline-none focus:border-hb-gold focus:ring-1 focus:ring-hb-gold transition"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            required
            minLength={minimo}
          />
          <p id="ajuda-redefinir-senha" className="mt-2 text-xs text-luxury-muted">Mínimo de {minimo} caracteres.</p>
        </div>

        {erro && <p role="alert" className="text-sm text-red-400">{erro}</p>}
        <button
          type="submit"
          disabled={carregando || !token}
          className="w-full min-h-12 bg-hb-gold text-hb-black rounded py-4 font-bold text-xs uppercase tracking-widest enabled:hover:bg-hb-goldLight transition-colors flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
        >
          {carregando ? <Loader2 className="animate-spin" size={16} /> : 'Atualizar Senha'}
        </button>

        {!token && (
          <p className="text-[10px] text-red-400 font-bold uppercase mt-2 text-center">
            Nenhum token de segurança encontrado na URL.
          </p>
        )}
      </form>
    </div>
  )
}

// O componente principal envolve o conteúdo no Suspense
export default function PaginaRedefinirSenha() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-hb-black px-4 md:px-6 py-10 md:py-12">
      <Suspense fallback={<div className="flex flex-col items-center gap-2"><Loader2 className="animate-spin text-hb-gold" /><p className="text-xs uppercase text-luxury-muted tracking-widest">Carregando...</p></div>}>
        <ConteudoRedefinir />
      </Suspense>
    </main>
  )
}
