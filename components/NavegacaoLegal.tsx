'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ArrowLeft } from 'lucide-react'
import { destinoInterno, linkComRetorno } from '@/lib/navegacao'

export function LinksLegais() {
  const pathname = usePathname(), params = useSearchParams()
  const paginaLegal = pathname === '/termos' || pathname === '/privacidade'
  const retorno = paginaLegal ? destinoInterno(params.get('retorno')) : destinoInterno(pathname + (params.size ? '?' + params.toString() : ''))
  return <nav aria-label="Informações legais" className="flex gap-6">
    <Link prefetch={false} href={linkComRetorno('/privacidade', retorno)} className="inline-flex min-h-11 items-center hover:text-luxury-ivory">Privacidade</Link>
    <Link prefetch={false} href={linkComRetorno('/termos', retorno)} className="inline-flex min-h-11 items-center hover:text-luxury-ivory">Termos de uso</Link>
  </nav>
}
export function VoltarPaginaLegal() {
  const params = useSearchParams(), { status } = useSession()
  const cadastro = params.get('origem') === 'cadastro' && status === 'unauthenticated'
  const retorno = destinoInterno(params.get('retorno'))
  const href = cadastro ? linkComRetorno('/cadastro', retorno) : retorno
  return <Link href={href} className="mb-8 inline-flex min-h-11 items-center gap-2 text-xs font-medium text-luxury-gold-light hover:text-white md:mb-12"><ArrowLeft size={16} />{cadastro ? 'Voltar ao cadastro' : retorno === '/' ? 'Voltar para a loja' : 'Voltar à página anterior'}</Link>
}
