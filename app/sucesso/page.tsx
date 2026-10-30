'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, ShoppingBag, ArrowRight, Camera, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useCart } from '@/lib/store'

function ConteudoSucesso() {
  const searchParams = useSearchParams()
  const { limparCarrinho } = useCart() as any
  const pedidoId = searchParams.get('external_reference')

  useEffect(() => {
    if (limparCarrinho) limparCarrinho()
  }, [limparCarrinho])

  return (
    <main className="min-h-[85vh] flex items-center justify-center bg-hb-black px-4 md:px-6 py-10 md:py-12">
      <div className="max-w-md w-full text-center space-y-6 md:space-y-8 animate-in fade-in zoom-in slide-in-from-bottom-4 duration-700">
        
        {/* ÍCONE DE SUCESSO ANIMADO */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping opacity-30"></div>
            <div className="bg-green-900/30 p-3 md:p-4 rounded-full relative z-10 border border-green-800">
              <CheckCircle2 size={48} className="text-green-400 md:w-16 md:h-16" />
            </div>
          </div>
        </div>

        {/* MENSAGEM PRINCIPAL */}
        <div className="space-y-3 md:space-y-4">
          <h1 className="text-2xl md:text-3xl font-light uppercase tracking-widest text-white italic">
            Compra Aprovada
          </h1>
          <p className="text-gray-400 text-xs md:text-sm leading-relaxed px-2 md:px-4 font-light">
            Sua joia exclusiva da <strong className="text-hb-gold font-normal">H&H IMPORTS</strong> já está sendo separada e embalada com todo o cuidado. Enviamos os detalhes e o recibo para o seu e-mail.
          </p>
        </div>

        {/* NÚMERO DO PEDIDO */}
        {pedidoId && (
          <div className="bg-gradient-to-r from-hb-gray to-hb-black border border-hb-gold/30 p-4 md:p-5 rounded-xl shadow-sm">
            <p className="text-[9px] md:text-[10px] font-bold text-hb-gold uppercase tracking-widest mb-1">Número do Pedido</p>
            <p className="text-lg md:text-xl font-black text-white tracking-widest">#{pedidoId.toUpperCase()}</p>
          </div>
        )}

        {/* BANNER CLUBE VIP */}
        <div className="bg-hb-gray border border-gray-800 p-4 md:p-5 rounded-xl flex items-start gap-3 md:gap-4 text-left">
          <div className="bg-hb-black border border-gray-700 p-2 rounded-lg shadow-sm shrink-0">
            <Camera size={18} className="text-hb-gold md:w-5 md:h-5" />
          </div>
          <div>
            <h3 className="text-[10px] md:text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1 mb-1">
              Clube VIP <Sparkles size={10} className="text-hb-gold md:w-3 md:h-3" />
            </h3>
            <p className="text-[9px] md:text-[10px] text-gray-400 leading-relaxed">
              Quando sua joia chegar, poste uma foto nos stories marcando <strong className="text-hb-gold">o perfil da H&H IMPORTS</strong> e ganhe um cupom de <strong className="text-white">10% OFF</strong> para a próxima compra!
            </p>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="flex flex-col gap-2 md:gap-3 pt-2">
          <Link 
            href="/minha-conta" 
            className="w-full bg-hb-gold text-hb-black py-3 md:py-4 font-bold text-[10px] md:text-xs uppercase tracking-widest hover:bg-hb-goldLight transition flex items-center justify-center gap-2 rounded shadow-md"
          >
            Acompanhar Entrega <ArrowRight size={14} className="md:w-4 md:h-4" />
          </Link>
          
          <Link 
            href="/" 
            className="w-full bg-transparent border border-gray-700 text-white py-3 md:py-4 font-bold text-[10px] md:text-xs uppercase tracking-widest hover:border-hb-gold hover:text-hb-gold transition flex items-center justify-center gap-2 rounded"
          >
            <ShoppingBag size={14} className="md:w-4 md:h-4" /> Continuar Comprando
          </Link>
        </div>

        <p className="text-[8px] md:text-[10px] text-gray-500 uppercase font-bold tracking-widest px-4">
          Dúvidas? Entre em contato pelo nosso WhatsApp.
        </p>
      </div>
    </main>
  )
}

export default function PaginaSucesso() {
  return (
    <Suspense fallback={
      <div className="min-h-[85vh] bg-hb-black flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-4 border-gray-800 border-t-hb-gold rounded-full animate-spin"></div>
        <p className="text-[10px] md:text-xs uppercase tracking-widest font-bold text-gray-500">Verificando pagamento...</p>
      </div>
    }>
      <ConteudoSucesso />
    </Suspense>
  )
}
