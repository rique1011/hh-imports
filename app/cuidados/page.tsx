import { Droplets, Sparkles, Archive, ShieldAlert, FlaskConical, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function PaginaCuidados() {
  return (
    <main className="min-h-screen bg-hb-black py-12 md:py-16">
      <div className="max-w-4xl mx-auto px-4 md:px-6">
        
        {/* Cabeçalho */}
        <div className="text-center mb-10 md:mb-16">
          <h1 className="text-2xl md:text-4xl font-light text-white uppercase tracking-widest mb-3 md:mb-4 italic">
            Guia de Cuidados
          </h1>
          <p className="text-xs md:text-sm text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Nossas joias exigem cuidados especiais para manterem seu brilho impecável. Siga estas orientações para preservar sua peça.
          </p>
        </div>

        {/* Grid de Regras Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-12 md:mb-16">
          
          <div className="bg-hb-gray p-6 md:p-8 rounded-2xl border border-gray-800 shadow-sm transition-colors hover:border-hb-gold/50">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-hb-black border border-gray-700 rounded-full flex items-center justify-center mb-4 md:mb-6">
              <Droplets className="text-hb-gold w-4 h-4 md:w-5 md:h-5" />
            </div>
            <h3 className="text-xs md:text-sm font-bold text-white uppercase tracking-widest mb-2 md:mb-3">
              Não Molhar
            </h3>
            <p className="text-xs md:text-sm text-gray-400 leading-relaxed">
              Retire sua joia antes de tomar banho, entrar no mar ou piscina. A água e sabonetes aceleram a oxidação e podem danificar o banho da peça permanentemente.
            </p>
          </div>

          <div className="bg-hb-gray p-6 md:p-8 rounded-2xl border border-gray-800 shadow-sm transition-colors hover:border-hb-gold/50">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-hb-black border border-gray-700 rounded-full flex items-center justify-center mb-4 md:mb-6">
              <Sparkles className="text-hb-gold w-4 h-4 md:w-5 md:h-5" />
            </div>
            <h3 className="text-xs md:text-sm font-bold text-white uppercase tracking-widest mb-2 md:mb-3">
              Evite Perfumes
            </h3>
            <p className="text-xs md:text-sm text-gray-400 leading-relaxed">
              Cosméticos e perfumes contêm álcool que corrói o banho da joia. Aplique seus produtos, espere a pele secar completamente e só então coloque sua peça.
            </p>
          </div>

          <div className="bg-hb-gray p-6 md:p-8 rounded-2xl border border-gray-800 shadow-sm transition-colors hover:border-hb-gold/50">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-hb-black border border-gray-700 rounded-full flex items-center justify-center mb-4 md:mb-6">
              <Archive className="text-hb-gold w-4 h-4 md:w-5 md:h-5" />
            </div>
            <h3 className="text-xs md:text-sm font-bold text-white uppercase tracking-widest mb-2 md:mb-3">
              Guarde em Local Seco
            </h3>
            <p className="text-xs md:text-sm text-gray-400 leading-relaxed">
              Guarde suas joias em local seco e escuro, preferencialmente na embalagem original ou em porta-joias forrados, separadas umas das outras.
            </p>
          </div>

          <div className="bg-hb-gray p-6 md:p-8 rounded-2xl border border-gray-800 shadow-sm transition-colors hover:border-hb-gold/50">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-hb-black border border-gray-700 rounded-full flex items-center justify-center mb-4 md:mb-6">
              <FlaskConical className="text-hb-gold w-4 h-4 md:w-5 md:h-5" />
            </div>
            <h3 className="text-xs md:text-sm font-bold text-white uppercase tracking-widest mb-2 md:mb-3">
              Produtos Químicos
            </h3>
            <p className="text-xs md:text-sm text-gray-400 leading-relaxed">
              Nunca utilize produtos de limpeza, álcool ou abrasivos. Para devolver o brilho, utilize apenas uma flanela mágica seca e limpa, esfregando suavemente.
            </p>
          </div>

        </div>

        {/* Caixa de Atenção */}
        <div className="bg-gradient-to-r from-hb-gray to-hb-black border border-hb-gold/30 text-white p-6 md:p-10 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
            <div className="flex-shrink-0 p-3 md:p-4 bg-hb-gold/20 rounded-full">
              <ShieldAlert size={24} className="text-hb-gold md:w-8 md:h-8" />
            </div>
            <div>
              <h2 className="text-sm md:text-lg font-bold text-hb-gold uppercase tracking-widest mb-2">
                Sobre a Nossa Garantia
              </h2>
              <p className="text-xs md:text-sm text-gray-300 leading-relaxed">
                Nossa garantia cobre exclusivamente defeitos de fabricação. Danos causados por mau uso (contato com água, produtos químicos, quedas) caracterizam desgaste inadequado e <strong className="text-white">não estão cobertos</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Botão de Voltar */}
        <div className="mt-12 md:mt-16 text-center">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-[10px] md:text-xs font-bold text-hb-gold uppercase tracking-widest hover:text-hb-goldLight transition-colors border-b-2 border-hb-gold pb-1 hover:border-hb-goldLight"
          >
            Voltar para a Loja <ChevronRight size={14} className="md:w-4 md:h-4" />
          </Link>
        </div>

      </div>
    </main>
  )
}
