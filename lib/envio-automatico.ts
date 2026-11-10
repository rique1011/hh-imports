import 'server-only'
import { randomUUID } from 'node:crypto'
import { ErroHttp } from '@/lib/autorizacao'
import { remetenteMelhorEnvio } from '@/lib/entrega'
import { destinatarioCnpj, documentoFiscalDoPedido } from '@/lib/documento-envio'
import { carregarPedidoEnvio, consultarEnvio, gerarEtiqueta, resultadoEnvio } from '@/lib/etiquetas'
import { calcularFrete } from '@/lib/frete'
import { configuracaoMelhorEnvio, ErroMelhorEnvio } from '@/lib/melhor-envio'
import { processarNotificacoes } from '@/lib/notificacoes'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { ConfigEnvioAutomatico, EnvioAutomatico } from '@/types/envio'

type Db = ReturnType<typeof getSupabaseAdmin>
interface ConfigRegistro {
  ativa: boolean; documento_fiscal: 'nfe' | 'declaracao'; declaracao_confirmada: boolean
  limite_centavos: number | null; servicos_gratis: number[]; agencia: number | null
}
interface Trabalho {
  pedido_id: string | number; estado: EnvioAutomatico['estado']; mensagem: string
  config: ConfigRegistro; nota_fiscal: string | null; tentativas: number
}
export async function lerConfigEnvioAutomatico(db: Db) {
  const { data, error } = await db.from('envio_automatico_config').select('*').eq('id', true).single()
  if (error || !data) throw new Error('Falha ao consultar a configuração de expedição.')
  return data as ConfigRegistro
}
export function configEnvioPublica(config: ConfigRegistro): ConfigEnvioAutomatico {
  return { ativa: config.ativa, documentoFiscal: config.documento_fiscal, declaracaoConfirmada: config.declaracao_confirmada,
    limiteReais: config.limite_centavos === null ? null : config.limite_centavos / 100, agencia: config.agencia }
}
export async function salvarConfigEnvioAutomatico(db: Db, body: Record<string, unknown>, admin: string) {
  if (typeof body.ativa !== 'boolean' || !['nfe','declaracao'].includes(String(body.documentoFiscal))) throw new ErroHttp(400, 'Configuração inválida.')
  const limite = body.limiteReais === null || body.limiteReais === '' ? null : Number(body.limiteReais)
  const centavos = limite === null ? null : Math.round(limite * 100)
  if (centavos !== null && (!Number.isFinite(limite) || centavos < 1 || centavos > 10000000)) throw new ErroHttp(400, 'Informe um limite válido por etiqueta.')
  const agencia = body.agencia === null || body.agencia === '' || body.agencia === undefined ? null : Number(body.agencia)
  if (agencia !== null && (!Number.isSafeInteger(agencia) || agencia < 1)) throw new ErroHttp(400, 'Agência inválida.')
  if (body.ativa) {
    if (centavos === null) throw new ErroHttp(400, 'Defina o teto de gasto por etiqueta antes de ativar.')
    if (body.documentoFiscal === 'declaracao' && body.declaracaoConfirmada !== true) throw new ErroHttp(400, 'Confirme a dispensa de NF-e antes de usar declaração automaticamente.')
    try { remetenteMelhorEnvio(); configuracaoMelhorEnvio() }
    catch { throw new ErroHttp(422, 'Confira o remetente, CEP de origem, token e e-mail nas configurações da loja.') }
  }
  const { data, error } = await db.from('envio_automatico_config').update({ ativa: body.ativa,
    documento_fiscal: body.documentoFiscal, declaracao_confirmada: body.declaracaoConfirmada === true,
    limite_centavos: centavos, agencia, atualizado_por: admin, atualizado_em: new Date().toISOString(),
  }).eq('id', true).select('*').single()
  if (error || !data) throw new Error('Não foi possível salvar a configuração de expedição.')
  return configEnvioPublica(data as ConfigRegistro)
}
async function lerTrabalho(db: Db, pedidoId: string) {
  const { data, error } = await db.from('envio_automatico_fila').select('*').eq('pedido_id', pedidoId).maybeSingle()
  if (error) throw new Error('Falha ao consultar a fila de expedição.')
  return data as Trabalho | null
}
export async function consultarEnvioAutomatico(db: Db, pedidoId: string): Promise<EnvioAutomatico | null> {
  const trabalho = await lerTrabalho(db, pedidoId)
  if (!trabalho) return null
  const config = await lerConfigEnvioAutomatico(db)
  const { data: pedido, error } = await db.from('pedidos').select('entrega').eq('id', pedidoId).maybeSingle()
  if (error || !pedido) throw new Error('Falha ao consultar a documentação do pedido.')
  return { estado: trabalho.estado, mensagem: trabalho.mensagem,
    documentoFiscal: documentoFiscalDoPedido(pedido.entrega?.documento, trabalho.config.documento_fiscal, trabalho.nota_fiscal),
    pausada: !config.ativa }
}
export async function exigirModoManual(db: Db, pedidoId: string) {
  const trabalho = await lerTrabalho(db, pedidoId)
  if (trabalho && !['manual','concluida'].includes(trabalho.estado)) throw new ErroHttp(409, 'Este pedido está na fila automática. Acompanhe o processamento ou selecione o modo manual.')
}

