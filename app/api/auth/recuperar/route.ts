import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    console.log("Tentando recuperar para:", email)

    // 1. Busca o usuário
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id, nome, email')
      .eq('email', email.toLowerCase().trim()) // trim() remove espaços acidentais
      .single()

    if (error || !usuario) {
      console.log("Usuário não encontrado no Supabase ou erro no banco:", error?.message)
      // Retornamos sucesso por segurança, mas o log nos avisa aqui
      return NextResponse.json({ success: true })
    }

    console.log("Usuário encontrado:", usuario.nome)

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
      console.log("Erro ao salvar token no Supabase:", updateError.message)
      return NextResponse.json({ error: 'Erro ao salvar dados' }, { status: 500 })
    }

    // 3. Importa o e-mail dinamicamente para evitar erro de inicialização no build
    console.log("Disparando e-mail via Nodemailer/Gmail...")
    const { enviarEmailStatus } = await import('@/lib/mail')
    const emailRes = await enviarEmailStatus(usuario.email, usuario.nome, 'recuperacao', token)
    
    if (!emailRes.sucesso) {
      console.log("O Nodemailer rejeitou o envio:", emailRes.error)
    } else {
      console.log("E-mail enviado com sucesso pelo Gmail!")
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro crítico na API:", error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
