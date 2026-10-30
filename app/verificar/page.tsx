'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, ShieldCheck } from 'lucide-react'

function FormularioVerificacao() {
  const [codigo, setCodigo] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email')

  const validarCodigo = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    try {
      const resposta = await fetch('/api/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, codigo })
      })

      const dados = await resposta.json()

      if (!resposta.ok) {
        setErro(dados.error)
      } else {
        alert('Conta verificada com sucesso! Faça login para continuar.')
        router.push('/login')
      }
    } catch (err) {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-hb-black flex items-center justify-center text-xs uppercase tracking-widest text-gray-500">
        Nenhum e-mail identificado. Volte para o cadastro.
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-hb-black px-6">
      <div className="max-w-md w-full bg-hb-gray p-10 rounded-2xl shadow-sm border border-gray-800 text-center animate-in zoom-in-95 duration-500">
        <div className="bg-hb-black border border-gray-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldCheck size={32} className="text-hb-gold" />
        </div>
        <h1 className="text-2xl font-light uppercase tracking-[0.2em] text-white mb-2">Segurança</h1>
        <p className="text-xs text-gray-400 mb-8 leading-relaxed font-medium">
          Enviamos um código de acesso para <br/><strong className="text-hb-gold font-bold">{email}</strong>
        </p>

        <form onSubmit={validarCodigo} className="space-y-8">
          <div>
            <input 
              type="text"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full text-center bg-transparent text-white text-4xl tracking-[0.5em] font-light border-b border-gray-700 pb-4 outline-none focus:border-hb-gold transition placeholder-gray-800"
              required
            />
          </div>

          {erro && <p className="text-red-500 text-[10px] uppercase font-bold tracking-widest">{erro}</p>}

          <button 
            disabled={carregando || codigo.length < 6} 
            className="w-full bg-hb-gold text-hb-black py-4 font-bold text-xs uppercase tracking-widest hover:bg-hb-goldLight transition disabled:opacity-50 flex items-center justify-center h-12 rounded"
          >
            {carregando ? <Loader2 className="animate-spin" size={16} /> : 'Validar Código'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function VerificarEmail() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-hb-black flex items-center justify-center"><Loader2 className="animate-spin text-hb-gold" /></div>}>
      <FormularioVerificacao />
    </Suspense>
  )
}
