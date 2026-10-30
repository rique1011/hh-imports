import Link from 'next/link'
import { ArrowRight, Diamond } from 'lucide-react'

export default function PaginaSobre() {
  return (
    <main className="min-h-screen bg-hb-black">
      {/* Banner */}
      <section className="bg-hb-gray py-16 md:py-24 text-center px-4 md:px-6 border-b border-hb-black">
        <Diamond size={32} className="text-hb-gold mx-auto mb-4 md:mb-6 w-6 h-6 md:w-8 md:h-8" />
        <h1 className="text-2xl md:text-4xl lg:text-5xl font-light text-white uppercase tracking-widest italic mb-3 md:mb-4">
          Nossa História
        </h1>
        <p className="text-hb-gold text-[10px] md:text-sm uppercase tracking-widest">A essência da H&H IMPORTS</p>
      </section>

      {/* Conteúdo */}
      <section className="max-w-4xl mx-auto px-4 md:px-6 py-12 md:py-20 text-center">
        <h2 className="text-xl md:text-2xl font-light uppercase tracking-widest text-white mb-6 md:mb-8">
          Mais do que joias, um legado.
        </h2>
        <div className="space-y-5 md:space-y-6 text-gray-400 leading-relaxed font-light text-sm md:text-base text-left md:text-center">
          <p>
            A <strong className="text-hb-gold font-normal">H&H IMPORTS</strong> nasceu da paixão por peças exclusivas e do desejo de trazer para o Brasil o que há de mais sofisticado no mercado mundial de joias.
          </p>
          <p>
            Cada colar, pulseira e brinco que selecionamos passa por um rigoroso controle de qualidade. Trabalhamos apenas com materiais premium, garantindo não apenas o brilho imediato, mas a durabilidade que uma verdadeira joia de luxo exige.
          </p>
          <p>
            Acreditamos que o luxo não está apenas no produto, mas na experiência. Desde o momento em que você acessa nossa vitrine até o instante em que abre nossa caixa exclusiva em sua casa, nosso objetivo é fazer você se sentir único.
          </p>
        </div>

        <div className="mt-12 md:mt-16">
          <Link 
            href="/colecoes" 
            className="inline-flex items-center justify-center gap-2 md:gap-3 bg-hb-gold text-hb-black px-6 md:px-8 py-3 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-widest hover:bg-hb-goldLight transition-colors w-full sm:w-auto rounded"
          >
            Conheça Nossas Peças <ArrowRight size={16} className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </main>
  )
}
