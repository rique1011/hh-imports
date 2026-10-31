import Image from 'next/image'
import Link from 'next/link'

export default function PaginaColecoes() {
  const colecoes = [
    { nome: 'Colares Exclusivos', slug: 'colares', img: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?q=80&w=800' },
    { nome: 'Pulseiras Premium', slug: 'pulseiras', img: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=800' },
    { nome: 'Brincos de Luxo', slug: 'brincos', img: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=800' }
  ]

  return (
    <main className="min-h-screen bg-hb-black py-12 md:py-20 px-4 md:px-6">
      <div className="max-w-6xl mx-auto">
        
        <div className="text-center mb-10 md:mb-16">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-light text-white uppercase tracking-widest italic mb-3 md:mb-4">
            Nossas Coleções
          </h1>
          <div className="w-10 md:w-12 h-[1px] bg-hb-gold mx-auto"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {colecoes.map((col) => (
            <Link key={col.slug} href={`/categoria/${col.slug}`} className="group relative h-[300px] sm:h-[350px] md:h-[500px] overflow-hidden rounded-xl border border-gray-800 hover:border-hb-gold transition-colors duration-500">
              <Image src={col.img} alt={col.nome} fill
                sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1200px) 33vw, 360px"
                className="object-cover group-hover:scale-105 transition-transform duration-700 opacity-80 group-hover:opacity-100" />
              <div className="absolute inset-0 bg-gradient-to-t from-hb-black via-hb-black/40 to-transparent" />
              
              <div className="absolute bottom-6 left-6 right-6 md:bottom-8 md:left-8 md:right-8 text-center">
                <h2 className="text-white text-lg md:text-xl font-light uppercase tracking-widest mb-2 md:mb-3 group-hover:text-hb-gold transition-colors">
                  {col.nome}
                </h2>
                <span className="inline-block border border-white/50 text-white text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-4 py-2 md:px-6 group-hover:bg-hb-gold group-hover:text-hb-black group-hover:border-hb-gold transition-all duration-300 rounded-sm">
                  Explorar
                </span>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </main>
  )
}
