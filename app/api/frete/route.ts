import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { cepDestino } = await request.json()

    // O CEP de onde suas mercadorias saem (Apenas números)
    const CEP_ORIGEM = '01001000' // Lembre-se de mudar para o seu CEP real
    
    const MELHOR_ENVIO_TOKEN = process.env.MELHOR_ENVIO_TOKEN

    if (!MELHOR_ENVIO_TOKEN) {
      throw new Error('Token do Melhor Envio não configurado.')
    }

    const response = await fetch('https://www.melhorenvio.com.br/api/v2/me/shipment/calculate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MELHOR_ENVIO_TOKEN}`,
        'User-Agent': 'Suporte H&H IMPORTS (' + (process.env.NEXT_PUBLIC_CONTACT_EMAIL || process.env.EMAIL_USER || '') + ')' // O Melhor Envio exige um e-mail de contato aqui
      },
      body: JSON.stringify({
        from: { postal_code: CEP_ORIGEM },
        to: { postal_code: cepDestino.replace(/\D/g, '') },
        // REGRAS ESTRITAS DO MINI ENVIOS:
        package: {
          weight: 0.15, // 150 gramas (Bem abaixo do limite de 300g)
          width: 11,    // Largura mínima permitida: 11cm
          height: 3,    // Altura máxima do Mini Envios: 4cm (Deixamos 3cm para garantir)
          length: 16    // Comprimento mínimo permitido: 16cm
        },
        options: {
          receipt: false,       // Mini Envios não aceita Aviso de Recebimento
          own_hand: false,      // Mini Envios não aceita Mão Própria
          insurance_value: 0    // Limitamos a declaração extra para o Mini Envios não ser bloqueado pelos Correios
        }
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("Erro Melhor Envio:", data)
      return NextResponse.json({ error: 'Erro ao calcular frete no fornecedor.' }, { status: 400 })
    }

    // Filtra as opções para remover erros e pegar o nome, preço e prazo
    const opcoesFrete = data
      .filter((opcao: any) => !opcao.error)
      .map((opcao: any) => ({
        nome: opcao.name, // Aqui vai aparecer "Correios Mini Envios", "PAC", "Sedex", etc.
        preco: opcao.price,
        prazo: opcao.delivery_time,
        transportadora: opcao.company.name
      }))

    return NextResponse.json({ opcoes: opcoesFrete }, { status: 200 })

  } catch (error) {
    console.error('Erro na API de Frete:', error)
    return NextResponse.json({ error: 'Erro interno ao calcular frete.' }, { status: 500 })
  }
}
