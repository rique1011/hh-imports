'use client'

import { useEffect } from 'react'

export default function ContadorVisitas({ slug }: { slug: string }) {
  useEffect(() => {
    // Evita contar visitas duplicadas se o modo estrito do React estiver rodando
    const jaContou = sessionStorage.getItem(`visita_${slug}`)
    
    if (!jaContou) {
      fetch('/api/visitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug })
      }).then(res => {
        if (res.ok) sessionStorage.setItem(`visita_${slug}`, 'true')
      }).catch(err => console.error("Erro ao registrar visita", err))
    }
  }, [slug])

  return null // Não renderiza nada na tela, é um espião silencioso 🕵️‍♂️
}
