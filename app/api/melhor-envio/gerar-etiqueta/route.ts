import { after, NextResponse } from 'next/server'
import { exigirAdmin, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
import { calcularFrete } from '@/lib/frete'
import { carregarPedidoEnvio, consultarEnvio, gerarEtiqueta, resultadoEnvio, validarPedidoId } from '@/lib/etiquetas'
import { ErroMelhorEnvio } from '@/lib/melhor-envio'
import { processarNotificacoes } from '@/lib/notificacoes'
import { destinatarioCnpj, documentoFiscalDoPedido } from '@/lib/documento-envio'
import { consultarEnvioAutomatico, exigirModoManual, lerConfigEnvioAutomatico } from '@/lib/envio-automatico'

export const runtime = 'nodejs'
export const maxDuration = 120
const headers = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request) {
  try {
    const { db } = await exigirAdmin(request)
    const pedidoId = validarPedidoId(new URL(request.url).searchParams.get('pedidoId'))
    const pedido = await carregarPedidoEnvio(db, pedidoId)
    const [envio, automatico, config] = await Promise.all([
      consultarEnvio(db, pedidoId), consultarEnvioAutomatico(db, pedidoId), lerConfigEnvioAutomatico(db),
    ])
    if (!envio && ['enviado','entregue'].includes(pedido.status)) return NextResponse.json({ ...resultadoEnvio(pedidoId, null),
      estado: 'bloqueada', podeRetomar: false, mensagem: 'Este pedido já foi enviado por outro fluxo. Confira o rastreio cadastrado.' }, { headers })
    return NextResponse.json({ ...resultadoEnvio(pedidoId, envio), entrega: pedido.entrega, usaCadastroAtual: !!pedido.entregaDoCadastro,
      servicoContratado: pedido.frete_cotacao?.servico || null,
      documentoFiscalSugerido: automatico?.documentoFiscal || documentoFiscalDoPedido(pedido.entrega?.documento, config.documento_fiscal),
      exigeNfe: destinatarioCnpj(pedido.entrega?.documento), automatico }, { headers })
  } catch (error) { return responderErro(error) }
}

export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const { db } = await exigirAdmin(request)
    const body = await request.json()
    const pedidoId = validarPedidoId(body.pedidoId)
    await exigirModoManual(db, pedidoId)
    if (body.acao === 'cotar') {
      const pedido = await carregarPedidoEnvio(db, pedidoId)
      const opcoes = await calcularFrete(pedido.entrega!.cep, pedido.itens)
      return NextResponse.json({ opcoes: pedido.frete_cotacao?.servico
        ? opcoes.filter(opcao => opcao.servico === pedido.frete_cotacao!.servico) : opcoes }, { headers })
    }
    if (body.acao && body.acao !== 'gerar') throw new ErroHttp(400, 'Ação inválida.')
    const resultado = await gerarEtiqueta(db, pedidoId, body)
    if (resultado.concluido) after(async () => {
      // A alteração transacional de status já registrou a notificação única.
      // O worker chama enviarEmailStatus e mantém retry se o SMTP falhar.
      try { await processarNotificacoes(pedidoId, 6) }
      catch { console.error('[etiqueta] E-mail persistido para nova tentativa.', { pedidoId }) }
    })
    return NextResponse.json(resultado, { status: resultado.concluido ? 200 : 202, headers })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'JSON inválido.' }, { status: 400, headers })
    if (error instanceof ErroMelhorEnvio) return NextResponse.json({ error: error.mensagemAdministrativa }, { status: 502, headers })
    return responderErro(error)
  }
}
