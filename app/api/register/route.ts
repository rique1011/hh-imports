import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase' // Usa o cliente tratado
import bcrypt from 'bcryptjs'
import nodemailer from 'nodemailer'

// Configuração do Gmail (Substituindo o Resend)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

export async function POST(request: Request) {
  try {
    const { nome, email, senha } = await request.json()

    if (!nome || !email || !senha) {
      return NextResponse.json({ error: 'Preencha todos os campos.' }, { status: 400 })
    }

    const emailFormatado = email.toLowerCase().trim()

    // 1. Criptografa a senha
    const salt = await bcrypt.genSalt(10)
    const senhaCriptografada = await bcrypt.hash(senha, salt)

    // 2. Gera o código de verificação
    const codigoVerificacao = Math.floor(100000 + Math.random() * 900000).toString()

    // 3. Verifica se o cliente já tem conta
    const { data: usuarioExistente } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', emailFormatado)
      .maybeSingle()

    if (usuarioExistente) {
      if (usuarioExistente.email_verificado) {
        return NextResponse.json({ error: 'Este e-mail já está cadastrado. Faça login.' }, { status: 400 })
      } else {
        const { error: erroUpdate } = await supabase
          .from('usuarios')
          .update({
            nome,
            senha: senhaCriptografada,
            codigo_verificacao: codigoVerificacao
          })
          .eq('email', emailFormatado)

        if (erroUpdate) {
          console.error("Erro Supabase Update:", erroUpdate)
          return NextResponse.json({ error: 'Erro ao atualizar dados no banco.' }, { status: 500 })
        }
      }
    } else {
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

      if (erroInsert) {
        console.error("Erro Supabase Insert:", erroInsert)
        return NextResponse.json({ error: `Erro no banco: ${erroInsert.message}` }, { status: 500 })
      }
    }

    // 4. Envio de e-mail via Gmail (Garante envio gratuito para QUALQUER e-mail)
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        await transporter.sendMail({
          from: `"H&H IMPORTS" <${process.env.EMAIL_USER}>`, // Nome atualizado!
          to: emailFormatado,
          subject: `Seu código de acesso: ${codigoVerificacao}`, // Assunto mais limpo
          // Versão em texto puro (Essencial para fugir do Spam)
          text: `Olá ${nome}. Seu código de verificação da H&H IMPORTS é: ${codigoVerificacao}`,
          // Nova versão HTML (Design elegante, escuro e dourado)
          html: `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #111111; color: #ffffff; padding: 40px 20px; border-radius: 8px; text-align: center;">
              
              <h2 style="color: #D4AF37; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 30px; font-weight: 300;">
                H&H IMPORTS
              </h2>
              
              <p style="font-size: 16px; color: #cccccc; line-height: 1.6; margin-bottom: 10px;">
                Olá, <strong>${nome}</strong>.
              </p>
              
              <p style="font-size: 16px; color: #cccccc; margin-bottom: 40px;">
                Use o código de segurança abaixo para validar sua conta e acessar nossas coleções exclusivas.
              </p>
              
              <div style="background-color: #000000; border: 1px solid #D4AF37; padding: 20px 40px; border-radius: 4px; display: inline-block; margin-bottom: 40px;">
                <h1 style="color: #D4AF37; font-size: 42px; letter-spacing: 12px; margin: 0; font-weight: 400;">
                  ${codigoVerificacao}
                </h1>
              </div>
              
              <hr style="border: none; border-top: 1px solid #333333; margin-bottom: 20px;" />
              
              <p style="font-size: 12px; color: #666666; line-height: 1.5;">
                Se você não solicitou este código, por favor, ignore este e-mail. <br/>
                © 2026 H&H IMPORTS. Todos os direitos reservados.
              </p>
              
            </div>
          `
        })
      } catch (e) {
        console.error("Erro ao enviar e-mail via Gmail (Cadastro mantido):", e)
      }
    } else {
      console.warn("Aviso: Variáveis EMAIL_USER e EMAIL_PASS não encontradas na Vercel.")
    }

    return NextResponse.json({ sucesso: true })

  } catch (error: any) {
    console.error("Erro crítico no registro:", error)
    return NextResponse.json({ error: error?.message || 'Erro ao criar conta no servidor.' }, { status: 500 })
  }
}
