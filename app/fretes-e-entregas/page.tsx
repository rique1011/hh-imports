import { Truck, ShieldCheck, Clock } from 'lucide-react'
import { MENSAGEM_FRETE_GRATIS } from '@/lib/politica-frete'

export default function FretesEntregas() {
  return (
    <main className="min-h-screen bg-hb-black">
      <section className="bg-hb-gray py-24 text-center px-6 border-b border-hb-black">
        <h1 className="text-3xl md:text-5xl font-light text-white uppercase tracking-widest italic mb-4">Fretes e Entregas</h1>
        <p className="text-hb-gold text-sm uppercase tracking-widest">Tudo sobre o envio da sua joia</p>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-20 space-y-12 text-gray-400 font-light leading-relaxed">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center border-b border-gray-800 pb-12">
          <div className="flex flex-col items-center gap-3">
            <Truck size={32} className="text-hb-gold" />
            <h3 className="font-bold text-gray-200 uppercase tracking-widest text-xs">Para todo o Brasil</h3>
          </div>
          <div className="flex flex-col items-center gap-3">
            <ShieldCheck size={32} className="text-hb-gold" />
            <h3 className="font-bold text-gray-200 uppercase tracking-widest text-xs">Envio Seguro</h3>
          </div>
          <div className="flex flex-col items-center gap-3">
            <Clock size={32} className="text-hb-gold" />
            <h3 className="font-bold text-gray-200 uppercase tracking-widest text-xs">Rastreio em Tempo Real</h3>
          </div>
        </div>

        <div className="rounded-xl border border-hb-gold/40 bg-hb-gray p-6">
          <h2 className="mb-4 font-serif text-2xl text-hb-goldLight">Frete grátis para todo o Brasil</h2>
          <p className="text-white">{MENSAGEM_FRETE_GRATIS}</p>
          <p className="mt-3">O benefício considera o subtotal das peças antes de cupons e créditos. A embalagem para presente não entra nesse valor. A modalidade gratuita é econômica e escolhida pela loja entre os serviços disponíveis para o seu CEP. Consulte a transportadora e o prazo no carrinho.</p>
          <p className="mt-3">Informe nome completo, CPF ou CNPJ, telefone e endereço completo com CEP, número e complemento, se houver. Esses dados serão usados na etiqueta de envio.</p>
        </div>

        <div>
          <h2 className="text-xl font-light uppercase tracking-widest text-white mb-4 border-l-2 border-hb-gold pl-4">1. Prazos de Envio</h2>
          <p>Após a confirmação do pagamento, seu pedido passará por uma rigorosa conferência de qualidade. O despacho ocorre em até 2 dias úteis. O prazo de transporte começa após a postagem ou coleta e varia conforme a modalidade e o seu CEP. A geração da etiqueta prepara o envio; acompanhe a movimentação da transportadora em Meus Pedidos.</p>
        </div>

        <div>
          <h2 className="text-xl font-light uppercase tracking-widest text-white mb-4 border-l-2 border-hb-gold pl-4">2. Rastreamento</h2>
          <p>Você receberá o código de rastreamento no seu e-mail assim que a caixa for despachada. Você poderá acompanhar cada passo da entrega diretamente na aba &quot;Meus Pedidos&quot; em sua conta na H&H IMPORTS.</p>
        </div>

        <div>
          <h2 className="text-xl font-light uppercase tracking-widest text-white mb-4 border-l-2 border-hb-gold pl-4">3. Embalagem do pedido</h2>
          <p>A embalagem padrão é simples e preparada para proteger as peças no transporte. Uma apresentação especial para presente é opcional e tem custo adicional de R$ 15, exibido na sacola antes do pagamento. Ela só acompanha o pedido quando essa opção é selecionada e paga.</p>
        </div>
      </section>
    </main>
  )
}
