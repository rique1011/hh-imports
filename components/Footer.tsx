import Link from 'next/link'
import { CONTACT_EMAIL } from '@/lib/brand'
import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react'
import MarcaLoja from '@/components/MarcaLoja'
import { MENSAGEM_FRETE_GRATIS } from '@/lib/politica-frete'

const loja = [
  { href: '/produtos', nome: 'Todas as peças' }, { href: '/colecoes', nome: 'Nossas coleções' },
  { href: '/#destaques', nome: 'Seleção H&H' }, { href: '/sobre', nome: 'A nossa história' },
]
const ajuda = [
  { href: '/fale-conosco', nome: 'Fale conosco' }, { href: '/fretes-e-entregas', nome: 'Fretes e entregas' },
  { href: '/cuidados', nome: 'Cuidados e garantia' }, { href: '/trocas', nome: 'Trocas e devoluções' },
]

// HTML do servidor: nenhum pacote de JavaScript é necessário para o rodapé.
export default function Footer({ logoUrl = '' }: { logoUrl?: string }) {
  return <footer className="render-later border-t border-luxury-line bg-luxury-surface text-luxury-muted">
    <div className="luxury-container grid gap-10 py-14 sm:grid-cols-2 sm:gap-x-12 lg:grid-cols-[1.3fr_0.7fr_0.9fr_1.2fr] lg:gap-10 lg:py-20">
      <div className="max-w-xs">
        <Link href="/" aria-label="H&H IMPORTS — Início" className="inline-block text-center"><MarcaLoja url={logoUrl} rodape /></Link>
        <p className="mt-5 text-sm leading-7">Joias, acessórios e detalhes que acompanham quem você é.</p>
        <Link href="/fretes-e-entregas" className="mt-4 inline-block text-xs leading-6 text-luxury-gold-light">{MENSAGEM_FRETE_GRATIS}</Link>
        <Link href="/sobre" className="luxury-link mt-4">Conheça a nossa história <ArrowUpRight size={15} strokeWidth={1.5} /></Link>
      </div>
      <div><h2 className="mb-4 font-sans text-[10px] font-medium uppercase tracking-[0.18em] text-luxury-ivory">Explore</h2><nav aria-label="Coleções no rodapé" className="flex flex-col items-start">{loja.map(link => <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center text-xs leading-5 transition-colors hover:text-luxury-gold-light">{link.nome}</Link>)}</nav></div>
      <div><h2 className="mb-4 font-sans text-[10px] font-medium uppercase tracking-[0.18em] text-luxury-ivory">Estamos por perto</h2><nav aria-label="Atendimento no rodapé" className="flex flex-col items-start">{ajuda.map(link => <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center text-xs leading-5 transition-colors hover:text-luxury-gold-light">{link.nome}</Link>)}</nav></div>
      <div className="min-w-0"><h2 className="mb-4 font-sans text-[10px] font-medium uppercase tracking-[0.18em] text-luxury-ivory">Atendimento H&H</h2>
        <a href={'mailto:' + CONTACT_EMAIL} className="flex min-h-11 min-w-0 items-center gap-3 text-xs leading-6 transition-colors hover:text-luxury-gold-light"><Mail size={16} strokeWidth={1.4} className="shrink-0 text-luxury-gold" /><span className="min-w-0 break-all">{CONTACT_EMAIL}</span></a>
        <a href="tel:+5547997386824" className="flex min-h-11 items-center gap-3 text-xs transition-colors hover:text-luxury-gold-light"><Phone size={16} strokeWidth={1.4} className="shrink-0 text-luxury-gold" />(47) 99738-6824</a>
        <p className="mt-3 flex items-start gap-3 text-xs leading-6"><MapPin size={16} strokeWidth={1.4} className="mt-1 shrink-0 text-luxury-gold" /><span>Joinville, Santa Catarina.<br />Para todo o Brasil.</span></p>
      </div>
    </div>
    <div className="luxury-container flex flex-col justify-between gap-5 border-t border-luxury-line py-6 text-[10px] leading-6 sm:flex-row sm:items-center"><p>© {new Date().getFullYear()} H&H IMPORTS. Todos os direitos reservados.</p><nav aria-label="Informações legais" className="flex gap-6"><Link href="/privacidade" className="inline-flex min-h-11 items-center hover:text-luxury-ivory">Privacidade</Link><Link href="/termos" className="inline-flex min-h-11 items-center hover:text-luxury-ivory">Termos de uso</Link></nav></div>
  </footer>
}
