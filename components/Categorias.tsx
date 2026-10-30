import Image from 'next/image'
import Link from 'next/link'

const CATEGORIAS = [
  {
    id: 1,
    nome: 'Anéis',
    slug: 'aneis',
    imagem: 'https://images.unsplash.com/photo-1605100804763-247f66126be8?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 2,
    nome: 'Colares',
    slug: 'colares',
    imagem: 'https://images.unsplash.com/photo-1599643478514-4a4204142fce?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 3,
    nome: 'Pulseiras',
    slug: 'pulseiras',
    imagem: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 4,
    nome: 'Relógios',
    slug: 'relogios',
    imagem: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 5,
    nome: 'Brincos',
    slug: 'brincos',
    imagem: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=800&auto=format&fit=crop',
  }
]

export default function Categorias() {
  return (
    <section className="w-full bg-white py-12 border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6">
        
        {/* Container das Categorias (Usa flex para alinhar lado a lado e permite scroll no celular se faltar espaço) */}
        <div className="flex items-center justify-center gap-6 md:gap-12 overflow-x-auto pb-4 scrollbar-hide">
          {CATEGORIAS.map((categoria) => (
            <Link 
              href={`/categoria/${categoria.slug}`} 
              key={categoria.id}
              className="group flex flex-col items-center flex-shrink-0"
            >
              {/* O Círculo da Imagem */}
              <div className="w-20 h-20 md:w-28 md:h-28 rounded-full overflow-hidden p-1 border border-transparent group-hover:border-black transition-colors duration-300">
                <div className="w-full h-full rounded-full overflow-hidden">
                  <Image width={600} height={750} sizes="(max-width: 768px) 50vw, 25vw"
                    src={categoria.imagem} 
                    alt={categoria.nome}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                </div>
              </div>
              
              {/* Nome da Categoria */}
              <span className="mt-4 text-xs md:text-sm font-semibold tracking-widest uppercase text-gray-600 group-hover:text-black transition-colors">
                {categoria.nome}
              </span>
            </Link>
          ))}
        </div>

      </div>
    </section>
  )
}
