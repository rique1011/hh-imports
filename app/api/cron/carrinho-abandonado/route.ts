import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Resend } from 'resend'

// Instanciamos o Resend (garanta que a RESEND_API_KEY está no seu .env)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(request: Request) {
  try {
    // 1. Calcular o horário de 1 hora atrás
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    // 2. Buscar pedidos que estão "Pendentes" a mais de 1 hora
    const { data: pedidos, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('status', 'Pendente')
      .lt('created_at', umaHoraAtras)

    if (error) throw error

    if (!pedidos || pedidos.length === 0) {
      return NextResponse.json({ message: 'Nenhum carrinho abandonado encontrado agora.' }, { status: 200 })
    }

    let emailsEnviados = 0

    // 3. Loop para enviar e-mail para cada desistente
    for (const pedido of pedidos) {
      if (pedido.usuario_email) {
        
        // Dispara o e-mail
        await resend.emails.send({
          from: 'H&H IMPORTS <vendas@seudominio.com.br>', // Coloque seu domínio aqui depois
          to: [pedido.usuario_email],
          subject: 'Você esqueceu algo na sua sacola? 💎',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
              <h1 style="color: #000; text-transform: uppercase; letter-spacing: 2px;">Sua joia está te esperando!</h1>
              <p>Olá! Percebemos que você deixou alguns itens incríveis na sua sacola da <strong>H&H IMPORTS</strong>, mas não finalizou a compra.</p>
              <p>As nossas peças são exclusivas e o estoque acaba rápido. Não perca a chance de garantir a sua!</p>
              
              <div style="margin: 30px 0;">
                <a href="https://seusite.com.br/carrinho" style="background-color: #000; color: #fff; padding: 15px 25px; text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; font-size: 12px;">
                  Voltar para o Carrinho
                </a>
              </div>
              
              <p>Precisa de ajuda? Responda este e-mail ou chame no WhatsApp.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;" />
              <p style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 1px;">H&H IMPORTS - Exclusividade e Luxo</p>
            </div>
          `
        })

        // 4. Mudar o status para não mandar e-mail repetido na próxima hora
        await supabase
          .from('pedidos')
          .update({ status: 'Carrinho Abandonado' })
          .eq('id', pedido.id)

        emailsEnviados++
      }
    }

    return NextResponse.json({ 
      message: 'Rotina executada com sucesso!', 
      recuperados: emailsEnviados 
    }, { status: 200 })

  } catch (error) {
    console.error('Erro no Cron:', error)
    return NextResponse.json({ error: 'Erro ao processar carrinhos abandonados.' }, { status: 500 })
  }
}
