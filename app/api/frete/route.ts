import { NextResponse } from 'next/server'
import { calcularFrete } from '@/lib/frete'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    const { cepDestino, itens } = await request.json()
    if (typeof cepDestino !== 'string' || !/^\d{8}$/.test(cepDestino.replace(/\D/g, ''))) return NextResponse.json({ error: 'CEP inválido.' }, { status: 400 })
    if (!Array.isArray(itens) || !itens.length || itens.length > 100 || itens.some(item =>
      !item || typeof item.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(item.id) || !Number.isSafeInteger(item.quantidade) || item.quantidade < 1 || item.quantidade > 100)) {
      return NextResponse.json({ error: 'Informe os produtos e quantidades da sacola.' }, { status: 400 })
    }
    const { data: produtos, error } = await getSupabaseAdmin().from('produtos').select('id,preco').in('id', [...new Set(itens.map(item => item.id))])
    if (error) throw new Error('Falha ao consultar o catálogo para cotação.')
    if (itens.some(item => !produtos?.some(produto => produto.id === item.id))) return NextResponse.json({ error: 'Produto indisponível.' }, { status: 400 })
    const opcoes = await calcularFrete(cepDestino.replace(/\D/g, ''), itens.map(item => ({
      id: item.id, quantidade: item.quantidade, preco: Number(produtos!.find(produto => produto.id === item.id)!.preco),
    })))
    return NextResponse.json({ opcoes }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[frete]', error instanceof Error ? error.message : 'Falha no fornecedor')
    return NextResponse.json({ error: 'Frete indisponível. Tente novamente.' }, { status: 503 })
  }
}
