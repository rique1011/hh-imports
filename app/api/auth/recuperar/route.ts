import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin()
    const { email } = await request.json()

    // 1. Busca o usuário
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id, nome, email')
      .eq('email', email.toLowerCase().trim()) // trim() remove espaços acidentais
      .single()

    if (error || !usuario) {
      // Retornamos sucesso por segurança, mas o log nos avisa aqui
      return NextResponse.json({ success: true })
    }


    const token = crypto.randomBytes(32).toString('hex')
    const expiracao = new Date(Date.now() + 3600000).toISOString()

    // 2. Tenta salvar o token
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ 
        recovery_token: token, 
        recovery_token_expires: expiracao 
      })
      .eq('id', usuario.id)

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao salvar dados' }, { status: 500 })
    }

    // 3. Importa o e-mail dinamicamente para evitar erro de inicialização no build
    const { enviarEmailStatus } = await import('@/lib/mail')
    const emailRes = await enviarEmailStatus(usuario.email, usuario.nome, 'recuperacao', token)
    
    if (!emailRes.sucesso) {
    } else {
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro crítico na API:", error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
