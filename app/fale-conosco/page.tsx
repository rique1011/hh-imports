import { Mail, Phone, MapPin, Send } from 'lucide-react'

export default function FaleConosco() {
  return (
    <main className="min-h-screen bg-hb-black">
      <section className="bg-hb-gray py-24 text-center px-6 border-b border-hb-black">
        <h1 className="text-3xl md:text-5xl font-light text-white uppercase tracking-widest italic mb-4">Fale Conosco</h1>
        <p className="text-hb-gold text-sm uppercase tracking-widest">Estamos à disposição para um atendimento exclusivo</p>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 md:grid-cols-2 gap-16">
        <div className="space-y-10">
          <div>
            <h2 className="text-xl font-light uppercase tracking-widest mb-6 border-b border-gray-800 pb-4 text-white">Nossos Contatos</h2>
            <div className="space-y-6 text-gray-400 font-light">
              <div className="flex items-start gap-4">
                <Mail className="text-hb-gold mt-1" size={20} />
                <div>
                  <p className="font-bold text-gray-200 uppercase tracking-widest text-xs mb-1">E-mail</p>
                  <p>H&H IMPORTS@gmail.com</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Phone className="text-hb-gold mt-1" size={20} />
                <div>
                  <p className="font-bold text-gray-200 uppercase tracking-widest text-xs mb-1">WhatsApp</p>
                  <p>(47) 99738-6824 <br/><span className="text-xs text-gray-500">Seg a Sex das 09h às 18h</span></p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <MapPin className="text-hb-gold mt-1" size={20} />
                <div>
                  <p className="font-bold text-gray-200 uppercase tracking-widest text-xs mb-1">Localização</p>
                  <p>Joinville, SC <br/><span className="text-xs text-gray-500">Enviamos para todo o Brasil</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form className="bg-hb-gray p-8 rounded-2xl border border-gray-800 space-y-4 shadow-sm">
          <h2 className="text-xl font-light uppercase tracking-widest mb-6 text-white">Envie uma Mensagem</h2>
          <input type="text" placeholder="Seu Nome Completo" className="w-full p-4 text-sm bg-hb-black border border-gray-700 text-white outline-none focus:border-hb-gold transition placeholder-gray-600 rounded" />
          <input type="email" placeholder="Seu E-mail" className="w-full p-4 text-sm bg-hb-black border border-gray-700 text-white outline-none focus:border-hb-gold transition placeholder-gray-600 rounded" />
          <textarea rows={5} placeholder="Como podemos te ajudar?" className="w-full p-4 text-sm bg-hb-black border border-gray-700 text-white outline-none focus:border-hb-gold transition placeholder-gray-600 resize-none rounded"></textarea>
          <button type="button" className="w-full bg-hb-gold text-hb-black py-4 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-hb-goldLight transition rounded">
            Enviar Mensagem <Send size={14} />
          </button>
        </form>
      </section>
    </main>
  )
}