// A fila é criada apenas pelo trigger de pagamento, nunca por GET ou pelo navegador.
// O lease da fila e o mutex de pedido_envios impedem compras concorrentes.
export async function processarEnvioAutomatico(pedidoId?: string, passos = 2, somenteConsultar = false) {
  const db = getSupabaseAdmin(), lease = randomUUID(), inicio = Date.now()
  const { data, error } = await db.rpc('hh_claim_envio_automatico', { p_lease: lease, p_pedido_id: pedidoId || null })
  if (error) throw new Error('Não foi possível reservar a expedição automática.')
  if (!data) return { processado: false }
  const trabalho = data as Trabalho, id = String(trabalho.pedido_id)
  async function finalizar(estado: EnvioAutomatico['estado'], mensagem: string, minutos = 15) {
    const { data: salvo, error } = await db.from('envio_automatico_fila').update({ estado, mensagem,
      proxima_tentativa: new Date(Date.now() + minutos * 60000).toISOString(),
      lease_id: null, locked_until: null, atualizado_em: new Date().toISOString(),
    }).eq('pedido_id', id).eq('lease_id', lease).select('pedido_id').maybeSingle()
    if(!error && !salvo){
      const {data:atual,error:leitura}=await db.from('envio_automatico_fila').select('estado').eq('pedido_id',id).maybeSingle()
      if(!leitura && atual && ['atencao','manual','concluida'].includes(atual.estado)) return {processado:false,pedidoId:id,estado:atual.estado as EnvioAutomatico['estado']}
    }
    if (error || !salvo) throw new Error('Não foi possível persistir a etapa de expedição.')
    return { processado: true, pedidoId: id, estado }
  }
  try {
    const pedido = await carregarPedidoEnvio(db, id)
    const envio = await consultarEnvio(db, id)
    if (somenteConsultar && (!envio || !['comprando','compra_incerta','pago','gerando','aguardando_rastreio','pronta'].includes(envio.estado))) {
      return await finalizar('aguardando', 'A compra da etiqueta aguarda o processamento automático.')
    }
    if (pedido.entregaDoCadastro || !pedido.entrega) return await finalizar('atencao', 'Confira o endereço deste pedido no modo manual. O endereço original não foi salvo.')
    if (!envio && (pedido.codigo_rastreio || ['enviado','entregue'].includes(pedido.status))) return await finalizar('manual', 'Pedido já expedido por outro fluxo. Confira o rastreio cadastrado.')
    if (envio && ['inserindo','insercao_incerta','bloqueada'].includes(envio.estado)) return await finalizar('atencao', resultadoEnvio(id, envio).mensagem)
    const atual = await lerConfigEnvioAutomatico(db)
    if (!atual.ativa) return await finalizar('pendente', 'Automação pausada nas configurações da loja.')
    const limite = Math.min(trabalho.config.limite_centavos || 0, atual.limite_centavos || 0)
    // Um teto reduzido também protege carrinhos ainda não pagos; etiquetas já
    // compradas continuam podendo ser consultadas e impressas.
    if (envio?.estado === 'carrinho' && envio.config.cotacao.centavos > limite) return await finalizar('atencao', 'O carrinho excede o limite atual por etiqueta. Revise o teto e retome este pedido.')
    let body = {}
    if (!envio || envio.estado === 'nova') {
      const documentoFiscal = documentoFiscalDoPedido(pedido.entrega.documento, trabalho.config.documento_fiscal, trabalho.nota_fiscal)
      if (documentoFiscal === 'nfe' && !trabalho.nota_fiscal) return await finalizar('aguardando_documento',
        destinatarioCnpj(pedido.entrega.documento)
          ? 'Compra com CNPJ: informe a chave da NF-e deste pedido para a compra automática da etiqueta continuar.'
          : 'Informe a chave da NF-e deste pedido para a compra automática continuar.')
      if (documentoFiscal === 'declaracao' && !trabalho.config.declaracao_confirmada) return await finalizar('atencao', 'Confirme a documentação do envio nas configurações.')
      const opcoes = await calcularFrete(pedido.entrega.cep, pedido.itens)
      const disponiveis = opcoes.filter(opcao => pedido.frete_cotacao?.servico
        ? opcao.servico === pedido.frete_cotacao.servico : trabalho.config.servicos_gratis.includes(opcao.servico))
      const selecionada = disponiveis.sort((a, b) => a.preco - b.preco)[0]
      if (!selecionada) return await finalizar('atencao', 'Nenhum frete disponível para o serviço contratado ou Correios no frete grátis. Confira no modo manual.')
      if (Math.round(selecionada.preco * 100) > limite) return await finalizar('atencao', 'O frete atualizado excede o limite por etiqueta. Revise o teto e retome este pedido.')
      body = { freteToken: selecionada.token, documentoFiscal,
        confirmarDeclaracao: documentoFiscal === 'declaracao' && trabalho.config.declaracao_confirmada,
        notaFiscal: documentoFiscal === 'nfe' ? trabalho.nota_fiscal || '' : '', agencia: trabalho.config.agencia }
    }
    // Reconfere a pausa depois da cotação e antes de qualquer compra.
    if (!(await lerConfigEnvioAutomatico(db)).ativa) return await finalizar('pendente', 'Automação pausada nas configurações da loja.')
    let resultado = await gerarEtiqueta(db, id, body)
    // A geração do fornecedor é assíncrona. Uma conferência curta atende o caso
    // normal; o checkpoint durável fica para o cron se demorar mais.
    for (let passo = 1; passo < Math.min(passos, 3) && Date.now() - inicio < 25000 && resultado.estado === 'gerando'; passo++) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      resultado = await gerarEtiqueta(db, id)
    }
    if (resultado.concluido) {
      const salvo = await finalizar('concluida', 'Etiqueta pronta para imprimir. Rastreio salvo e notificação registrada.')
      try { await processarNotificacoes(id, 6) }
      catch { console.error('[envio-automatico] Notificação persistida para retry.', { pedidoId: id }) }
      return salvo
    }
    const bloqueada = ['inserindo','insercao_incerta','bloqueada'].includes(resultado.estado)
    return await finalizar(bloqueada ? 'atencao' : 'aguardando', resultado.mensagem, resultado.urlEtiqueta ? 60 : 15)
  } catch (error) {
    const envio = await consultarEnvio(db, id).catch(() => null)
    if (envio && ['inserindo','insercao_incerta','bloqueada'].includes(envio.estado)) return await finalizar('atencao', resultadoEnvio(id, envio).mensagem)
    const mensagem = error instanceof ErroMelhorEnvio ? error.mensagemAdministrativa : error instanceof ErroHttp ? error.message
      : 'Falha temporária ao consultar o envio. O processamento será retomado sem criar outra etiqueta.'
    const recusa = error instanceof ErroHttp && error.status !== 409
      || error instanceof ErroMelhorEnvio && error.status >= 400 && error.status < 500 && ![408,429].includes(error.status)
    return await finalizar(recusa || trabalho.tentativas >= 5 ? 'atencao' : 'aguardando', mensagem, Math.min(1440, 15 * 2 ** Math.min(trabalho.tentativas, 6)))
  }
}
