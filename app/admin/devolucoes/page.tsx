'use client'
import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Loader2, Search, RefreshCcw, Truck } from 'lucide-react'
import toast from 'react-hot-toast'
import { STATUS_TROCA, RESOLUCOES, type TrocaCliente } from '@/lib/devolucoes'

interface Solicitacao extends TrocaCliente {
  cliente: { nome: string; email: string }; foto_url: string | null; credito_aceito_em: string | null;
  envio: { estado: string; codigo: string | null; mensagem: string; custo: number | null; meId: string | null; podeRetomar: boolean }
}
type Cotacao = { nome: string; preco: number; token: string }
const campo = 'mt-2 min-h-11 w-full rounded border border-luxury-line bg-hb-black p-3 text-base text-white outline-none focus:border-hb-gold'
const dinheiro = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
async function chamar(acao: string, t: Solicitacao, extras: Record<string, unknown> = {}) {
  const r = await fetch('/api/admin/devolucoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao, trocaId: t.id, versao: t.versao, ...extras }) })
  const b = await r.json(); if (!r.ok) throw Error(b.error || 'Não foi possível concluir a ação.'); return b
}
function Atendimento({ t, atualizar }: { t: Solicitacao; atualizar: () => Promise<void> }) {
  const [ocupado, setOcupado] = useState(false), [observacao, setObservacao] = useState(''), [confirmado, setConfirmado] = useState(false)
  const [opcoes, setOpcoes] = useState<Cotacao[]>([]), [token, setToken] = useState(''), [endereco, setEndereco] = useState('')
  const [codigo, setCodigo] = useState(''), [validade, setValidade] = useState(''), [chaveDce, setChaveDce] = useState('')
  const [valor, setValor] = useState(t.produto_snapshot?.valor_restituicao?.toFixed(2) || ''), [referencia, setReferencia] = useState('')
  const escolhida = opcoes.find(o => o.token === token)
  const emProcessamento = ['gerando','compra_incerta'].includes(t.envio.estado)
  useEffect(() => {
    if (!emProcessamento) return
    let ativo = true, tentativas = 0, executando = false
    const timer = window.setInterval(async () => {
      if (!ativo || executando || tentativas++ >= 24) { if (tentativas >= 24) clearInterval(timer); return }
      executando = true
      try { await chamar('retomar-reversa', t); if (ativo) await atualizar() } catch { clearInterval(timer) }
      finally { executando = false }
    }, 5000)
    return () => { ativo = false; clearInterval(timer) }
  }, [emProcessamento, t, atualizar])
  async function agir(acao: string, extras: Record<string, unknown> = {}) {
    setOcupado(true)
    try {
      const b = await chamar(acao, t, { observacao, ...extras })
      if (acao === 'cotar') {
        setOpcoes(b.opcoes); setToken(b.opcoes[0]?.token || ''); setConfirmado(false)
        const r = b.remetente, d = b.destino
        setEndereco(`${b.usaCadastroAtual ? 'Pedido antigo: confirme os dados atuais do cliente. ' : ''}De: ${r.nome}, ${r.logradouro}, ${r.numero}, ${r.cidade}/${r.uf}, CEP ${r.cep}. Para: ${d.nome}, ${d.logradouro}, ${d.numero}, ${d.cidade}/${d.uf}, CEP ${d.cep}.`)
        if (!b.opcoes.length) toast.error('Nenhum serviço de logística reversa disponível. Confira os dados ou emita o código no Melhor Envio.')
      } else {
        toast.success(b.envio?.mensagem || 'Solicitação atualizada. As notificações ficam registradas para envio.')
        await atualizar(); setConfirmado(false)
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Ação indisponível.') }
    finally { setOcupado(false) }
  }
  return <article className="min-w-0 rounded-xl border border-luxury-line bg-luxury-surface p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-luxury-muted">Pedido #{t.pedido_id} · {new Date(t.criado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p><h2 className="mt-3 font-serif text-xl">{t.produto_snapshot?.nome || 'Item do pedido — confira os dados originais'}</h2><p className="mt-2 text-sm text-luxury-muted">{t.produto_snapshot ? `${t.produto_snapshot.quantidade} unidade(s) · ${dinheiro(t.produto_snapshot.preco)} por unidade` : 'Sem valor disponível; não é usado preço genérico.'}</p></div><p className="rounded border border-luxury-gold/30 px-3 py-2 text-xs text-luxury-gold-light">{STATUS_TROCA[t.status] || t.status}</p></div>
    <p className="mt-5 break-words text-sm">{t.cliente.nome} · <span className="break-all text-luxury-muted">{t.cliente.email}</span></p>
    <p className="mt-2 text-xs leading-6 text-luxury-muted">Motivo: {t.motivo} · Preferência: {RESOLUCOES[t.resolucao]}</p>
    {t.descricao && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">{t.descricao}</p>}
    {t.foto_url && <a href={t.foto_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-3 text-xs text-luxury-gold-light"><Image unoptimized={t.foto_url.startsWith('/api/')} width={64} height={64} src={t.foto_url} alt="Foto enviada na solicitação" className="h-16 w-16 rounded object-cover" />Ver foto</a>}
    {t.codigo_postagem && <p className="mt-5 break-all rounded border border-luxury-gold/40 p-4 text-sm text-luxury-gold-light">Código de postagem: <strong>{t.codigo_postagem}</strong>{t.postagem_validade && ' · Validade: ' + t.postagem_validade.split('-').reverse().join('/')}</p>}
    {t.observacao_cliente && <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-luxury-muted">Instruções ao cliente: {t.observacao_cliente}</p>}
    {t.credito_liberado_em && <p className="mt-4 text-sm text-luxury-gold-light">Crédito liberado: {dinheiro(t.credito_valor)}. A operação é registrada uma única vez.</p>}
    <fieldset disabled={ocupado} className="mt-6 min-w-0 space-y-4 border-t border-luxury-line pt-5">
      {!['concluido','recusado'].includes(t.status) && <label className="block text-sm">Instruções ou observação para o cliente<textarea rows={3} maxLength={2000} value={observacao} onChange={e => setObservacao(e.target.value)} className={campo} /></label>}
      {t.status === 'analise_pendente' && <div className="flex flex-wrap gap-3"><button type="button" onClick={() => agir('aprovar')} className="luxury-button">Aprovar devolução</button><button type="button" onClick={() => agir('recusar')} className="luxury-button luxury-button-outline">Recusar com justificativa</button></div>}
      {t.status === 'aprovado' && (!t.envio.meId || t.envio.estado === 'nova') && <div className="space-y-4 rounded border border-luxury-line p-4">
        <h3 className="flex items-center gap-2 font-serif text-lg"><Truck size={18} />Postagem reversa pelo Melhor Envio</h3>
        <p className="text-xs leading-6 text-luxury-muted">O código é gerado por PAC ou SEDEX dos Correios. O custo é pago pela loja com o saldo do Melhor Envio; o cliente não paga pela devolução por arrependimento ou defeito.</p>
        <button type="button" onClick={() => agir('cotar')} className="luxury-button luxury-button-outline">Consultar custo da reversa</button>
        {endereco && <p className="text-xs leading-6 text-luxury-muted">{endereco}</p>}
        {opcoes.length > 0 && <><label className="block text-sm">Serviço e custo<select aria-label="Serviço e custo" value={token} onChange={e => { setToken(e.target.value); setConfirmado(false) }} className={campo}>{opcoes.map(o => <option key={o.token} value={o.token}>{o.nome} — {dinheiro(o.preco)}</option>)}</select></label><label className="block text-sm">Chave de DC-e já emitida (opcional)<input inputMode="numeric" maxLength={44} value={chaveDce} onChange={e => setChaveDce(e.target.value.replace(/\D/g, ''))} className={campo} /><span className="mt-2 block text-xs leading-6 text-luxury-muted">Sem chave, a emissão da declaração de devolução é solicitada ao Melhor Envio. Confira a documentação fiscal aplicável ao caso.</span></label><label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-hb-gold" />Conferi os endereços, itens, medidas da embalagem e documentação. Autorizo a compra de {dinheiro(escolhida?.preco || 0)} com o saldo da loja.</label><button type="button" disabled={!confirmado || !escolhida} onClick={() => agir('gerar-reversa', { freteToken: token, confirmarDados: confirmado, chaveDce })} className="luxury-button w-full">Comprar reversa e gerar código</button></>}
      </div>}
      {t.envio.meId && t.envio.estado !== 'pronta' && <div className="rounded border border-luxury-gold/30 p-4"><p className="text-sm leading-7">{t.envio.mensagem || 'Processando a mesma reversa no Melhor Envio.'}</p><p className="mt-2 break-all text-xs text-luxury-muted">ID no Melhor Envio: {t.envio.meId}</p>{t.envio.podeRetomar && <button type="button" onClick={() => agir('retomar-reversa')} className="luxury-button luxury-button-outline mt-4">Atualizar processamento</button>}</div>}
      {t.status === 'aprovado' && <details className="rounded border border-luxury-line p-4"><summary className="min-h-11 cursor-pointer text-sm text-luxury-gold-light">Cadastrar código já emitido no Melhor Envio ou Correios</summary><div className="space-y-4 pt-4"><label className="block text-sm">Código real de postagem<input value={codigo} maxLength={50} onChange={e => setCodigo(e.target.value.toUpperCase())} className={campo} /></label><label className="block text-sm">Validade (se informada pelo fornecedor)<input type="date" value={validade} onChange={e => setValidade(e.target.value)} className={campo} /></label><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} className="h-5 w-5 accent-hb-gold" />Conferi o código no fornecedor.</label><button type="button" disabled={!confirmado || !codigo} onClick={() => agir('codigo-manual', { codigo, validade, codigoConfirmado: confirmado })} className="luxury-button luxury-button-outline">Salvar código e notificar cliente</button></div></details>}
      {['aprovado','aguardando_retorno'].includes(t.status) && <div><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} className="h-5 w-5 accent-hb-gold" />A peça devolvida já chegou fisicamente à loja.</label><button type="button" disabled={!confirmado} onClick={() => agir('receber', { confirmarRecebimento: confirmado })} className="luxury-button luxury-button-outline">Registrar recebimento para análise</button></div>}
      {t.status === 'recebido' && t.resolucao === 'credito' && t.credito_aceito_em && <div className="space-y-4 rounded border border-luxury-gold/30 p-4"><p className="text-sm leading-7">O cliente escolheu crédito expressamente. A liberação usa o saldo da conta e não gera cupom público nem bônus artificial.</p><label className="block text-sm">Valor do crédito (R$)<input type="number" min="0.01" step="0.01" readOnly={t.produto_snapshot?.valor_restituicao != null} value={valor} onChange={e => setValor(e.target.value)} className={campo} /></label>{t.produto_snapshot?.valor_restituicao == null && <p className="text-xs leading-6 text-luxury-gold-light">Pedido antigo: confira descontos, frete e o valor efetivamente pago. Registre a justificativa nas instruções antes de liberar o crédito.</p>}<button type="button" onClick={() => agir('creditar', { valor: Number(valor) })} className="luxury-button">Liberar crédito escolhido pelo cliente</button></div>}
      {t.status === 'recebido' && t.resolucao === 'troca' && <button type="button" onClick={() => agir('concluir-troca')} className="luxury-button">Registrar troca concluída</button>}
      {['recebido','reembolso_pendente'].includes(t.status) && t.resolucao === 'reembolso' && <div className="space-y-4 rounded border border-luxury-line p-4"><p className="text-sm leading-7">Faça o estorno pelo pagamento original no Mercado Pago. Este painel consulta o provedor antes de registrar a conclusão; marcar como pendente não realiza um estorno.</p>{t.status === 'recebido' && <button type="button" onClick={() => agir('reembolso-pendente')} className="luxury-button luxury-button-outline">Marcar reembolso pendente</button>}<label className="block text-sm">Valor efetivamente estornado (R$)<input type="number" min="0.01" step="0.01" value={valor} onChange={e => setValor(e.target.value)} className={campo} /></label><label className="block text-sm">Referência do reembolso no provedor<input maxLength={100} value={referencia} onChange={e => setReferencia(e.target.value)} className={campo} /></label><button type="button" disabled={!referencia || !Number(valor)} onClick={() => agir('confirmar-reembolso', { referencia, valor: Number(valor) })} className="luxury-button">Verificar estorno e concluir</button></div>}
      <button type="button" onClick={() => agir('reenviar-email')} className="min-h-11 text-xs text-luxury-gold-light underline">Reenviar última atualização ao cliente</button>
      {ocupado && <p role="status" className="flex items-center gap-2 text-sm text-luxury-gold-light"><Loader2 size={17} className="animate-spin" />Processando…</p>}
    </fieldset>
  </article>
}
export default function TelaDevolucoes() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]), [carregando, setCarregando] = useState(true), [erro, setErro] = useState(''), [busca, setBusca] = useState('')
  const carregar = useCallback(async () => {
    await fetch('/api/admin/devolucoes', { cache: 'no-store' }).then(async r => {
      const b = await r.json(); if (!r.ok) throw Error(b.error); setSolicitacoes(b.solicitacoes); setErro('')
    }).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar as solicitações.')).finally(() => setCarregando(false))
  }, [])
  useEffect(() => { void carregar() }, [carregar])
  const filtro = busca.trim().toLocaleLowerCase('pt-BR')
  const filtradas = solicitacoes.filter(t => [t.pedido_id, t.cliente.nome, t.cliente.email, t.produto_snapshot?.nome || ''].join(' ').toLocaleLowerCase('pt-BR').includes(filtro))
  return <main className="min-w-0 text-luxury-ivory"><div className="mb-8 flex flex-wrap items-start justify-between gap-5"><div><h1 className="font-serif text-3xl">Trocas e devoluções</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-luxury-muted">Analise a solicitação com os dados originais, autorize a postagem e acompanhe a solução escolhida pelo cliente.</p></div><button type="button" onClick={carregar} className="luxury-button luxury-button-outline"><RefreshCcw size={16} />Atualizar</button></div><label className="mb-8 flex max-w-xl items-center gap-3 rounded border border-luxury-line px-4"><Search size={17} /><span className="sr-only">Buscar devolução</span><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pedido, cliente ou peça" className="min-h-12 min-w-0 flex-1 bg-transparent text-base outline-none" /></label>{erro && <p role="alert" className="mb-6 rounded border border-red-900 p-4 text-sm text-red-300">{erro}</p>}{carregando ? <Loader2 aria-label="Carregando devoluções" className="animate-spin" /> : <div className="space-y-6">{filtradas.map(t => <Atendimento key={t.id} t={t} atualizar={carregar} />)}{!filtradas.length && <p className="rounded border border-luxury-line p-10 text-center text-sm text-luxury-muted">Nenhuma solicitação encontrada.</p>}</div>}</main>
}
