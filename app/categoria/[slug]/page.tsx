import { supabase } from '@/lib/supabase'
import FiltroCategoria from '../FiltroCategoria'

export const revalidate = 0

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function PaginaCategoria({ params }: PageProps) {
  const { slug } = await params

  const nomesTitulos: Record<string, string> = {
    'aneis': 'Anéis',
    'colares': 'Colares',
    'pulseiras': 'Pulseiras',
    'relogios': 'Relógios',
    'brincos': 'Brincos',
  }
  const tituloCategoria = nomesTitulos[slug] || slug

  const { data: produtos } = await supabase
    .from('produtos')
    .select('*')
    .eq('categoria_slug', slug)

  return (
    <FiltroCategoria 
      produtosOriginais={produtos || []} 
      tituloCategoria={tituloCategoria} 
    />
  )
}
