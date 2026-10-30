import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { supabase } from '@/lib/supabase'

// 1. BUSCAR DADOS DO USUÁRIO
export async function GET() {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Puxa todas as colunas (incluindo a nova coluna 'role', saldo_cashback e created_at)
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', session.user.email)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// 2. ATUALIZAR DADOS DO USUÁRIO
export async function POST(request: Request) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { cpf_cnpj, whatsapp, data_nascimento, endereco } = body

    // 🔒 BLINDAGEM DE SEGURANÇA: Atualizamos estritamente as colunas de cadastro do cliente.
    // Isso impede que qualquer requisição externa altere o campo 'role' diretamente.
    const { error } = await supabase
      .from('usuarios')
      .update({ cpf_cnpj, whatsapp, data_nascimento, endereco })
      .eq('email', session.user.email)

    if (error) throw error
    return NextResponse.json({ sucesso: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
