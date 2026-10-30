'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, CheckCircle2 } from 'lucide-react'

function ConteudoRedefinir() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // Pega o token da URL
  const token = searchParams.get('token')

  const [novaSenha, setNovaSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCarregando(true)

    try {
      const res = await fetch('/api/auth/redefinir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, novaSenha })
      })

      if (res.ok) {
        setSucesso(true)
        // Redireciona para o login depois de 3 segundos
        setTimeout(() => router.push('/login'), 3000)
      } else {
        alert("Link inválido ou expirado. Peça um novo link.")
        setCarregando(false)
      }
    } catch {
      alert("Erro ao conectar com o servidor.")
      setCarregando(false)
    }
  }

  if (sucesso) {
    return (
      <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-gray-100 max-w-sm w-full mx-auto animate-in fade-in zoom-in-95 duration-500">
        <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2 uppercase tracking-widest text-gray-900">Senha Alterada!</h2>
        <p className="text-gray-500 text-xs">Você será redirecionado para o login em instantes...</p>
      </div>
    )
  }

  return (
    <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-gray-100 shadow-sm animate-in fade-in zoom-in-95 duration-500 mx-auto">
      <h1 className="text-2xl font-light uppercase tracking-widest italic mb-2 text-gray-900">Nova Senha</h1>
      <p className="text-xs text-gray-500 mb-6">Digite sua nova senha abaixo para recuperar o acesso.</p>
      
      <form onSubmit={handleUpdate} className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            Sua nova senha
          </label>
          <input 
            type="password" 
            placeholder="••••••••" 
            className="w-full border border-gray-200 p-3 rounded text-sm outline-none focus:border-black transition"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            required
            minLength={6}
          />
        </div>
        
        <button 
          type="submit" 
          disabled={carregando || !token}
          className="w-full bg-black text-white py-4 font-bold text-xs uppercase tracking-widest hover:bg-gray-800 transition flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
        >
          {carregando ? <Loader2 className="animate-spin" size={16} /> : 'Atualizar Senha'}
        </button>

        {!token && (
          <p className="text-[10px] text-red-500 font-bold uppercase mt-2 text-center">
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
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <Suspense fallback={<div className="flex flex-col items-center gap-2"><Loader2 className="animate-spin text-gray-400" /><p className="text-xs uppercase text-gray-400 tracking-widest">Carregando...</p></div>}>
        <ConteudoRedefinir />
      </Suspense>
    </main>
  )
}
