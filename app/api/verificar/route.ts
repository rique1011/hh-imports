import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const { email, codigo } = await request.json()

    // 1. Busca o usuário com este e-mail e código específico
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .eq('codigo_verificacao', codigo)
      .single()

    // Se não achar, o código está errado ou o e-mail não bate
    if (!usuario) {
      return NextResponse.json({ error: 'Código inválido ou incorreto.' }, { status: 400 })
    }

    // 2. Se o código estiver certo, atualiza o status para verificado
    const { error } = await supabase
      .from('usuarios')
      .update({ 
        email_verificado: true,
        codigo_verificacao: null // Apaga o código para não ser usado de novo
      })
      .eq('id', usuario.id)

    if (error) throw error

    return NextResponse.json({ sucesso: true })

  } catch (error) {
    console.error('Erro na verificação:', error)
    return NextResponse.json({ error: 'Erro ao validar o código.' }, { status: 500 })
  }
}
