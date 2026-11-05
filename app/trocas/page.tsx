import { CONTACT_EMAIL } from '@/lib/brand'
import { RefreshCcw, ShieldAlert, BadgeInfo, Tag, Mail, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function PaginaTrocas() {
  return (
    <main className="min-h-screen bg-hb-black py-12 md:py-16">
      <div className="max-w-4xl mx-auto px-4 md:px-6">
        
        {/* Cabeçalho */}
        <div className="text-center mb-10 md:mb-16">
          <h1 className="text-2xl md:text-4xl font-light text-white uppercase tracking-widest mb-3 md:mb-4 italic">
            Trocas e Devoluções
          </h1>
          <p className="text-xs md:text-sm text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Nossa política foi elaborada com base no Código de Defesa do Consumidor (CDC) para garantir a sua segurança e a transparência em nossas relações.
          </p>
        </div>

        <div className="space-y-6 md:space-y-8 mb-12 md:mb-16">
          
          {/* Regra 1 */}
          <div className="bg-hb-gray p-6 md:p-8 rounded-2xl border border-gray-800 shadow-sm flex flex-col md:flex-row gap-4 md:gap-6 items-start transition-colors hover:border-hb-gold/50">
            <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-hb-black border border-gray-700 rounded-full flex items-center justify-center">
              <RefreshCcw className="text-hb-gold w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div>
              <h3 className="text-xs md:text-sm font-bold text-white uppercase tracking-widest mb-2 md:mb-3">
                Direito de Arrependimento (7 dias)
              </h3>
              <p className="text-xs md:text-sm text-gray-400 leading-relaxed">
                Você pode desistir da compra em até <strong className="text-gray-200">7 (sete) dias corridos</strong>, contados a partir do dia seguinte ao recebimento, conforme o Art. 49 do CDC. Registre o pedido de devolução em Minha Conta. Preserve a peça, os acessórios e a embalagem para facilitar o atendimento.
              </p>
            </div>
          </div>

          {/* Regra 2 (CRÍTICO) */}
          <div className="bg-red-900/20 p-6 md:p-8 rounded-2xl border border-red-800/30 shadow-sm flex flex-col md:flex-row gap-4 md:gap-6 items-start">
            <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-hb-black border border-red-800/50 rounded-full flex items-center justify-center shadow-sm">
              <ShieldAlert className="text-red-500 w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div>
              <h3 className="text-xs md:text-sm font-bold text-red-400 uppercase tracking-widest mb-2 md:mb-3">
                Brincos e Questões de Higiene
              </h3>
              <p className="text-xs md:text-sm text-red-200/80 leading-relaxed">
                Preserve a higiene, os acessórios e a embalagem das peças. Em caso de dúvidas sobre brincos ou sobre as condições do produto recebido, fale com nosso atendimento. As solicitações serão analisadas respeitando os direitos previstos no CDC.
              </p>
            </div>
          </div>

          {/* Regra 3 */}
          <div className="bg-hb-gray p-6 md:p-8 rounded-2xl border border-gray-800 shadow-sm flex flex-col md:flex-row gap-4 md:gap-6 items-start transition-colors hover:border-hb-gold/50">
            <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-hb-black border border-gray-700 rounded-full flex items-center justify-center">
              <Tag className="text-hb-gold w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div>
              <h3 className="text-xs md:text-sm font-bold text-white uppercase tracking-widest mb-2 md:mb-3">
                Peças em Promoção ou Outlet
              </h3>
              <p className="text-xs md:text-sm text-gray-400 leading-relaxed">
                Compras em promoção também seguem o prazo de arrependimento de 7 dias após o recebimento e a garantia legal. Pedidos de troca por preferência de modelo ou tamanho devem ser registrados nesse prazo; o atendimento para defeitos permanece disponível conforme os direitos aplicáveis.
              </p>
            </div>
          </div>

          {/* Regra 4 */}
          <div className="bg-hb-gray p-6 md:p-8 rounded-2xl border border-gray-800 shadow-sm flex flex-col md:flex-row gap-4 md:gap-6 items-start transition-colors hover:border-hb-gold/50">
            <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-hb-black border border-gray-700 rounded-full flex items-center justify-center">
              <BadgeInfo className="text-hb-gold w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div>
              <h3 className="text-xs md:text-sm font-bold text-white uppercase tracking-widest mb-2 md:mb-3">
                Defeitos de Fabricação
              </h3>
              <p className="text-xs md:text-sm text-gray-400 leading-relaxed">
                Defeitos aparentes em produtos duráveis seguem a garantia legal de <strong className="text-gray-200">90 dias</strong>, contados do recebimento (Art. 26 do CDC). Para vícios ocultos, o prazo começa quando o problema fica evidente. Relate o defeito e envie fotos pelo atendimento para análise; esse fluxo não é encerrado automaticamente após os 7 dias de arrependimento.
              </p>
            </div>
          </div>

        </div>

        {/* Como Solicitar */}
        <div className="bg-gradient-to-r from-hb-gray to-hb-black border border-hb-gold/30 text-white p-6 md:p-10 rounded-2xl shadow-lg text-center">
          <Mail size={24} className="mx-auto mb-3 md:mb-4 text-hb-gold md:w-8 md:h-8" />
          <h2 className="text-sm md:text-lg font-bold uppercase tracking-widest mb-3 md:mb-4 text-hb-gold">
            Como solicitar sua troca?
          </h2>
          <p className="text-xs md:text-sm text-gray-300 leading-relaxed mb-4 md:mb-8 max-w-xl mx-auto">
            Use a aba Trocas e Devoluções em Minha Conta. Se a data de recebimento estiver pendente ou precisar de ajuda, envie o número do pedido para <a href={'mailto:' + CONTACT_EMAIL} className="break-all text-white underline">{CONTACT_EMAIL}</a>. Para defeitos, inclua fotos do produto. Retornaremos com as instruções em até 48 horas úteis.
          </p>
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
