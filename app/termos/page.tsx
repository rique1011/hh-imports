'use client'

import Link from 'next/link'
import { ArrowLeft, ScrollText } from 'lucide-react'

export default function PaginaTermos() {
  return (
    <main className="min-h-screen bg-hb-black py-12 md:py-20 px-4 md:px-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/cadastro" className="inline-flex items-center gap-2 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 hover:text-hb-gold transition mb-8 md:mb-12">
          <ArrowLeft size={14} className="md:w-4 md:h-4" /> Voltar ao Cadastro
        </Link>

        <div className="flex items-center gap-3 md:gap-4 mb-8 md:mb-12 pb-6 md:pb-8 border-b border-hb-gray">
          <div className="bg-hb-gray border border-gray-800 p-2 md:p-3 rounded-full shrink-0">
            <ScrollText size={20} className="text-hb-gold md:w-6 md:h-6" />
          </div>
          <h1 className="text-xl md:text-3xl font-light uppercase tracking-widest italic text-white leading-tight">Termos de Uso</h1>
        </div>

        <div className="space-y-6 md:space-y-8 text-gray-400 leading-relaxed font-light text-sm md:text-base">
          <section>
            <h2 className="text-[11px] md:text-sm font-bold text-hb-gold uppercase tracking-widest mb-3 md:mb-4">1. Aceitação dos Termos</h2>
            <p>Ao acessar e utilizar o site da H&H IMPORTS, você concorda em cumprir e estar vinculado aos seguintes termos e condições de uso. Se você não concordar com qualquer parte destes termos, não deverá utilizar nosso site.</p>
          </section>

          <section>
            <h2 className="text-[11px] md:text-sm font-bold text-hb-gold uppercase tracking-widest mb-3 md:mb-4">2. Propriedade Intelectual</h2>
            <p>Todo o conteúdo incluído neste site, como textos, gráficos, logotipos, ícones, imagens e seleção de produtos, é de propriedade exclusiva da H&H IMPORTS e protegido pelas leis de direitos autorais brasileiras e internacionais.</p>
          </section>

          <section>
            <h2 className="text-[11px] md:text-sm font-bold text-hb-gold uppercase tracking-widest mb-3 md:mb-4">3. Políticas de Compra e Pagamento</h2>
            <p>Todas as compras estão sujeitas à confirmação de disponibilidade de estoque. Os preços e condições de pagamento são exclusivos para compras via site. Reservamo-nos o direito de corrigir eventuais erros de digitação em preços ou descrições.</p>
          </section>

          <section>
            <h2 className="text-[11px] md:text-sm font-bold text-hb-gold uppercase tracking-widest mb-3 md:mb-4">4. Trocas e Devoluções</h2>
            <p>O cliente tem o direito de arrependimento em até 7 dias corridos após o recebimento. Para joias e itens importados, o produto deve ser devolvido em sua embalagem original, sem sinais de uso e com todos os lacres intactos.</p>
          </section>

          <section>
            <h2 className="text-[11px] md:text-sm font-bold text-hb-gold uppercase tracking-widest mb-3 md:mb-4">5. Limitação de Responsabilidade</h2>
            <p>A H&H IMPORTS não se responsabiliza por danos decorrentes do uso inadequado das joias (contato com produtos químicos, perfumes ou quedas). As orientações de cuidado enviadas por e-mail devem ser seguidas rigorosamente.</p>
          </section>
        </div>
      </div>
    </main>
  )
}
