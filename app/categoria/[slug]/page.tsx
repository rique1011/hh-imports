import FiltroCategoria from '../FiltroCategoria'
import { notFound } from 'next/navigation'
import { obterCategoria } from '@/lib/categorias'
import { produtosDaCategoria } from '@/lib/catalogo-categorias'

export const revalidate = 0

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function PaginaCategoria({ params }: PageProps) {
  const { slug } = await params

  const categoria = obterCategoria(slug)
  if (!categoria) notFound()
  const produtos = await produtosDaCategoria(categoria.slug)

  return (
    <FiltroCategoria 
      key={categoria.slug}
      produtosOriginais={produtos}
      tituloCategoria={categoria.nome}
    />
  )
}
