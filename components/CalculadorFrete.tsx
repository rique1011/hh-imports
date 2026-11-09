'use client'
import type { OpcaoFrete } from '@/lib/frete'

import { useState } from 'react'
import { Truck, Loader2 } from 'lucide-react'
import { MENSAGEM_FRETE_GRATIS } from '@/lib/politica-frete'

export default function CalculadorFrete({ produtoId }: { produtoId: string }) {

  const [cep, setCep] = useState('')
  const [opcoesFrete, setOpcoesFrete] = useState<OpcaoFrete[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [gratis, setGratis] = useState(false)

  const calcularFrete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cep.length < 8) return

    setCarregando(true)
    setErro('')
    setOpcoesFrete([])

    try {
      const response = await fetch('/api/frete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cepDestino: cep, itens: [{ id: produtoId, quantidade: 1 }] })
      })

      const data = await response.json()

      if (!response.ok) {
        setErro(data.error || 'Não foi possível calcular o frete para este CEP.')
      } else {
        setOpcoesFrete(data.opcoes)
        setGratis(data.freteGratis === true)
      }
    } catch {
      setErro('Erro de conexão ao calcular frete.')
    } finally {
      setCarregando(false)
    }
  }

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length > 5) value = value.replace(/^(\d{5})(\d)/, '$1-$2')
    setCep(value)
  }

  return (
    <div className="shipping-calculator bg-luxury-surface p-5 md:p-6 border border-luxury-line text-luxury-ivory w-full">
      
      <div className="flex items-center gap-2 mb-4">
        <Truck size={18} className="text-hb-gold" />
        <h3 className="eyebrow text-luxury-ivory">
          Calcular Frete e Prazo
        </h3>
      </div>
      <p className="mb-4 text-xs leading-6 text-luxury-gold-light">{MENSAGEM_FRETE_GRATIS}</p>

      <form onSubmit={calcularFrete} className="flex flex-wrap sm:flex-nowrap gap-2">
        <input
          type="text" inputMode="numeric" autoComplete="postal-code" aria-label="CEP de entrega"
          value={cep}
          onChange={handleCepChange}
          maxLength={9}
          placeholder="00000-000"
          className="flex-1 px-4 py-3 text-sm md:text-base bg-transparent border border-luxury-line text-white placeholder-neutral-500 outline-none focus:border-hb-gold transition w-full min-w-0"
          required
        />
        <button
          type="submit"
          disabled={carregando || cep.length < 9}
          className="bg-luxury-black text-luxury-gold-light px-5 md:px-6 py-3 text-xs md:text-sm font-bold uppercase tracking-widest hover:border-luxury-gold transition disabled:opacity-50 border border-luxury-line whitespace-nowrap flex items-center justify-center min-w-[90px]"
        >
          {carregando ? <Loader2 size={16} className="animate-spin" /> : 'Calcular'}
        </button>
      </form>

      {erro && <p className="text-red-400 text-xs mt-3 font-medium">{erro}</p>}

      {opcoesFrete.length > 0 && (
        <div className="mt-5 space-y-3">
          {opcoesFrete.map((opcao, index) => (
            <div key={index} className="flex justify-between items-center py-3 border-b border-luxury-line last:border-0">
              <div>
                <p className="text-xs md:text-sm font-bold text-luxury-ivory uppercase">{opcao.nome}</p>
                {opcao.transportadora && <p className="mt-1 text-xs text-luxury-muted">{opcao.transportadora}</p>}
                <p className="text-[10px] md:text-xs text-luxury-muted uppercase tracking-widest mt-1">
                  Até {opcao.prazo} dias úteis
                </p>
              </div>
              <p className="text-sm md:text-base font-black text-hb-gold">
                {gratis ? 'Grátis' : `R$ ${Number(opcao.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              </p>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
