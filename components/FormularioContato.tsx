'use client'

import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { CONTACT_EMAIL } from '@/lib/brand'

const campo = 'w-full min-w-0 p-4 text-base bg-hb-black border border-gray-700 text-white outline-none focus:border-hb-gold transition placeholder-gray-600 rounded'

export default function FormularioContato() {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget, dados = new FormData(form)
    setEnviando(true); setErro(''); setSucesso(false)
    try {
      const response = await fetch('/api/contato', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(dados)) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível enviar sua mensagem.')
      form.reset(); setSucesso(true)
    } catch (error) { setErro(error instanceof Error ? error.message : 'Falha de comunicação. Tente novamente.') }
    finally { setEnviando(false) }
  }
  return <form aria-label="Formulário de contato" onSubmit={enviar} className="min-w-0 bg-hb-gray p-5 sm:p-8 rounded-2xl border border-gray-800 space-y-4 shadow-sm">
    <h2 className="text-xl font-light uppercase tracking-widest mb-6 text-white">Envie uma Mensagem</h2>
    <label className="block space-y-2 text-sm text-gray-300">Seu nome
      <input name="nome" autoComplete="name" required minLength={2} maxLength={100} disabled={enviando} className={campo} />
    </label>
    <label className="block space-y-2 text-sm text-gray-300">Seu e-mail
      <input type="email" name="email" autoComplete="email" required maxLength={254} disabled={enviando} className={campo} />
    </label>
    <label className="block space-y-2 text-sm text-gray-300">Como podemos ajudar?
      <textarea name="mensagem" rows={5} required minLength={10} maxLength={5000} disabled={enviando} className={campo + ' resize-y'} />
    </label>
    <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <button type="submit" disabled={enviando} className="w-full min-h-11 bg-hb-gold text-hb-black py-4 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-hb-goldLight transition rounded disabled:opacity-50">
      {enviando ? <>Enviando… <Loader2 size={16} className="animate-spin" /></> : <>Enviar mensagem <Send size={14} /></>}
    </button>
    {sucesso && <p role="status" className="text-sm text-green-400">Mensagem enviada! Nossa equipe responderá pelo e-mail informado.</p>}
    {erro && <p role="alert" className="text-sm text-red-400">{erro} Você também pode escrever para <a href={'mailto:' + CONTACT_EMAIL} className="break-all underline">{CONTACT_EMAIL}</a>.</p>}
  </form>
}
