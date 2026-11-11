'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function QuantidadeCarrinho({ nome, quantidade, maximo = 100, onChange }: {
  nome: string; quantidade: number; maximo?: number; onChange: (valor: number) => void
}) {
  const [rascunho, setRascunho] = useState<string | null>(null)
  function confirmar() {
    if (rascunho !== null) {
      const n = Number(rascunho)
      if (!/^\d+$/.test(rascunho) || !Number.isSafeInteger(n) || n < 1 || n > maximo) {
        toast.error(`Informe uma quantidade inteira de 1 a ${maximo}. O estoque será conferido ao finalizar.`)
      }
    }
    setRascunho(null)
  }
  function mudar(valor: number) { setRascunho(null); onChange(Math.min(maximo, Math.max(1, valor))) }
  return <div className="flex min-h-11 items-center overflow-hidden rounded border border-gray-700">
    <button type="button" disabled={quantidade <= 1} aria-label={`Diminuir quantidade de ${nome}`} onClick={() => mudar(quantidade - 1)} className="grid min-h-11 min-w-11 place-items-center bg-hb-black text-gray-300 disabled:opacity-40">−</button>
    <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3} aria-label={`Quantidade de ${nome}`} value={rascunho ?? String(quantidade)}
      onChange={e => {
        const texto = e.target.value
        if (!/^\d*$/.test(texto)) return
        setRascunho(texto)
        const n = Number(texto)
        if (Number.isSafeInteger(n) && n >= 1 && n <= maximo) onChange(n)
      }}
      onBlur={confirmar} onFocus={e => e.target.select()}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } if (e.key === 'Escape') { setRascunho(null); e.currentTarget.blur() } }}
      className="min-h-11 w-14 min-w-0 rounded-none border-x border-gray-700 bg-hb-black px-1 text-center text-base font-medium text-white outline-none focus:bg-hb-gold/10 focus:ring-1 focus:ring-inset focus:ring-hb-gold" />
    <button type="button" disabled={quantidade >= maximo} aria-label={`Aumentar quantidade de ${nome}`} onClick={() => mudar(quantidade + 1)} className="grid min-h-11 min-w-11 place-items-center bg-hb-black text-gray-300 disabled:opacity-40">+</button>
  </div>
}
