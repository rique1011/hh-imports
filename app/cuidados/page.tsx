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
            Joias folheadas, prata 925 e bijuterias precisam de cuidados diferentes. Confira a composição na página da peça e siga também as orientações específicas do fabricante.
          </p>
        </div>

        {/* Grid de Regras Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-12 md:mb-16">
          
          <div className="bg-hb-gray p-6 md:p-8 rounded-2xl border border-gray-800 shadow-sm transition-colors hover:border-hb-gold/50">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-hb-black border border-gray-700 rounded-full flex items-center justify-center mb-4 md:mb-6">
              <Droplets className="text-hb-gold w-4 h-4 md:w-5 md:h-5" />
            </div>
            <h3 className="text-xs md:text-sm font-bold text-white uppercase tracking-widest mb-2 md:mb-3">
              Evite água e atrito
            </h3>
            <p className="text-xs md:text-sm text-gray-400 leading-relaxed">
              Retire as peças antes do banho, do mar, da piscina, de dormir ou de praticar exercícios. Cloro, sal, suor e atrito podem afetar o acabamento, especialmente em folheados e bijuterias. Não considere uma peça resistente à água sem essa informação no anúncio.
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
              Evite contato direto com perfumes, cremes e produtos de limpeza. Aplique os cosméticos, espere a pele secar e só então coloque a peça.
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
              Para folheados e bijuterias, prefira um pano macio, seco e sem abrasivos, com movimentos leves. Não use pasta de dente, álcool, receitas caseiras ou polidores de prata nesses acabamentos. Se houver pedras, pérolas ou partes coladas, não deixe a peça de molho.
            </p>
          </div>

        </div>

        <section className="mb-10 rounded-xl border border-luxury-line bg-hb-gray p-6 md:p-8">
          <h2 className="mb-3 font-serif text-xl text-hb-goldLight">Cuidados com a prata 925</h2>
          <p className="text-sm leading-7 text-gray-300">A prata 925 pode escurecer naturalmente por oxidação. Isso não significa, por si só, que a peça seja falsa. Use um pano adequado à prata e siga a orientação do fabricante; peças com banho, pedras ou acabamento especial podem exigir outro cuidado. Em caso de dúvida sobre manchas ou limpeza, fale conosco antes de aplicar qualquer produto.</p>
        </section>

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
                A garantia legal para defeitos aparentes em produtos duráveis é de 90 dias a partir do recebimento. Para vícios ocultos, a contagem começa quando o problema fica evidente. Desgaste natural e danos por uso inadequado precisam de análise individual; estas orientações não afastam os direitos do consumidor. Se notar um problema, registre a solicitação em Minha Conta ou fale com o atendimento.
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
