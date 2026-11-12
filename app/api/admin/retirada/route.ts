import { NextResponse, after } from 'next/server'
import { revalidateTag } from 'next/cache'
import { exigirAdmin, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
import { lerJson, limitar } from '@/lib/seguranca'
import { normalizarEndereco } from '@/lib/enderecos'
import { COLUNAS_CONFIG_RETIRADA } from '@/lib/retirada-servidor'
import { remetenteMelhorEnvio } from '@/lib/entrega'
import { processarNotificacoes } from '@/lib/notificacoes'
import { processarReembolsosRetirada } from '@/lib/retirada-reembolsos'

const headers = { 'Cache-Control': 'private, no-store' }
export async function GET(request: Request) {
  try {
    const { db } = await exigirAdmin(request)
    const { data, error } = await db.from('loja_retirada').select(COLUNAS_CONFIG_RETIRADA).eq('id', true).single()
    if (error) throw error
    let sugestaoEndereco = null
    try { const r = remetenteMelhorEnvio(); sugestaoEndereco = { cep: r.postal_code, logradouro: r.address, numero: r.number, complemento: r.complement, bairro: r.district, cidade: r.city, uf: r.state_abbr } } catch {}
    return NextResponse.json({ config: data, sugestaoEndereco }, { headers })
  } catch (e) { return responderErro(e) }
}
export async function POST(request: Request) {
  try {
    validarOrigem(request); const user = await exigirAdmin(request)
    await limitar(request, 'retirada-admin', 30, 600, String(user.id))
    const b = await lerJson(request)
    if (b.acao === 'configurar') {
      if (Object.keys(b).some(k => !['acao','ativa','local','endereco','instrucoes','prazo_dias','versao'].includes(k))) throw new ErroHttp(400, 'Campo não permitido.')
      const texto = (v: unknown, max: number) => { if (typeof v !== 'string' || v.trim().length < 3 || v.length > max || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)) throw new ErroHttp(400, 'Confira o local e as instruções de retirada.'); return v.trim() }
      if (typeof b.ativa !== 'boolean' || !Number.isInteger(b.prazo_dias) || Number(b.prazo_dias) < 7 || Number(b.prazo_dias) > 60 || !Number.isSafeInteger(b.versao) || Number(b.versao) < 1) throw new ErroHttp(400, 'Confira o prazo e recarregue a configuração.')
      let endereco
      try { endereco = normalizarEndereco(b.endereco) } catch { throw new ErroHttp(400,'Preencha o endereço de retirada completo, incluindo CEP, número e estado.') }
      const { data, error } = await user.db.from('loja_retirada').update({ ativa: b.ativa, local: texto(b.local, 120), endereco, instrucoes: texto(b.instrucoes, 600), prazo_dias: b.prazo_dias, versao: Number(b.versao) + 1 }).eq('id', true).eq('versao', b.versao).select(COLUNAS_CONFIG_RETIRADA).maybeSingle()
      if (error) throw error
      if (!data) throw new ErroHttp(409, 'A configuração foi alterada em outra aba. Recarregue antes de salvar.')
      revalidateTag('retirada-config', { expire: 0 })
      return NextResponse.json({ config: data }, { headers })
    }
    const id = String(b.pedidoId || '')
    if (!/^(?:\d{1,20}|[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})$/i.test(id) || !Number.isSafeInteger(b.versao) || Number(b.versao) < 1) throw new ErroHttp(400, 'Confira o pedido e recarregue os detalhes.')
    if (!['pronto','retirado','retomar'].includes(String(b.acao))) throw new ErroHttp(400, 'Ação inválida.')
    if (b.acao === 'retomar') {
      const { data, error } = await user.db.from('pedido_retiradas').update({ proxima_tentativa: new Date().toISOString() }).eq('pedido_id', id).eq('estado','reembolso_pendente').eq('versao', b.versao).select('pedido_id')
      if (error || !data?.length) throw new ErroHttp(409, 'Recarregue a retirada antes de retomar.')
    } else {
      if (b.acao === 'retirado' && (typeof b.codigo !== 'string' || !/^[a-f0-9]{8}$/i.test(b.codigo.trim()))) throw new ErroHttp(400, 'Informe o código de 8 caracteres apresentado pelo cliente.')
      const { error } = await user.db.rpc('hh_acao_retirada', { p_pedido_id: id, p_acao: b.acao, p_versao: b.versao, p_codigo: b.codigo || '' })
      if (error) throw new ErroHttp(409, 'Não foi possível alterar a retirada. Confira pagamento, código e estado atual do pedido.')
    }
    after(async () => { try { if (b.acao === 'retomar') await processarReembolsosRetirada(id); await processarNotificacoes(id, 8) } catch { console.error('[retirada] A fila retomará o processamento.', { pedidoId: id }) } })
    return NextResponse.json({ sucesso: true }, { headers })
  } catch (e) { return responderErro(e) }
}
