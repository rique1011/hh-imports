import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export const revalidate = 0

export default async function PaginaTodosProdutos() {
  const { data: produtos, error } = await supabase
    .from('produtos')
    .select('*')
    .order('criado_em', { ascending: false })

  if (error) console.error("Erro no banco:", error)

  return (
    <main className="min-h-screen bg-hb-black py-20 px-6">
      <div className="max-w-6xl mx-auto">
        
        <div className="text-center mb-16">
          <h1 className="text-3xl md:text-4xl font-light text-white uppercase tracking-widest italic mb-4">
            Coleção Completa
          </h1>
          <div className="w-12 h-[1px] bg-hb-gold mx-auto"></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {produtos && produtos.length > 0 ? (
            produtos.map((produto) => (
              <Link key={produto.id} href={`/produto/${produto.slug}`} className="group block">
                <div className="relative bg-hb-gray aspect-[4/5] rounded-xl overflow-hidden mb-4 border border-gray-800 shadow-sm">
                  {produto.fotos && produto.fotos[0] ? (
                    <Image width={600} height={750} sizes="(max-width: 768px) 50vw, 25vw" src={produto.fotos[0]} alt={produto.nome} className="w-full h-full object-cover group-hover:scale-105 opacity-80 group-hover:opacity-100 transition duration-700" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs uppercase tracking-widest">Sem foto</div>
                  )}
                  {produto.material && (
                    <div className="absolute top-3 left-3 bg-hb-gold text-hb-black px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest shadow-lg">
                      {produto.material}
                    </div>
                  )}
                </div>
                <div className="text-center px-2">
                  <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider mb-2 truncate group-hover:text-white transition-colors">{produto.nome}</h3>
                  <p className="text-sm text-hb-gold font-medium">R$ {Number(produto.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-gray-500 text-sm uppercase tracking-widest">
              Nenhum produto encontrado.
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
