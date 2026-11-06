import { limitar } from '@/lib/seguranca'
import { responderErro, validarOrigem } from '@/lib/autorizacao'
import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createHash } from 'node:crypto'
import { calcularFrete } from '@/lib/frete'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    await limitar(request,'frete',30,60)
    const { cepDestino, itens } = await request.json()
    if (typeof cepDestino !== 'string' || !/^\d{8}$/.test(cepDestino.replace(/\D/g, ''))) return NextResponse.json({ error: 'CEP inválido.' }, { status: 400 })
    if (!Array.isArray(itens) || !itens.length || itens.length > 100 || itens.some(item =>
      !item || typeof item.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(item.id) || !Number.isSafeInteger(item.quantidade) || item.quantidade < 1 || item.quantidade > 100)) {
      return NextResponse.json({ error: 'Informe os produtos e quantidades da sacola.' }, { status: 400 })
    }
    const { data: produtos, error } = await getSupabaseAdmin().from('produtos').select('id,preco').in('id', [...new Set(itens.map(item => item.id))])
    if (error) throw new Error('Falha ao consultar o catálogo para cotação.')
    if (itens.some(item => !produtos?.some(produto => produto.id === item.id))) return NextResponse.json({ error: 'Produto indisponível.' }, { status: 400 })
    const destino=cepDestino.replace(/\D/g,'')
    const itensCotacao=itens.map(item=>({id:item.id,quantidade:item.quantidade,preco:Number(produtos!.find(p=>p.id===item.id)!.preco)}))
    const key=createHash('sha256').update(JSON.stringify({destino,itens:itensCotacao.toSorted((a,b)=>a.id.localeCompare(b.id)),origem:process.env.CEP_ORIGEM,servicos:process.env.MELHOR_ENVIO_SERVICOS,ambiente:process.env.MELHOR_ENVIO_AMBIENTE})).digest('hex')
    // Reutiliza somente cotação pública por 2 min; a compra da etiqueta sempre recota.
    const opcoes=await unstable_cache(()=>calcularFrete(destino,itensCotacao),['frete-publico-v1',key],{revalidate:120})()
    return NextResponse.json({ opcoes }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return responderErro(error)
  }
}
