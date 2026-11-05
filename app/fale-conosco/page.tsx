import { Mail, Phone, MapPin } from 'lucide-react'
import { CONTACT_EMAIL } from '@/lib/brand'
import FormularioContato from '@/components/FormularioContato'

export default function FaleConosco() {
  return (
    <main className="min-h-screen bg-hb-black">
      <section className="bg-hb-gray py-24 text-center px-6 border-b border-hb-black">
        <h1 className="text-3xl md:text-5xl font-light text-white uppercase tracking-widest italic mb-4">Fale Conosco</h1>
        <p className="text-hb-gold text-sm uppercase tracking-widest">Estamos à disposição para um atendimento exclusivo</p>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
        <div className="min-w-0 space-y-10">
          <div>
            <h2 className="text-xl font-light uppercase tracking-widest mb-6 border-b border-gray-800 pb-4 text-white">Nossos Contatos</h2>
            <div className="space-y-6 text-gray-400 font-light">
              <div className="flex items-start gap-4">
                <Mail className="text-hb-gold mt-1 shrink-0" size={20} />
                <div className="min-w-0">
                  <p className="font-bold text-gray-200 uppercase tracking-widest text-xs mb-1">E-mail</p>
                  <a href={'mailto:' + CONTACT_EMAIL} className="break-all hover:text-hb-gold">{CONTACT_EMAIL}</a>
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

        <FormularioContato />
      </section>
    </main>
  )
}
