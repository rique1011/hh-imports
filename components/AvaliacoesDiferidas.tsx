'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

const Avaliacoes = dynamic(() => import('@/components/Avaliacoes'), {
  loading: () => <p className="py-8 text-sm text-gray-400" role="status">Carregando avaliações...</p>,
})

export default function AvaliacoesDiferidas({ produtoId }: { produtoId: string }) {
  const alvo = useRef<HTMLDivElement>(null)
  const [visivel, setVisivel] = useState(false)
  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      const frame = requestAnimationFrame(() => setVisivel(true))
      return () => cancelAnimationFrame(frame)
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisivel(true); observer.disconnect() }
    }, { rootMargin: '300px' })
    if (alvo.current) observer.observe(alvo.current)
    return () => observer.disconnect()
  }, [])
  return <div id="avaliacoes" ref={alvo} className="min-h-80">
    {visivel ? <Avaliacoes produtoId={produtoId} /> : <h2 className="pt-8 text-lg uppercase tracking-wide text-white">Avaliações de Clientes</h2>}
  </div>
}
