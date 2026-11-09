import { validarFretePedido } from '@/lib/frete'
import { temFreteGratis } from '@/lib/politica-frete'
import { snapshotEntrega } from '@/lib/entrega'
import { validarCupom } from '@/lib/cupons'
import { ErroHttp, validarOrigem, exigirUsuario, responderErro } from '@/lib/autorizacao'
import { NextResponse, after } from 'next/server'
import { createHash } from 'node:crypto'
import { lerJson, limitar } from '@/lib/seguranca'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getMercadoPagoClient } from '@/lib/mercadopago'
import { getSiteUrl } from '@/lib/site-url'
import { criarPreferenciaPedido } from '@/lib/pagamentos'
import { listarEnderecos } from '@/lib/enderecos-servidor'
import { enderecoPadrao } from '@/lib/enderecos'
import { processarNotificacoes } from '@/lib/notificacoes'
import { processarEnvioAutomatico } from '@/lib/envio-automatico'
import { documentoValido, telefoneValido, enderecoCompleto } from '@/lib/cadastro-compra'

export const runtime = 'nodejs'
export const maxDuration = 120

function valor(value: unknown) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number) || number < 0) throw new Error('Valor monetario invalido.')
  return Math.round(number * 100) / 100
}

export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirUsuario(request)
    if (!user) return NextResponse.json({ error: 'Faca login para comprar.' }, { status: 401 })
    await limitar(request,'checkout',5,600,String(user.id))
    const body = await lerJson(request) as {itens:{id:string;quantidade:number}[];enderecoId?:string;freteToken?:string;embalagemPresente?:boolean;codigoCupom?:string;cashbackUsado?:number}
    const chave = request.headers.get('Idempotency-Key')
    if (!chave || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(chave)) throw new ErroHttp(400,'Atualize sua sacola e tente novamente.')
    if (!Array.isArray(body.itens) || body.itens.length === 0 || body.itens.length > 100) {
      return NextResponse.json({ error: 'Carrinho invalido.' }, { status: 400 })
    }
    if (body.itens.some((item: { id?: unknown; quantidade?: unknown }) =>
      !item.id || !Number.isSafeInteger(Number(item.quantidade)) || Number(item.quantidade) < 1)) {
      return NextResponse.json({ error: 'Itens ou quantidades invalidos.' }, { status: 400 })
    }
    const db = getSupabaseAdmin()
    // Usa os precos do catalogo, evitando confirmar um pedido com valores adulterados.
    const ids = [...new Set(body.itens.map((item: { id: string | number }) => item.id))]
    const { data: produtos, error: produtosError } = await db.from('produtos')
      .select('id, nome, preco, fotos, slug').in('id', ids)
    if (produtosError) throw new Error('Falha ao consultar produtos.')
    const itens = body.itens.map((item: { id: string | number; quantidade: number; foto?: string; slug?: string }) => {
      const produto = produtos?.find(produto => String(produto.id) === String(item.id))
      if (!produto) throw new Error('Produto indisponivel.')
      return { id: item.id, nome: produto.nome, preco: valor(produto.preco),
        quantidade: Number(item.quantidade), foto: produto.fotos?.[0] || '', slug: produto.slug || '' }
    })
    const subtotal = valor(itens.reduce((sum: number, item: { preco: number; quantidade: number }) =>
      sum + item.preco * item.quantidade, 0))
    const { data: cadastro, error: cadastroError } = await db.from('usuarios')
      .select('id,nome,email,cpf_cnpj,whatsapp,endereco').eq('email', user.email).single()
    if (cadastroError || !cadastro) throw new Error('Falha ao consultar o endereço de entrega.')
    const enderecos = await listarEnderecos(db, cadastro.id)
    const escolhido = body.enderecoId ? enderecos.find(e => e.id === body.enderecoId) : enderecoPadrao(enderecos)
    if (body.enderecoId && !escolhido) throw new ErroHttp(404, 'Endereço não encontrado.')
    const entrega = snapshotEntrega({ ...cadastro, endereco: escolhido ? JSON.stringify(escolhido) : cadastro.endereco })
    if (!documentoValido(entrega.documento) || !telefoneValido(entrega.telefone) || !enderecoCompleto(entrega)) {
      return NextResponse.json({ error: 'Confira CPF/CNPJ, WhatsApp com DDD e endereço de entrega completo no seu cadastro.', cadastroIncompleto: true }, { status: 400 })
    }
    let frete = 0
    const cotacao = body.freteToken ? validarFretePedido(body.freteToken, entrega.cep, itens) : null
    if (body.freteToken && cotacao === null) return NextResponse.json({ error: 'A cotação expirou ou não corresponde à sua sacola. Calcule novamente o frete.' }, { status: 400 })
    if (!temFreteGratis(subtotal)) {
      if (cotacao === null) return NextResponse.json({ error: 'Calcule novamente o frete para o CEP do seu cadastro.' }, { status: 400 })
      frete = cotacao.centavos / 100
    }
    const embalagem = body.embalagemPresente ? 15 : 0
    const cupom = body.codigoCupom ? await validarCupom(db, user.email, body.codigoCupom) : null
    const desconto = cupom ? valor(subtotal * cupom.desconto / 100) : 0
    const cashback = valor(body.cashbackUsado)
    const antesCashback = valor(subtotal + frete + embalagem - desconto)
    if (cashback > antesCashback) {
      return NextResponse.json({ error: 'Cashback maior que o total do pedido.' }, { status: 400 })
    }
    const total = valor(antesCashback - cashback)
    const baseUrl = getSiteUrl()
    // Validar credenciais antes de criar o pedido.
    if (total > 0) getMercadoPagoClient()
    const { data: pedido, error: pedidoError } = await db.rpc('hh_checkout_seguro', {
      p_email: user.email, p_nome: user.nome, p_chave: chave, p_hash: createHash('sha256').update(JSON.stringify({itens:itens.map(i=>({id:String(i.id),quantidade:i.quantidade,preco:i.preco})),entrega,servico:cotacao?.servico,frete,total,embalagem:!!body.embalagemPresente,cupom:body.codigoCupom||null,cashback})).digest('hex'), p_total: total,
      p_itens: itens, p_cashback: cashback, p_entrega: entrega, p_frete: cotacao,
    })
    if (pedidoError && /Estoque insuficiente|Produto indisponivel/.test(pedidoError.message)) return NextResponse.json({ error: 'Estoque insuficiente. Atualize sua sacola.' }, { status: 409 })
    if (pedidoError && /tres pedidos|Chave reutilizada/.test(pedidoError.message)) throw new ErroHttp(409,pedidoError.message)
    if (pedidoError || !pedido) throw new Error('Falha ao criar pedido: ' + (pedidoError?.message || 'Sem resultado.'))

    // O trigger ja registrou cliente e admin; falha SMTP nao desfaz a compra.
    after(async () => {
      const trabalhos: Promise<unknown>[] = [processarNotificacoes(String(pedido.id), 6)]
      // Apenas cashback que quitou o pedido: compras pendentes aguardam webhook.
      if (total === 0) trabalhos.push(processarEnvioAutomatico(String(pedido.id)))
      const resultados = await Promise.allSettled(trabalhos)
      resultados.forEach((resultado, indice) => {
        if (resultado.status === 'rejected') console.error('[checkout] Trabalho persistido aguarda retry.', { pedidoId: pedido.id, fila: indice === 0 ? 'email' : 'envio' })
      })
    })
    if (total === 0) {
      return NextResponse.json({ pedidoId: pedido.id,
        urlPagamento: baseUrl + '/sucesso?pedido=' + encodeURIComponent(pedido.id) })
    }
    const urlPagamento = await criarPreferenciaPedido(db, pedido, user.email, true)
    return NextResponse.json({ pedidoId: pedido.id, urlPagamento })
  } catch (error) {
    return responderErro(error)
  }
}
