import type { Produto } from '@/types/loja'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { ArrowRight, ShieldCheck, Truck, Gem, Ticket } from 'lucide-react'

export const revalidate = 0

export default async function Home() {
  const [{ data: produtos }, { data: cupons }] = await Promise.all([
    supabase.from('produtos').select('id,nome,slug,preco,fotos,material,estoque,estoque_reservado')
      .order('criado_em', { ascending: false }).limit(12),
    getSupabaseAdmin().from('cupons').select('codigo,desconto').eq('ativo', true).is('usuario_id', null).gt('desconto', 0)
      .order('desconto', { ascending: false }).limit(1),
  ])

  const cupomDestaque = cupons?.[0] || null

  const destaques = produtos?.slice(0, 4) || []
  const lancamentos = produtos?.slice(4, 8).length ? produtos?.slice(4, 8) : destaques
  const maisVendidos = produtos?.slice(8, 12).length ? produtos?.slice(8, 12) : destaques

  const renderVitrine = (titulo: string, lista: Pick<Produto, 'id' | 'nome' | 'slug' | 'preco' | 'fotos' | 'material'>[], corFundo: string, idSecao: string) => (
    <section id={idSecao} className={`${corFundo} py-12 md:py-24 border-b border-hb-gray`}>
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        
        {/* CABEÇALHO DA VITRINE */}
        <div className="flex flex-col md:flex-row justify-between items-center md:items-end mb-8 md:mb-12 gap-4 md:gap-6 text-center md:text-left">
          <div className="flex flex-col items-center md:items-start">
            <h2 className="text-xl md:text-3xl font-light text-white uppercase tracking-widest mb-3 md:mb-4">{titulo}</h2>
            <div className="w-12 h-[1px] bg-hb-gold"></div>
          </div>
          <Link href="/colecoes" className="text-[10px] font-bold text-hb-gold uppercase tracking-widest border-b border-hb-gold pb-1 hover:text-hb-goldLight hover:border-hb-goldLight transition-all">
            Ver Toda a Coleção
          </Link>
        </div>

        {/* GRID DE PRODUTOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-8">
          {lista && lista.length > 0 ? (
            lista.map((produto) => (
              <Link key={produto.id} href={`/produto/${produto.slug}`} className="group block min-w-0">
                <div className="relative bg-hb-black aspect-[4/5] rounded-xl overflow-hidden mb-3 md:mb-4 border border-hb-gray shadow-sm">
                  {produto.fotos && produto.fotos[0] ? (
                    <Image 
                      src={produto.fotos[0]} 
                      alt={produto.nome} 
                      fill
                      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 300px"
                      className="object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-hb-gray text-gray-500 text-[10px] md:text-xs uppercase tracking-widest text-center px-2">Sem foto</div>
                  )}
                  {produto.material && (
                    <div className="absolute top-2 left-2 md:top-3 md:left-3 bg-hb-gold text-hb-black px-2 py-1 rounded text-[7px] md:text-[8px] font-black uppercase tracking-widest shadow-lg z-10">
                      {produto.material}
                    </div>
                  )}
                </div>
                <div className="text-center px-1 md:px-2">
                  <h3 className="text-[10px] md:text-xs font-bold text-gray-200 uppercase tracking-wider mb-1 md:mb-2 line-clamp-2 min-h-8 break-words group-hover:text-white transition-colors">{produto.nome}</h3>
                  <p className="text-xs md:text-sm text-hb-gold font-medium">R$ {Number(produto.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-gray-600 text-xs md:text-sm uppercase tracking-widest">
              Nenhum produto cadastrado ainda.
            </div>
          )}
        </div>
      </div>
    </section>
  )

  return (
    <main className="min-h-screen bg-hb-black">
      
      {/* 1. HERO BANNER PRINCIPAL (Com carregamento de alta prioridade) */}
      <section className="relative min-h-[28rem] h-[75svh] md:min-h-[32rem] md:h-[85svh] flex items-center justify-center bg-black overflow-hidden border-b border-hb-gray">
        <Image 
          src="https://images.unsplash.com/photo-1599643478524-fb66f7ca065b?q=80&w=2000"
          alt="Hero Banner H&H IMPORTS"
          fill
          preload
          sizes="100vw"
          className="object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-hb-black via-transparent to-transparent z-10" />
        
        <div className="relative z-20 text-center px-4 md:px-6 max-w-4xl mx-auto mt-12 md:mt-20">
          <span className="text-hb-gold text-[9px] md:text-[10px] lg:text-xs font-black uppercase tracking-[0.5em] mb-3 md:mb-4 block">
            Nova Coleção 2026
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-light text-white uppercase tracking-tight mb-4 md:mb-6 leading-tight">
            A Essência do <br className="hidden sm:block" /><span className="italic font-serif text-gray-300">Verdadeiro Luxo</span>
          </h1>
          <p className="text-xs md:text-sm lg:text-base text-gray-200 font-normal tracking-wide mb-8 md:mb-10 max-w-xl mx-auto leading-relaxed">
            Joias exclusivas importadas forjadas para aqueles que não abrem mão da excelência e da sofisticação.
          </p>
          <Link 
            href="/colecoes" 
            className="inline-flex items-center gap-2 md:gap-3 bg-hb-gold text-hb-black px-6 py-3 md:px-8 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-widest hover:bg-hb-goldLight transition-colors rounded-sm"
          >
            Explorar Coleção <ArrowRight size={14} className="md:w-4 md:h-4" />
          </Link>
        </div>
      </section>

      {/* BANNER DO CUPOM */}
      {cupomDestaque && (
        <div className="bg-hb-gray text-hb-gold py-3 md:py-4 px-4 md:px-6 border-b border-hb-black flex justify-center items-center shadow-inner">
          <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row items-center justify-center gap-2 md:gap-6 text-center">
            <Ticket size={20} className="animate-pulse md:w-6 md:h-6" />
            <p className="text-[10px] md:text-xs lg:text-sm font-bold uppercase tracking-widest leading-relaxed">
              Aproveite! Use o cupom <span className="bg-hb-gold text-hb-black px-2 py-1 md:px-3 md:py-1 rounded mx-1 text-sm md:text-lg font-black">{cupomDestaque.codigo}</span> e ganhe <span className="font-black text-white">{cupomDestaque.desconto}% de desconto</span> hoje.
            </p>
          </div>
        </div>
      )}

      {/* 2. BARRA DE CONFIANÇA */}
      <section className="bg-hb-black py-8 md:py-6 border-b border-hb-gray">
        <div className="max-w-6xl mx-auto px-4 md:px-6 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-hb-gray">
          <div className="flex flex-col items-center gap-1 md:gap-2 pt-0 pb-4 md:py-2">
            <Truck size={20} className="text-hb-gold mb-1" />
            <span className="text-[10px] text-gray-200 font-bold uppercase tracking-widest">Frete Grátis</span>
            <span className="text-[9px] md:text-[10px] text-gray-500">Para compras acima de R$ 100</span>
          </div>
          <div className="flex flex-col items-center gap-1 md:gap-2 py-4 md:py-2">
            <ShieldCheck size={20} className="text-hb-gold mb-1" />
            <span className="text-[10px] text-gray-200 font-bold uppercase tracking-widest">Garantia</span>
            <span className="text-[9px] md:text-[10px] text-gray-500">Nas peças em Ouro 18k e Prata 925</span>
          </div>
          <div className="flex flex-col items-center gap-1 md:gap-2 pt-4 pb-0 md:py-2">
            <Gem size={20} className="text-hb-gold mb-1" />
            <span className="text-[10px] text-gray-200 font-bold uppercase tracking-widest">Qualidade Premium</span>
            <span className="text-[9px] md:text-[10px] text-gray-500">Acabamento impecável e exclusivo</span>
          </div>
        </div>
      </section>

      {/* 3. NAVEGAÇÃO POR CATEGORIAS */}
      <section className="py-12 md:py-24 bg-hb-gray border-b border-hb-black overflow-hidden">
        <div className="text-center mb-8 md:mb-12 px-4">
          <h2 className="text-lg md:text-2xl font-light text-white uppercase tracking-widest mb-3">
            Compre por Categoria
          </h2>
          <div className="w-8 h-[1px] bg-hb-gold mx-auto"></div>
        </div>

        <div className="max-w-6xl mx-auto px-4 md:px-6 overflow-x-auto pb-6 scrollbar-hide">
          <div className="flex justify-start md:justify-center gap-6 md:gap-16 min-w-max md:min-w-0 px-2 md:px-0">
            {[
              { nome: 'Colares', slug: 'colares', img: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=400&q=80' },
              { nome: 'Pulseiras', slug: 'pulseiras', img: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&q=80' },
              { nome: 'Brincos', slug: 'brincos', img: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&q=80' }
            ].map((cat) => (
              <Link key={cat.slug} href={`/categoria/${cat.slug}`} className="group flex flex-col items-center gap-3 md:gap-4">
                <div className="w-20 h-20 md:w-32 md:h-32 rounded-full p-[2px] border border-transparent group-hover:border-hb-gold transition-all duration-300">
                  <div className="relative w-full h-full rounded-full overflow-hidden bg-hb-black shadow-sm">
                    <Image 
                      src={cat.img} 
                      alt={cat.nome} 
                      fill
                      sizes="(max-width: 768px) 80px, 128px"
                      className="object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" 
                    />
                  </div>
                </div>
                <h3 className="text-[9px] md:text-xs font-bold text-gray-300 uppercase tracking-widest group-hover:text-hb-gold transition-colors">
                  {cat.nome}
                </h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4. AS 3 VITRINES */}
      {renderVitrine("Destaques da Semana", destaques, "bg-hb-black", "destaques")}
      {renderVitrine("Lançamentos", lancamentos, "bg-hb-gray", "lancamentos")}
      {renderVitrine("Mais Vendidos", maisVendidos, "bg-hb-black", "mais-vendidos")}

    </main>
  )
}
