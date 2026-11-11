import { after, NextResponse } from 'next/server'
import { exigirAdmin, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
import { lerJson, limitar } from '@/lib/seguranca'
import { COLUNAS_TROCA_CLIENTE, snapshotDevolucao, type TrocaCliente } from '@/lib/devolucoes'
import { contextoReversa, cotarReversa, gerarReversa, resumoReversa } from '@/lib/reversa'
import { ErroMelhorEnvio } from '@/lib/melhor-envio'
import { dataRecebimentoValida, diaNaLoja } from '@/lib/prazo-devolucao'
import { processarNotificacoesTrocas } from '@/lib/troca-notificacoes'
import { sincronizarPagamentoPedido } from '@/lib/pagamentos'

export const runtime = 'nodejs'
export const maxDuration = 120
const headers = { 'Cache-Control': 'private, no-store' }
type RegistroTroca = TrocaCliente & { usuario_id: string | number; foto_url: string | null; reversa: Parameters<typeof resumoReversa>[0]['reversa'] }
function processarEmail() { after(async () => { try { await processarNotificacoesTrocas() } catch { console.error('[devolucao] Notificação persistida para retry.') } }) }
export async function GET(request: Request) {
  try {
    const { db } = await exigirAdmin(request)
    const { data, error } = await db.from('trocas').select(COLUNAS_TROCA_CLIENTE + ',usuario_id,foto_url,recebido_em,credito_aceito_em,reversa,reembolso_referencia,reembolso_valor').order('criado_em', { ascending: false }).limit(200)
    if (error) throw error
    if (!data?.length) return NextResponse.json({ solicitacoes: [] }, { headers })
    const registros = data as unknown as RegistroTroca[]
    const [clientes, pedidos] = await Promise.all([
      db.from('usuarios').select('id,nome,email').in('id', [...new Set(registros.map(t => t.usuario_id))]),
      db.from('pedidos').select('id,itens,total,cashback_debitado,resumo_compra').in('id', [...new Set(registros.map(t => t.pedido_id).filter(id => /^[1-9]\d*$/.test(id)))]),
    ])
    if (clientes.error || pedidos.error) throw new Error('Não foi possível consultar os dados originais das solicitações.')
    const solicitacoes = registros.map(t => {
      const pedido = pedidos.data?.find(p => String(p.id) === t.pedido_id)
      const cliente = clientes.data?.find(c => String(c.id) === String(t.usuario_id))
      const { reversa, usuario_id: usuarioId, ...dto } = t
      return { ...dto, usuarioId, cliente: { nome: cliente?.nome || 'Cliente', email: cliente?.email || '' },
        produto_snapshot: t.produto_snapshot || (pedido ? snapshotDevolucao(pedido, t.produto_id || '') : null),
        foto_url: t.foto_url?.startsWith('private:devolucoes/') ? '/api/trocas/' + t.id + '/foto' : t.foto_url,
        envio: resumoReversa({ reversa, codigo_postagem: t.codigo_postagem }) }
    })
    return NextResponse.json({ solicitacoes }, { headers })
  } catch (e) { return responderErro(e) }
}
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirAdmin(request)
    await limitar(request, 'gerenciar-devolucoes', 60, 600, String(user.id))
    const body = await lerJson(request)
    const id = body.trocaId
    if (typeof id !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) throw new ErroHttp(400, 'Solicitação inválida.')
    const { data: t, error } = await user.db.from('trocas').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    if (!t) throw new ErroHttp(404, 'Solicitação não encontrada.')
    if (body.acao === 'cotar') {
      const [opcoes, c] = await Promise.all([cotarReversa(user.db, id), contextoReversa(user.db, id)])
      return NextResponse.json({ opcoes, remetente: c.entrega, destino: { nome: c.to.name, cep: c.to.postal_code, logradouro: c.to.address, numero: c.to.number, bairro: c.to.district, cidade: c.to.city, uf: c.to.state_abbr }, usaCadastroAtual: c.usaCadastroAtual }, { headers })
    }
    if (body.acao === 'gerar-reversa' || body.acao === 'retomar-reversa') {
      if (body.acao === 'retomar-reversa' && !t.reversa?.me_id) throw new ErroHttp(409, 'Consulte e autorize a reversa antes de iniciar.')
      const envio = await gerarReversa(user.db, id, body.acao === 'gerar-reversa' ? body : {})
      processarEmail()
      return NextResponse.json({ envio }, { status: envio.estado === 'pronta' ? 200 : 202, headers })
    }
    if (body.acao === 'reenviar-email') {
      const { error } = await user.db.from('troca_notificacoes').update({ status: 'pendente', disponivel_em: new Date().toISOString() }).eq('troca_id', id).eq('versao', t.versao).eq('destinatario', 'cliente').eq('status', 'enviada')
      if (error) throw error
      processarEmail(); return NextResponse.json({ sucesso: true }, { headers })
    }
    if (!Number.isSafeInteger(body.versao) || body.versao !== t.versao) throw new ErroHttp(409, 'A solicitação foi atualizada em outra aba. Recarregue antes de salvar.')
    if (t.reversa_lock_until && Date.parse(t.reversa_lock_until) > Date.now()) throw new ErroHttp(409, 'A reversa está em processamento. Aguarde antes de alterar a solicitação.')
    const observacao = typeof body.observacao === 'string' ? body.observacao.trim() : ''
    if (observacao.length > 2000) throw new ErroHttp(400, 'Use até 2.000 caracteres nas instruções.')
    const update: Record<string, unknown> = { versao: t.versao + 1, observacao_cliente: observacao }
    if (body.acao === 'creditar') {
      const { data, error } = await user.db.rpc('hh_creditar_devolucao', { p_troca_id: id, p_valor: Number(body.valor), p_observacao: observacao })
      if (error) throw new ErroHttp(409, 'Não foi possível liberar o crédito. Confira recebimento, opção do cliente, valor pago e eventuais estornos.')
      processarEmail(); return NextResponse.json({ sucesso: true, solicitacao: data }, { headers })
    }
    if (body.acao === 'confirmar-reembolso') {
      const { data: pedido, error } = await user.db.from('pedidos').select('*').eq('id', t.pedido_id).single()
      if (error || !pedido) throw new ErroHttp(404, 'Pedido indisponível.')
      await sincronizarPagamentoPedido(user.db, pedido)
      const referencia = typeof body.referencia === 'string' ? body.referencia.trim() : ''
      if (referencia.length < 3 || referencia.length > 100) throw new ErroHttp(400, 'Informe a referência do reembolso realizado no Mercado Pago.')
      const { error: erroRegistro } = await user.db.rpc('hh_registrar_reembolso_devolucao', { p_troca_id: id, p_valor: Number(body.valor), p_referencia: referencia })
      if (erroRegistro) throw new ErroHttp(409, 'O valor ainda não foi confirmado como estornado pelo Mercado Pago ou já está vinculado a outra solicitação. Confira o provedor antes de concluir.')
      processarEmail(); return NextResponse.json({ sucesso: true }, { headers })
    }
    const exigirStatus = (...status: string[]) => { if (!status.includes(t.status)) throw new ErroHttp(409, 'Esta ação não está disponível no status atual.') }
    if (body.acao === 'aprovar') { exigirStatus('analise_pendente'); update.status = 'aprovado' }
    else if (body.acao === 'recusar') { exigirStatus('analise_pendente'); if (observacao.length < 10) throw new ErroHttp(400, 'Explique o motivo da recusa ao cliente.'); update.status = 'recusado' }
    else if (body.acao === 'codigo-manual') {
      exigirStatus('aprovado')
      if (t.reversa?.estado && !['nova','bloqueada'].includes(t.reversa.estado)) throw new ErroHttp(409, 'Conclua a consulta da reversa existente antes de cadastrar outro código.')
      const codigo = typeof body.codigo === 'string' ? body.codigo.trim().toUpperCase() : ''
      if (body.codigoConfirmado !== true || !/^[A-Z0-9 -]{5,50}$/.test(codigo)) throw new ErroHttp(400, 'Informe um código de postagem já emitido e confirme a conferência.')
      if (body.validade && (!dataRecebimentoValida(body.validade) || body.validade < diaNaLoja())) throw new ErroHttp(400, 'Informe uma validade de postagem que ainda não venceu.')
      Object.assign(update, { status: 'aguardando_retorno', codigo_postagem: codigo, postagem_validade: body.validade || null })
    } else if (body.acao === 'receber') {
      exigirStatus('aguardando_retorno','aprovado')
      if (body.confirmarRecebimento !== true) throw new ErroHttp(400, 'Confirme o recebimento físico da peça.')
      Object.assign(update, { status: 'recebido', recebido_em: new Date().toISOString() })
    } else if (body.acao === 'reembolso-pendente') { exigirStatus('recebido'); if (t.resolucao !== 'reembolso') throw new ErroHttp(409, 'Confira a opção registrada pelo cliente.'); update.status = 'reembolso_pendente' }
    else if (body.acao === 'concluir-troca') {
      exigirStatus('recebido')
      if (t.resolucao !== 'troca' || observacao.length < 10) throw new ErroHttp(400, 'Registre a solução combinada e os dados do novo envio para concluir a troca.')
      Object.assign(update, { status: 'concluido', finalizado_em: new Date().toISOString() })
    } else throw new ErroHttp(400, 'Ação inválida.')
    const { data: atualizado, error: erroUpdate } = await user.db.from('trocas').update(update).eq('id', id).eq('versao', t.versao).select('id').maybeSingle()
    if (erroUpdate) throw erroUpdate
    if (!atualizado) throw new ErroHttp(409, 'Solicitação atualizada durante a edição. Recarregue antes de continuar.')
    processarEmail()
    return NextResponse.json({ sucesso: true }, { headers })
  } catch (e) {
    if (e instanceof ErroMelhorEnvio) return NextResponse.json({ error: e.mensagemAdministrativa }, { status: 502, headers })
    return responderErro(e)
  }
}
