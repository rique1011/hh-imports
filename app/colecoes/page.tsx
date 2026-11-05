import ColecoesEditorais from '@/components/ColecoesEditorais'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function PaginaColecoes() {
  return <main className="luxury-container min-h-dvh py-14 sm:py-20 lg:py-24">
    <div className="mb-12 max-w-2xl sm:mb-16"><p className="eyebrow mb-4">Universo H&H</p><h1 className="luxury-title">Seu estilo.<br /><span className="italic text-luxury-gold-light">Infinitas possibilidades.</span></h1><p className="mt-6 max-w-md text-sm leading-7 text-luxury-muted">Explore nossas coleções e encontre os detalhes que fazem sentido para você.</p></div>
    <ColecoesEditorais principal />
    <div className="mt-14 text-center"><Link href="/produtos" className="luxury-link border-b border-luxury-gold/40">Ver todas as peças <ArrowRight size={16} strokeWidth={1.5} /></Link></div>
  </main>
}
