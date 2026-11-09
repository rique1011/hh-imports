import { limitar, lerJson } from '@/lib/seguranca'
import { responderErro, validarOrigem, ErroHttp } from '@/lib/autorizacao'
import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createHash } from 'node:crypto'
import { calcularFrete } from '@/lib/frete'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { temFreteGratis } from '@/lib/politica-frete'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    await limitar(request,'frete',30,60)
    const { cepDestino, itens } = await lerJson(request) as {cepDestino:string;itens:{id:string;quantidade:number}[]}
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
    const freteGratis = temFreteGratis(itensCotacao.reduce((s, i) => s + Math.round(i.preco * 100) * i.quantidade, 0) / 100)
    let disponiveis = opcoes
    if (freteGratis) {
      const { data: config, error: erroConfig } = await getSupabaseAdmin().from('envio_automatico_config').select('servicos_gratis').eq('id', true).maybeSingle()
      if (erroConfig) throw new ErroHttp(503, 'Não foi possível consultar a modalidade gratuita. Tente novamente.')
      const servicos: number[] = config?.servicos_gratis || [1, 2]
      disponiveis = opcoes.filter(o => servicos.includes(o.servico)).toSorted((a, b) => Number(a.preco) - Number(b.preco)).slice(0, 1)
      if (!disponiveis.length) throw new ErroHttp(422, 'Não encontramos uma modalidade gratuita disponível para este CEP. Fale com o atendimento para conferir a entrega.')
    }
    // O token mantém o custo real: o cliente recebe o benefício e a loja paga a etiqueta.
    return NextResponse.json({ opcoes: disponiveis, freteGratis }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return responderErro(error)
  }
}
