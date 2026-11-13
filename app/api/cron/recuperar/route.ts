import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { enviarEmailLoja } from '@/lib/mail'
import { getSiteUrl } from '@/lib/site-url'

export const dynamic = 'force-dynamic'


export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== 'Bearer ' + process.env.CRON_SECRET) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  try {
    const supabase = getSupabaseAdmin()
    // 🚨 REGRA DE PRODUÇÃO: Busca carrinhos abandonados há mais de 30 minutos
    const trintaMinutosAtras = new Date(Date.now() - 30 * 60 * 1000).toISOString()

    const { data: carrinhos, error } = await supabase
      .from('carrinhos_abandonados')
      .select('*')
      .lt('atualizado_em', trintaMinutosAtras)
      .eq('email_enviado', false)

    if (error) throw error
    if (!carrinhos || carrinhos.length === 0) {
      return NextResponse.json({ message: 'Nenhum carrinho abandonado elegível no momento.' })
    }

    let disparos = 0

    // Dispara os e-mails
    for (const carrinho of carrinhos) {
      const resultado = await enviarEmailLoja(carrinho.cliente_email, 'Você deixou algo especial para trás... ✨', `
          <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; text-align: center; color: #111827;">
            <h1 style="font-weight: 300; text-transform: uppercase; letter-spacing: 2px;">H&H IMPORTS</h1>
            <hr style="border-top: 1px solid #f3f4f6; margin: 20px 0;" />
            <h2 style="font-size: 20px;">Notamos que algumas joias ficaram na sua sacola!</h2>
            <p style="color: #6b7280; line-height: 1.6;">
              As peças que você escolheu são exclusivas e nosso estoque é muito limitado. 
              Para te ajudar a finalizar essa compra, liberamos um presente especial válido pelas próximas 24 horas.
            </p>
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <p style="text-transform: uppercase; font-size: 12px; font-weight: bold; color: #9ca3af; margin-bottom: 8px;">Use o cupom abaixo no carrinho:</p>
              <p style="font-size: 24px; font-weight: 900; letter-spacing: 4px; margin: 0;">VOLTEI10</p>
            </div>
            <a href="${getSiteUrl('/carrinho')}" style="display: inline-block; background-color: #000; color: #fff; padding: 16px 32px; text-decoration: none; text-transform: uppercase; font-size: 12px; font-weight: bold; letter-spacing: 2px; border-radius: 4px;">
              Finalizar Minha Compra
            </a>
          </div>
        `)
      if (!resultado.sucesso) throw new Error('Não foi possível enviar a recuperação de carrinho.')

      // Marca como enviado
      await supabase
        .from('carrinhos_abandonados')
        .update({ email_enviado: true })
        .eq('id', carrinho.id)
        
      disparos++
    }

    return NextResponse.json({ success: true, disparos: disparos })
  } catch {
    console.error('[cron] Recuperação de carrinho indisponível.')
    return NextResponse.json({ error: 'Não foi possível processar a recuperação de carrinhos.' }, { status: 500 })
  }
}
