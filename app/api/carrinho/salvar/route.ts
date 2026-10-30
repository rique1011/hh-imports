import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 🚨 TESTE DE VIDA: Isso permite abrir no navegador para testar
export async function GET() {
  return NextResponse.json({ status: 'Rota encontrada e funcionando perfeitamente!' })
}

export async function POST(request: Request) {
  try {
    const { email, itens, total } = await request.json()

    if (!email) return NextResponse.json({ error: 'E-mail não informado' }, { status: 400 })

    if (!itens || itens.length === 0) {
      await supabase.from('carrinhos_abandonados').delete().eq('cliente_email', email)
      return NextResponse.json({ success: true })
    }

    const { error } = await supabase
      .from('carrinhos_abandonados')
      .upsert({ 
        cliente_email: email, 
        itens: itens, 
        total: total,
        atualizado_em: new Date().toISOString(),
        email_enviado: false 
      }, { onConflict: 'cliente_email' })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao salvar carrinho abandonado:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
