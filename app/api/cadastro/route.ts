import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import bcrypt from 'bcryptjs'
import { Resend } from 'resend'

// 1. Chave com fallback para não travar o build na Vercel
const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder_for_build')

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin()
    const { nome, email, senha } = await request.json()

    if (!nome || !email || !senha) {
      return NextResponse.json({ error: 'Preencha todos os campos.' }, { status: 400 })
    }

    const emailFormatado = email.toLowerCase().trim()

    // 2. Verifica se o cliente já tem conta com este e-mail
    const { data: usuarioExistente } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', emailFormatado)
      .single()

    // 3. Criptografa a nova senha
    const salt = await bcrypt.genSalt(10)
    const senhaCriptografada = await bcrypt.hash(senha, salt)

    // 4. Geração do novo código de verificação
    const codigoVerificacao = Math.floor(100000 + Math.random() * 900000).toString()

    if (usuarioExistente) {
      // Se o usuário existe e JÁ ESTÁ VERIFICADO, bloqueia.
      if (usuarioExistente.email_verificado) {
        return NextResponse.json({ error: 'Este e-mail já está cadastrado e verificado. Faça login.' }, { status: 400 })
      } else {
        // Se existe mas NÃO ESTÁ VERIFICADO, atualiza o código e a senha para ele tentar de novo
        const { error: erroUpdate } = await supabase
          .from('usuarios')
          .update({
            nome,
            senha: senhaCriptografada,
            codigo_verificacao: codigoVerificacao
          })
          .eq('email', emailFormatado)

        if (erroUpdate) throw erroUpdate
      }
    } else {
      // 5. Se não existe, cria um novo usuário do zero
      const { error: erroInsert } = await supabase
        .from('usuarios')
        .insert([
          { 
            nome, 
            email: emailFormatado, 
            senha: senhaCriptografada,
            codigo_verificacao: codigoVerificacao,
            email_verificado: false
          }
        ])

      if (erroInsert) throw erroInsert
    }

    // 6. ENVIO DO E-MAIL VIA RESEND
    try {
      const { error: resendError } = await resend.emails.send({
        from: 'H&H IMPORTS <onboarding@resend.dev>', // REMETENTE DE TESTE DO RESEND
        to: [emailFormatado],
        subject: `${codigoVerificacao} é o seu código de verificação H&H IMPORTS`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; text-align: center; border: 1px solid #eee; padding: 40px; border-radius: 20px;">
            <h1 style="color: #000; text-transform: uppercase; letter-spacing: 4px; font-weight: 300;">H&H IMPORTS</h1>
            <p style="color: #666; font-size: 14px; margin-top: 20px;">Olá <strong>${nome}</strong>, bem-vindo à nossa curadoria exclusiva.</p>
            <p style="color: #666; font-size: 14px;">Use o código abaixo para confirmar sua conta e acessar as coleções:</p>
            
            <div style="background: #f9f9f9; padding: 20px; margin: 30px 0; font-size: 32px; font-weight: bold; letter-spacing: 10px; border-radius: 10px; border: 1px dashed #ccc;">
              ${codigoVerificacao}
            </div>
          </div>
        `
      })

      if (resendError) {
        console.error("ERRO DO RESEND:", resendError)
      }
    } catch (emailError) {
      console.error("Erro ao enviar e-mail:", emailError)
    }

    return NextResponse.json({ sucesso: true })

  } catch (error) {
    console.error("Erro no cadastro:", error)
    return NextResponse.json({ error: 'Erro ao criar conta. Tente novamente.' }, { status: 500 })
  }
}
