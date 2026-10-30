import { NextResponse } from 'next/server'
import { enviarEmailStatus } from '@/lib/mail'

export async function POST(request: Request) {
  try {
    const { email, nome, codigoRastreio } = await request.json()

    if (!email || !codigoRastreio) {
      return NextResponse.json({ error: 'Faltam dados para o e-mail.' }, { status: 400 })
    }

    const resultado = await enviarEmailStatus(email, nome, 'troca_aprovada', codigoRastreio)
    if (!resultado.sucesso) {
      return NextResponse.json({ error: 'Falha ao enviar e-mail. Tente novamente.' }, { status: 503 })
    }

    return NextResponse.json({ sucesso: true })
  } catch (error) {
    console.error("Erro ao enviar email de reversa:", error)
    return NextResponse.json({ error: 'Erro interno ao enviar e-mail.' }, { status: 500 })
  }
}
