import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const { token, novaSenha } = await request.json()

    // 1. Busca o usuário pelo token
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id')
      .eq('recovery_token', token)
      .gt('recovery_token_expires', new Date().toISOString())
      .single()

    if (!usuario || error) {
      return NextResponse.json({ error: 'Token inválido ou expirado. Solicite um novo link.' }, { status: 400 })
    }

    // 2. Criptografa a nova senha
    const senhaCriptografada = await bcrypt.hash(novaSenha, 10)

    // 3. Atualiza a senha no banco e limpa o token
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ 
        senha: senhaCriptografada, 
        recovery_token: null, 
        recovery_token_expires: null 
      })
      .eq('id', usuario.id)

    if (updateError) {
      throw new Error('Falha ao atualizar a senha no banco')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao redefinir:", error)
    return NextResponse.json({ error: 'Erro interno ao redefinir a senha' }, { status: 500 })
  }
}
