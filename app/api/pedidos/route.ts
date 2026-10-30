import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getServerSession } from "next-auth"

// Garante que o Next.js não guarde cache velho dessa rota
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession()
    
    // Se o cliente não estiver logado, não retorna nada
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // 🚨 A MÁGICA AQUI: Busca os pedidos usando a coluna nova "cliente_email"
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('cliente_email', session.user.email)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("Erro ao buscar pedidos:", error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
