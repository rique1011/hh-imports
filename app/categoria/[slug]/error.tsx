'use client'
import Link from 'next/link'

export default function ErroColecao() {
  return <main className="luxury-container min-h-[70vh] flex flex-col items-center justify-center py-16 text-center">
    <p className="eyebrow mb-4">H&H IMPORTS</p>
    <h1 className="font-serif text-3xl text-luxury-ivory">Não conseguimos carregar esta coleção.</h1>
    <p className="mt-4 max-w-md text-sm leading-7 text-luxury-muted">Tente novamente em instantes para ver as peças disponíveis.</p>
    <div className="mt-8 flex flex-wrap justify-center gap-4">
      <button type="button" onClick={() => window.location.reload()} className="luxury-button">Tentar novamente</button>
      <Link href="/produtos" className="luxury-button luxury-button-outline">Ver todas as peças</Link>
    </div>
  </main>
}
