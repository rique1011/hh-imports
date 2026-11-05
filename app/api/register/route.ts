import { mensagemErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import bcrypt from 'bcryptjs'
import { enviarEmailLoja, escapeHtml } from '@/lib/mail'

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin()
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

    // O cadastro usa a mesma autenticação SMTP e contato dos demais e-mails.
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const resultado = await enviarEmailLoja(emailFormatado, `Seu código de acesso: ${codigoVerificacao}`,
          `<p>Olá, <strong>${escapeHtml(nome)}</strong>.</p>` +
          '<p>Use o código de segurança abaixo para validar sua conta.</p>' +
          `<p style="font-size:32px;letter-spacing:8px;text-align:center"><strong>${codigoVerificacao}</strong></p>` +
          '<p>Se você não solicitou este código, ignore este e-mail.</p>')
        if (!resultado.sucesso) console.error('[cadastro] Código não enviado; conta aguarda verificação.')
      } catch (e) {
        console.error("Erro ao enviar e-mail via Gmail (Cadastro mantido):", e)
      }
    } else {
      console.warn("Aviso: Variáveis EMAIL_USER e EMAIL_PASS não encontradas na Vercel.")
    }

    return NextResponse.json({ sucesso: true })

  } catch (error) {
    console.error("Erro crítico no registro:", error)
    return NextResponse.json({ error: mensagemErro(error, 'Erro ao criar conta no servidor.') }, { status: 500 })
  }
}
