import { Truck, ShieldCheck, Clock } from 'lucide-react'

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

        <div>
          <h2 className="text-xl font-light uppercase tracking-widest text-white mb-4 border-l-2 border-hb-gold pl-4">1. Prazos de Envio</h2>
          <p>Após a confirmação do pagamento, seu pedido passará por uma rigorosa conferência de qualidade. O despacho ocorre em até 2 dias úteis. O prazo de entrega começa a contar a partir do momento em que o código de rastreio é gerado e varia de acordo com a modalidade escolhida e o seu CEP.</p>
        </div>

        <div>
          <h2 className="text-xl font-light uppercase tracking-widest text-white mb-4 border-l-2 border-hb-gold pl-4">2. Rastreamento</h2>
          <p>Você receberá o código de rastreamento no seu e-mail assim que a caixa for despachada. Você poderá acompanhar cada passo da entrega diretamente na aba "Meus Pedidos" em sua conta na H&H IMPORTS.</p>
        </div>

        <div>
          <h2 className="text-xl font-light uppercase tracking-widest text-white mb-4 border-l-2 border-hb-gold pl-4">3. Embalagem de Luxo</h2>
          <p>Garantimos que a experiência do unboxing seja inesquecível. Todas as nossas peças são enviadas em caixas de joias personalizadas de alto padrão, perfeitamente seguras e preparadas para presentear.</p>
        </div>
      </section>
    </main>
  )
}
