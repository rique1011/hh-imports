'use client'

import CampoSenha from '@/components/CampoSenha'
import { MIN_SENHA_CLIENTE } from '@/lib/politica-senha'
import { useState } from 'react'
import { signOut } from 'next-auth/react'

export default function AlterarSenhaConta({ obrigatoria }: { obrigatoria: boolean }) {
  const [aberta, setAberta] = useState(false)
  const [senha, setSenha] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar(event: React.FormEvent) {
    event.preventDefault()
    setSalvando(true)
    setErro('')
    try {
      const response = await fetch('/api/usuario/seguranca', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'senha', senha, novaSenha }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Não foi possível atualizar sua senha.')
      await signOut({ callbackUrl: '/login' })
    } catch (error) { setErro(error instanceof Error ? error.message : 'Tente novamente.'); setSalvando(false) }
  }

  return <section className="rounded-lg border border-gray-800 p-4 sm:p-5">
    {obrigatoria && <p className="mb-4 text-sm leading-6 text-gray-300">Atualize sua senha antiga uma vez para continuar usando sua conta. Depois, entre normalmente com e-mail e senha.</p>}
    {!obrigatoria && !aberta ? <button type="button" onClick={() => setAberta(true)} className="min-h-11 text-sm text-hb-gold underline underline-offset-4">Alterar minha senha</button> : <form onSubmit={salvar} className="max-w-md space-y-4">
      <h2 className="text-base text-hb-gold">Alterar senha</h2>
      <div className="block space-y-2 text-sm text-gray-300"><label htmlFor="cliente-senha-atual">Senha atual</label><CampoSenha id="cliente-senha-atual" nomeCampo="senha atual" autoComplete="current-password" required disabled={salvando} value={senha} onChange={event => setSenha(event.target.value)} className="w-full rounded border border-gray-700 bg-hb-black p-3 text-base text-white" /></div>
      <div className="block space-y-2 text-sm text-gray-300"><label htmlFor="cliente-nova-senha">Nova senha</label><CampoSenha id="cliente-nova-senha" nomeCampo="nova senha" autoComplete="new-password" minLength={MIN_SENHA_CLIENTE} required disabled={salvando} value={novaSenha} onChange={event => setNovaSenha(event.target.value)} className="w-full rounded border border-gray-700 bg-hb-black p-3 text-base text-white" /></div>
      <p className="text-xs leading-6 text-gray-400">Use uma senha exclusiva com pelo menos {MIN_SENHA_CLIENTE} caracteres. Ao salvar, você entrará novamente com a nova senha.</p>
      {erro && <p role="alert" className="text-sm text-red-300">{erro}</p>}
      <div className="flex flex-wrap gap-4"><button type="submit" disabled={salvando} className="min-h-11 rounded bg-hb-gold px-5 py-3 text-xs font-bold text-black disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar nova senha'}</button>
        {!obrigatoria && <button type="button" disabled={salvando} onClick={() => { setAberta(false); setSenha(''); setNovaSenha(''); setErro('') }} className="min-h-11 text-sm text-gray-400">Cancelar</button>}</div>
    </form>}
  </section>
}
