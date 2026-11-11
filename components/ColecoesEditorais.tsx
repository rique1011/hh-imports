import ImagemEditorial from '@/components/ImagemEditorial'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { getCategoriasPublicas } from '@/lib/categorias-servidor'

export const colecoes = [
  { nome: 'Colares', slug: 'colares', descricao: 'Perto do coração.', imagem: 'colares' },
  { nome: 'Pulseiras', slug: 'pulseiras', descricao: 'Em cada gesto.', imagem: 'pulseiras' },
  { nome: 'Brincos', slug: 'brincos', descricao: 'Seu ponto de luz.', imagem: 'brincos' },
] as const

export default async function ColecoesEditorais({ principal = false }: { principal?: boolean }) {
  const categorias = await getCategoriasPublicas()
  const visiveis = colecoes.filter(c => categorias.some(s => s.slug === c.slug)).map(c => ({ ...c, nome: categorias.find(s => s.slug === c.slug)!.nome }))
  return <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-3 sm:gap-6 lg:gap-8">
    {visiveis.map((colecao, index) => <Link key={colecao.slug} href={`/categoria/${colecao.slug}`}
      className={`group relative isolate block overflow-hidden border border-luxury-line bg-luxury-surface ${index === 1 ? 'sm:mt-12' : ''}`}>
      <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[3/4]">
        <ImagemEditorial foto={colecao.imagem} alt={`Coleção de ${colecao.nome.toLowerCase()} H&H IMPORTS`}
          loading={principal && index === 0 ? 'eager' : 'lazy'}
          sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) calc((100vw - 96px) / 3), (max-width: 1375px) calc((100vw - 160px) / 3), 405px"
          className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-6 lg:p-8">
          <p className="mb-2 text-[10px] uppercase tracking-[0.15em] text-luxury-gold-light">{colecao.descricao}</p>
          <div className="flex items-end justify-between gap-3"><h2 className="text-3xl font-normal text-white lg:text-4xl">{colecao.nome}</h2><ArrowUpRight size={23} strokeWidth={1} className="mb-1 text-luxury-gold-light transition-transform motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:translate-x-1" aria-hidden="true" /></div>
        </div>
      </div>
    </Link>)}
  </div>
}
