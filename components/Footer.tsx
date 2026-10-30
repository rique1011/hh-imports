import { CONTACT_EMAIL } from '@/lib/brand'
import Link from 'next/link'
import { Mail, MapPin, Phone } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-hb-black text-gray-400 py-12 md:py-16 border-t border-hb-gray">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-12 text-center md:text-left">
        
        {/* Coluna 1: Sobre a Marca */}
        <div className="flex flex-col items-center md:items-start">
          <Link href="/" className="text-xl md:text-2xl font-bold tracking-widest text-hb-gold mb-4 md:mb-6 hover:text-hb-goldLight transition-colors">
            H&H IMPORTS
          </Link>
          <p className="text-xs md:text-sm text-gray-500 leading-relaxed mb-6 font-light">
            Especialistas em joias premium e relógios importados. Trazendo o que há de mais exclusivo no mundo da alta joalheria diretamente para você.
          </p>
          <div className="flex gap-4 text-gray-500 justify-center md:justify-start">
            <a href="#" className="hover:text-hb-gold transition-colors p-2 -ml-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
            </a>
            <a href="#" className="hover:text-hb-gold transition-colors p-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            </a>
          </div>
        </div>

        {/* Coluna 2: Links Úteis */}
        <div className="flex flex-col">
          <h4 className="text-white font-bold tracking-widest uppercase mb-4 md:mb-6 text-[11px] md:text-sm">Nossa Loja</h4>
          <nav className="flex flex-col gap-3 text-xs md:text-sm text-gray-500 font-light">
            <Link href="/#destaques" className="hover:text-hb-gold transition-colors">Destaques da Semana</Link>
            <Link href="/#lancamentos" className="hover:text-hb-gold transition-colors">Lançamentos</Link>
            <Link href="/#mais-vendidos" className="hover:text-hb-gold transition-colors">Mais Vendidos</Link>
            <Link href="/sobre" className="hover:text-hb-gold transition-colors">Sobre Nós</Link>
          </nav>
        </div>

        {/* Coluna 3: Atendimento */}
        <div className="flex flex-col">
          <h4 className="text-white font-bold tracking-widest uppercase mb-4 md:mb-6 text-[11px] md:text-sm">Atendimento</h4>
          <nav className="flex flex-col gap-3 text-xs md:text-sm text-gray-500 font-light">
            <Link href="/fale-conosco" className="hover:text-hb-gold transition-colors">Fale Conosco</Link>
            <Link href="/fretes-e-entregas" className="hover:text-hb-gold transition-colors">Fretes e Entregas</Link>
            <Link href="/cuidados" className="hover:text-hb-gold transition-colors">Guia de Cuidados e Garantia</Link>
            <Link href="/trocas" className="hover:text-hb-gold transition-colors">Trocas e Devoluções</Link>
          </nav>
        </div>

        {/* Coluna 4: Contato */}
        <div className="flex flex-col items-center md:items-start">
          <h4 className="text-white font-bold tracking-widest uppercase mb-4 md:mb-6 text-[11px] md:text-sm">Contato</h4>
          <div className="flex flex-col gap-3 md:gap-4 text-xs md:text-sm text-gray-500 font-light">
            <div className="flex items-center justify-center md:justify-start gap-3 hover:text-hb-goldLight transition-colors">
              <Mail size={16} className="text-hb-gold" />
              <span>H&H IMPORTS@gmail.com</span>
            </div>
            <div className="flex items-center justify-center md:justify-start gap-3 hover:text-hb-goldLight transition-colors">
              <Phone size={16} className="text-hb-gold" />
              <span>(47) 99738-6824</span>
            </div>
            <div className="flex items-start justify-center md:justify-start gap-3 mt-1 md:mt-2 hover:text-hb-goldLight transition-colors">
              <MapPin size={16} className="mt-1 flex-shrink-0 text-hb-gold" />
              <span>Joinville, SC<br />Atendimento para todo o Brasil</span>
            </div>
          </div>
        </div>

      </div>

      {/* COPYRIGHT & SELOS */}
      <div className="max-w-6xl mx-auto px-6 mt-12 md:mt-16 pt-6 md:pt-8 border-t border-hb-gray flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-[10px] md:text-xs text-gray-600 font-medium text-center md:text-left">
          © {new Date().getFullYear()} H&H IMPORTS. Todos os direitos reservados.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
          <div className="text-[9px] md:text-[10px] text-gray-500 flex gap-3 md:gap-4 font-bold uppercase tracking-widest">
            <span className="text-hb-gold">Ambiente 100% Seguro</span>
            <span className="text-gray-700 hidden sm:inline">•</span>
            <span className="text-hb-gold">Compra Garantida</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
