'use client'
import { useEffect, useState } from 'react'
import { Loader2, RefreshCcw, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { STATUS_TROCA, RESOLUCOES, type TrocaCliente } from '@/lib/devolucoes'

export default function AcompanhamentoDevolucoes({ atualizacao, onCarregar }: { atualizacao: number; onCarregar: (trocas: TrocaCliente[]) => void }) {
  const [trocas, setTrocas] = useState<TrocaCliente[]>([]), [erro, setErro] = useState(''), [carregando, setCarregando] = useState(true)
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    const c = new AbortController()
    async function carregar() {
      try {
        const r = await fetch('/api/trocas', { cache: 'no-store', signal: c.signal }); const b = await r.json()
        if (!r.ok) throw Error(b.error)
        setTrocas(b.solicitacoes); onCarregar(b.solicitacoes); setErro('')
      } catch (e) { if (!c.signal.aborted) setErro(e instanceof Error ? e.message : 'Não foi possível carregar as devoluções.') }
      finally { if (!c.signal.aborted) setCarregando(false) }
    }
    void carregar()
    window.addEventListener('focus', carregar)
    return () => { c.abort(); window.removeEventListener('focus', carregar) }
  }, [atualizacao, tentativa, onCarregar])
  if (carregando) return <p role="status" className="mb-6 flex items-center gap-2 text-sm text-luxury-muted"><Loader2 size={17} className="animate-spin" />Carregando suas solicitações…</p>
  if (erro) return <div role="alert" className="mb-6 rounded border border-red-900 p-4 text-sm text-red-300">{erro}<button type="button" onClick={() => setTentativa(v => v + 1)} className="mt-2 block min-h-11 underline">Tentar novamente</button></div>
  if (!trocas.length) return null
  return <section aria-label="Minhas solicitações de devolução" className="mb-10 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-serif text-xl text-luxury-gold-light">Acompanhe suas solicitações</h3><button type="button" onClick={() => setTentativa(v => v + 1)} className="flex min-h-11 items-center gap-2 text-xs text-luxury-gold-light"><RefreshCcw size={15} />Atualizar</button></div>
    {trocas.map(t => <article key={t.id} className="rounded-xl border border-luxury-line bg-luxury-surface p-4 sm:p-6">
      <div className="flex flex-wrap justify-between gap-3"><p className="text-xs text-luxury-muted">Pedido #{t.pedido_id}</p><p className="text-xs text-luxury-gold-light">{STATUS_TROCA[t.status] || t.status}</p></div>
      <p className="mt-3 text-sm text-luxury-ivory">{t.produto_snapshot ? `${t.produto_snapshot.quantidade} × ${t.produto_snapshot.nome}` : 'Peça do pedido'}</p>
      <p className="mt-2 text-xs leading-6 text-luxury-muted">{RESOLUCOES[t.resolucao]}</p>
      {t.codigo_postagem && <div className="mt-4 rounded border border-luxury-gold/40 p-4"><p className="text-xs text-luxury-muted">Código de postagem reversa — Correios</p><div className="mt-2 flex flex-wrap items-center gap-3"><strong className="break-all text-lg tracking-wider text-luxury-gold-light">{t.codigo_postagem}</strong><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(t.codigo_postagem!); toast.success('Código copiado.') } catch { toast.error('Selecione e copie o código exibido.') } }} className="flex min-h-11 items-center gap-2 text-xs"><Copy size={15} />Copiar código</button></div><p className="mt-2 text-xs leading-6 text-luxury-muted">Embale a peça e apresente o código em uma agência dos Correios. {t.postagem_validade ? 'Válido até ' + t.postagem_validade.split('-').reverse().join('/') + '.' : 'Confira a validade no e-mail de autorização dos Correios.'}</p></div>}
      {t.observacao_cliente && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-luxury-muted">{t.observacao_cliente}</p>}
      {t.credito_liberado_em && <p className="mt-4 text-sm text-luxury-gold-light">Crédito por devolução: {Number(t.credito_valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Disponível no saldo da sua conta. O cashback promocional correspondente à peça devolvida é ajustado separadamente.</p>}
    </article>)}
  </section>
}
