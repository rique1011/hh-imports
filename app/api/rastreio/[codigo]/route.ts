import { NextResponse } from 'next/server';

export async function GET(
  request: Request, 
  props: { params: Promise<{ codigo: string }> }
) {
  // 1. Resolve os parâmetros assíncronos (Exigência do Next.js)
  const params = await props.params;
  const { codigo } = params;

  // 2. Barreira de Segurança: Verifica se o código realmente chegou
  if (!codigo) {
    return NextResponse.json({ error: "Código de rastreio não fornecido." }, { status: 400 });
  }

  try {
    // 3. Faz a comunicação direta com o servidor do Melhor Envio
    const response = await fetch("https://www.melhorenvio.com.br/api/v2/me/shipment/tracking", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.MELHOR_ENVIO_TOKEN}`,
        "User-Agent": 'E-commerce H&H IMPORTS (' + (process.env.NEXT_PUBLIC_CONTACT_EMAIL || process.env.EMAIL_USER || '') + ')'
      },
      body: JSON.stringify({
        orders: [codigo]
      })
    });

    const data = await response.json();

    // 4. O Melhor Envio retorna um objeto onde a "chave" é o código do rastreio
    // Ex: { "QH123456789BR": { tracking: "...", events: [...] } }
    // Aqui buscamos exatamente pelo código, e se falhar, pegamos o primeiro item da lista
    const trackingData = data[codigo] || data[Object.keys(data)[0]]; 

    // 5. Retorna a linha do tempo ou uma lista vazia se for um objeto recém-postado
    if (trackingData && trackingData.events) {
      return NextResponse.json(trackingData.events);
    } else {
      return NextResponse.json([]);
    }

  } catch (error) {
    console.error("Erro na API de Rastreio:", error);
    return NextResponse.json({ error: "Falha ao buscar rastreamento. Tente novamente em instantes." }, { status: 500 });
  }
}
