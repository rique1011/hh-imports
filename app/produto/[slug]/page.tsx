import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import BotaoAdicionar from '@/components/BotaoAdicionar'
import BotaoFavorito from '@/components/BotaoFavorito'
import CalculadorFrete from '@/components/CalculadorFrete'
import Avaliacoes from '@/components/Avaliacoes'
import ZoomImagem from '@/components/ZoomImagem'
import ContadorVisitas from '@/components/ContadorVisitas' 
import { Play } from 'lucide-react'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function PaginaProduto({ params }: PageProps) {
  const { slug } = await params

  const { data: produto } = await supabase
    .from('produtos')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!produto) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-hb-black relative">
      <ContadorVisitas slug={slug} />

      <div className="max-w-6xl mx-auto px-4 py-8 md:p-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-16 md:mb-20">
          
          {/* LADO ESQUERDO: GALERIA DE MÍDIA */}
          <div className="space-y-4 md:space-y-4 w-full">
            <div className="w-full">
              {produto.fotos && produto.fotos.length > 0 ? (
                <div className="w-full relative rounded-2xl overflow-hidden shadow-lg border border-gray-800">
                  <ZoomImagem 
                    src={produto.fotos[0]} 
                    alt={produto.nome} 
                    material={produto.material} 
                  />
                </div>
              ) : (
                <div className="bg-hb-gray rounded-2xl aspect-[4/5] flex items-center justify-center border border-gray-800 text-gray-500 italic">
                  Sem imagem disponível
                </div>
              )}
            </div>

            {produto.video_url && (
              <div className="mt-6 md:mt-8 w-full">
                <div className="flex items-center gap-2 mb-3 md:mb-4">
                  <Play size={14} className="text-hb-gold md:w-4 md:h-4" />
                  <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-hb-gold">Veja em Detalhes</h3>
                </div>
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] md:aspect-video max-h-[400px] md:max-h-[500px] border border-gray-800 shadow-lg w-full">
                  <video 
                    src={produto.video_url}
                    controls loop muted autoPlay playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 md:top-4 md:right-4 bg-black/40 backdrop-blur-md px-2 py-1 md:px-3 md:py-1 rounded-full border border-white/10">
                    <p className="text-[7px] md:text-[8px] text-white font-bold uppercase tracking-widest">Vídeo Real</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* LADO DIREITO: DETALHES */}
          <div className="flex flex-col justify-start md:justify-center w-full">
            <span className="text-[10px] md:text-sm text-gray-500 uppercase tracking-[0.3em] mb-2 font-medium">H&H IMPORTS</span>
            
            <div className="flex items-start justify-between gap-4 mb-3 md:mb-4">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-light text-white uppercase tracking-tight leading-none break-words flex-1">
                {produto.nome}
              </h1>
              <div className="flex-shrink-0 mt-1 md:mt-2">
                <BotaoFavorito produto={produto} />
              </div>
            </div>
            
            <div className="text-2xl md:text-3xl font-bold text-hb-gold mb-5 md:mb-6">
              R$ {Number(produto.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>

            <div className="border-t border-gray-800 py-5 md:py-6 mb-6 md:mb-8 space-y-3 md:space-y-4">
              <div>
                <h3 className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 md:mb-2">Descrição</h3>
                <p className="text-gray-400 leading-relaxed text-xs md:text-sm font-light">
                  {produto.descricao || 'Nenhuma descrição disponível para este item exclusivo.'}
                </p>
              </div>
              
              {produto.material && (
                <div>
                  <h3 className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Composição</h3>
                  <p className="text-xs md:text-sm font-medium text-white">{produto.material}</p>
                </div>
              )}

              <div className="pt-2">
                <Link href="/cuidados" className="text-[9px] md:text-[10px] uppercase font-bold tracking-widest underline text-hb-gold hover:text-hb-goldLight transition">
                  Ver guia de cuidados e garantia
                </Link>
              </div>
            </div>

            <div className="w-full">
              <BotaoAdicionar produto={produto} />
            </div>

            <div className="mt-5 md:mt-6 w-full">
              <CalculadorFrete />
            </div>

            <div className="mt-6 md:mt-8 grid grid-cols-2 gap-3 md:gap-4 text-center border-t border-gray-800 pt-6 md:pt-8 w-full">
              <div className="p-3 md:p-4 bg-hb-gray rounded-xl border border-gray-800 shadow-sm flex flex-col justify-center">
                <p className="text-[8px] md:text-[9px] text-gray-500 uppercase font-bold tracking-widest">Qualidade</p>
                <p className="text-[10px] md:text-[11px] font-black text-white mt-1 uppercase leading-tight">Garantia Vitalícia</p>
              </div>
              <div className="p-3 md:p-4 bg-hb-gray rounded-xl border border-gray-800 shadow-sm flex flex-col justify-center">
                <p className="text-[8px] md:text-[9px] text-gray-500 uppercase font-bold tracking-widest">Pagamento</p>
                <p className="text-[10px] md:text-[11px] font-black text-white mt-1 uppercase leading-tight">Pix ou 10x s/ juros</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto border-t border-gray-800 pt-12 md:pt-16 w-full">
          <Avaliacoes produtoId={produto.id} />
        </div>
      </div>
    </main>
  )
}
