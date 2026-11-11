import { after, NextResponse } from 'next/server'
import { exigirUsuario, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
import { prazoDevolucao } from '@/lib/prazo-devolucao'
import { COLUNAS_TROCA_CLIENTE, snapshotDevolucao } from '@/lib/devolucoes'
import { lerJson, limitar } from '@/lib/seguranca'
import { processarNotificacoesTrocas } from '@/lib/troca-notificacoes'
export async function GET(request: Request) {
  try {
    const user = await exigirUsuario(request)
    const { data, error } = await user.db.from('trocas').select(COLUNAS_TROCA_CLIENTE).eq('usuario_id', user.id).order('criado_em', { ascending: false })
    if (error) throw error
    return NextResponse.json({ solicitacoes: data || [] }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) { return responderErro(e) }
}
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirUsuario(request)
    await limitar(request, 'solicitar-devolucao', 10, 3600, String(user.id))
    const { pedidoId, produtoId, motivo, fotoUrl, descricao = '', resolucao: escolha, creditoAceito } = await lerJson(request)
    const resolucao = escolha ?? (motivo === 'tamanho' ? 'troca' : 'reembolso')
    if (!['reembolso','troca','credito'].includes(String(resolucao)) || (resolucao === 'credito' && creditoAceito !== true)) throw new ErroHttp(400, 'O crédito só pode ser solicitado com sua concordância expressa. Você também pode escolher reembolso.')
    if (typeof descricao !== 'string' || descricao.length > 2000) throw new ErroHttp(400, 'Descreva a solicitação em até 2.000 caracteres.')
    if (!pedidoId || !produtoId || typeof motivo !== 'string' || !['arrependimento','defeito','tamanho'].includes(motivo)) throw new ErroHttp(400, 'Solicitação inválida.')
    const { data: pedido, error } = await user.db.from('pedidos').select('id,status,itens,total,cashback_debitado,resumo_compra')
      .eq('id', pedidoId).eq('cliente_email', user.email).maybeSingle()
    if (error) throw error
    if (!pedido || pedido.status?.toLowerCase() !== 'entregue' ||
      !Array.isArray(pedido.itens) || !pedido.itens.some((item: { id: string }) => String(item.id) === String(produtoId))) {
      throw new ErroHttp(404, 'Item entregue não encontrado para esta conta.')
    }
    const item = pedido.itens.find((item: { id: string }) => String(item.id) === String(produtoId))
    if (motivo !== 'defeito') {
      const prazo = prazoDevolucao(item.data_recebimento)
      if (prazo.situacao === 'sem_data') throw new ErroHttp(409, 'A data de recebimento precisa ser confirmada. Fale com o atendimento para registrar sua solicitação.')
      if (!prazo.aberto) throw new ErroHttp(409, 'O prazo de 7 dias para devolução por arrependimento terminou. O atendimento para defeitos continua disponível.')
    }
    const caminho=typeof fotoUrl==='string' && fotoUrl.startsWith('private:devolucoes/') ? fotoUrl.slice('private:devolucoes/'.length) : ''
    const {data:upload,error:uploadError}=caminho ? await user.db.from('devolucao_uploads').select('caminho').eq('caminho',caminho).eq('usuario_id',String(user.id)).eq('pedido_id',String(pedidoId)).eq('produto_id',String(produtoId)).maybeSingle() : {data:null,error:null}
    if(uploadError) throw Error('Falha ao conferir imagem.')
    const fotoPropria=!!upload
    if (motivo === 'defeito' && !fotoPropria) throw new ErroHttp(400, 'Envie a foto do defeito pela sua conta.')
    if (fotoUrl && !fotoPropria && fotoUrl !== item.foto) throw new ErroHttp(400, 'Foto inválida.')
    const { data: existente, error: buscaError } = await user.db.from('trocas').select('id')
      .eq('pedido_id', String(pedidoId)).eq('produto_id', produtoId).maybeSingle()
    if (buscaError) throw buscaError
    if (existente) throw new ErroHttp(409, 'Você já abriu uma solicitação para este item.')
    const produtoSnapshot = snapshotDevolucao(pedido, String(produtoId))
    if (!produtoSnapshot) throw new ErroHttp(422, 'Os dados do item precisam ser conferidos pelo atendimento.')
    const { error: insertError } = await user.db.from('trocas').insert({ pedido_id: String(pedidoId), produto_id: produtoId,
      usuario_id: user.id, motivo, foto_url: fotoUrl || null, status: 'analise_pendente', produto_snapshot: produtoSnapshot,
      descricao: descricao.trim(), resolucao, credito_aceito_em: resolucao === 'credito' ? new Date().toISOString() : null })
    if (insertError?.code === '23505') throw new ErroHttp(409, 'Você já abriu uma solicitação para este item.')
    if (insertError) throw insertError
    after(async () => { try { await processarNotificacoesTrocas() } catch { console.error('[devolucao] Notificação persistida para nova tentativa.') } })
    return NextResponse.json({ sucesso: true, status: 'analise_pendente', mensagem: 'Solicitação recebida com os dados do seu pedido. Acompanhe a análise e o código de postagem em Trocas e Devoluções. Você também receberá as instruções por e-mail.' }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return responderErro(error) }
}
