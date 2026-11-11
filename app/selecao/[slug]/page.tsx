import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import FiltroCategoria from '@/app/categoria/FiltroCategoria'
import { SELECOES } from '@/lib/selecoes'
import { produtosDaSelecao } from '@/lib/catalogo-selecoes'
import { getCategoriasPublicas } from '@/lib/categorias-servidor'

type Props = { params: Promise<{ slug: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const selecao = SELECOES.find(s => s.slug === slug)
  return { title: selecao ? `${selecao.nome} | H&H IMPORTS` : 'Seleção H&H' }
}
export default async function PaginaSelecao({ params }: Props) {
  const { slug } = await params, selecao = SELECOES.find(s => s.slug === slug)
  if (!selecao) notFound()
  const [produtos, categorias] = await Promise.all([produtosDaSelecao(slug), getCategoriasPublicas()])
  return <FiltroCategoria key={slug} produtosOriginais={produtos} tituloCategoria={selecao.nome} descricao={selecao.descricao} categorias={categorias} />
}
