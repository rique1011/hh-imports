'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, Pencil, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { linkDoMenu, type ItemMenu, type RegraSelecao, type TipoMenu } from '@/lib/selecoes'

const campo = 'mt-2 min-h-11 w-full rounded border border-luxury-line bg-hb-black p-3 text-base text-white outline-none focus:border-hb-gold'
const destinos: Record<TipoMenu, string> = {
  selecao: 'Campanha com produtos selecionados',
  categorias: 'Menu de categorias (como Joias)',
  colecoes: 'Página de coleções',
  catalogo: 'Catálogo completo',
}
const formVazio = { nome: '', descricao: '', tipo: 'selecao' as TipoMenu, regra: 'manual' as RegraSelecao, ordem: '0', ativo: true }

export default function MenuAdmin() {
  const [itens, setItens] = useState<ItemMenu[]>([])
  const [carregando, setCarregando] = useState(true), [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [edicao, setEdicao] = useState<ItemMenu | null>(null)
  const [form, setForm] = useState(formVazio)
  const router = useRouter()

  async function carregar() {
    await fetch('/api/admin/menu', { cache: 'no-store' }).then(async r => {
      const b = await r.json(); if (!r.ok) throw Error(b.error || 'Não foi possível carregar o menu.')
      setItens(b.itens); setErro('')
    }).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar o menu.')).finally(() => setCarregando(false))
  }
  useEffect(() => { void carregar() }, [])

  function editar(item: ItemMenu | null) {
    setEdicao(item)
    setForm(item ? { nome: item.nome, descricao: item.descricao, tipo: item.tipo, regra: item.regra, ordem: String(item.ordem), ativo: item.ativo }
      : { ...formVazio, ordem: String(Math.min(999, Math.max(-1, ...itens.map(i => i.ordem)) + 1)) })
    document.getElementById('nome-menu')?.focus()
  }

  async function salvar(dados: Omit<ItemMenu, 'id' | 'slug' | 'versao'> & { id?: string; versao?: number }, limpar = false) {
    setSalvando(true)
    try {
      const r = await fetch('/api/admin/menu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) })
      const b = await r.json(); if (!r.ok) throw Error(b.error || 'Não foi possível salvar o menu.')
      toast.success(dados.ativo ? 'Menu atualizado na loja.' : 'Item retirado do menu. Você pode reativá-lo quando quiser.')
      if (limpar) { setEdicao(null); setForm({ ...formVazio, ordem: String(Math.min(999, Math.max(-1, ...itens.map(i => i.ordem)) + 1)) }) }
      else if (edicao?.id === b.item.id) { setEdicao(b.item); setForm(f => ({ ...f, ativo: b.item.ativo })) }
      await carregar(); router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar o menu.') }
    finally { setSalvando(false) }
  }

  return <main className="min-w-0 text-luxury-ivory">
    <h1 className="font-serif text-3xl">Menu e campanhas</h1>
    <p className="my-4 max-w-3xl text-sm leading-7 text-luxury-muted">Personalize as opções do topo da loja no computador e no celular. Crie campanhas como Natal ou Dia dos Pais, renomeie as opções existentes e defina em que ordem elas aparecem.</p>
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-hb-gold">
      <Link href="/admin/categorias" className="inline-flex min-h-11 items-center underline">Editar as categorias dentro de Joias</Link>
      <Link href="/admin/estoque" className="inline-flex min-h-11 items-center underline">Escolher os produtos das campanhas</Link>
    </div>
    {!carregando && !erro && <section aria-label="Prévia da ordem do menu" className="mt-6 rounded-lg border border-luxury-gold/25 bg-luxury-surface p-4">
      <h2 className="text-xs uppercase tracking-widest text-luxury-muted">Ordem na loja</h2>
      <div className="mt-4 flex flex-wrap gap-3">{itens.filter(i => i.ativo).map(i => <span key={i.id} className="max-w-full break-words rounded border border-luxury-line px-3 py-2 text-sm text-luxury-gold-light">{i.nome}</span>)}</div>
      {!itens.some(i => i.ativo) && <p className="mt-3 text-sm text-luxury-muted">Nenhum item visível. Reative uma opção ou adicione uma nova.</p>}
    </section>}
    <div className="mt-8 grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
      <section aria-label="Itens do menu" aria-busy={salvando} className="min-w-0 space-y-3">
        {carregando ? <Loader2 className="animate-spin" aria-label="Carregando menu" /> : erro ? <div role="alert" className="rounded border border-red-900 p-5 text-sm text-red-300">{erro}<button type="button" onClick={carregar} className="mt-4 block min-h-11 underline">Tentar novamente</button></div> : itens.map(item => <article key={item.id} className="min-w-0 rounded-lg border border-luxury-line bg-luxury-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="min-w-0 break-words text-base">{item.nome}</h2>
            <span className={`shrink-0 rounded px-2 py-1 text-xs ${item.ativo ? 'bg-hb-gold/10 text-luxury-gold-light' : 'bg-white/5 text-luxury-muted'}`}>{item.ativo ? 'Visível' : 'Fora do menu'}</span>
          </div>
          <p className="mt-2 text-xs leading-6 text-luxury-muted">{destinos[item.tipo]} · Ordem {item.ordem}</p>
          <p className="break-all text-xs leading-6 text-luxury-muted">{linkDoMenu(item)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={salvando} onClick={() => editar(item)} aria-label={'Editar ' + item.nome} className="flex min-h-11 items-center gap-2 rounded border border-luxury-line px-3 text-xs"><Pencil size={15} />Editar</button>
            <button type="button" disabled={salvando} onClick={() => salvar({ id: item.id, versao: item.versao, nome: item.nome, descricao: item.descricao, tipo: item.tipo, regra: item.regra, ativo: !item.ativo, ordem: item.ordem })} aria-label={(item.ativo ? 'Remover do menu ' : 'Reativar ') + item.nome} className="flex min-h-11 items-center gap-2 rounded border border-luxury-gold/40 px-3 text-xs text-luxury-gold-light">{item.ativo ? <EyeOff size={15} /> : <Eye size={15} />}{item.ativo ? 'Remover do menu' : 'Reativar'}</button>
            <Link href={linkDoMenu(item)} target="_blank" rel="noopener noreferrer" prefetch={false} className="flex min-h-11 items-center px-3 text-xs text-luxury-muted underline">Ver página</Link>
          </div>
        </article>)}
        <p className="text-xs leading-6 text-luxury-muted">Remover do menu preserva os produtos e o link da campanha. Você pode reativá-la em outra data. Para trocar o destino de um item, crie outro e retire o anterior do menu.</p>
      </section>
      <form onSubmit={e => { e.preventDefault(); void salvar({ ...(edicao ? { id: edicao.id, versao: edicao.versao } : {}), ...form, ordem: Number(form.ordem) }, true) }} className="self-start rounded-xl border border-luxury-gold/30 bg-luxury-surface p-5">
        <h2 className="mb-5 flex items-center gap-2 font-serif text-xl"><Plus size={18} />{edicao ? 'Editar opção do menu' : 'Nova opção do menu'}</h2>
        <fieldset disabled={salvando || carregando || !!erro} className="min-w-0 space-y-5">
          <label className="block text-sm">Nome no menu<input id="nome-menu" required minLength={2} maxLength={60} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Natal" className={campo} /></label>
          <label className="block text-sm">Destino<select disabled={!!edicao} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as TipoMenu, regra: 'manual' })} className={campo}>{Object.entries(destinos).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {form.tipo === 'selecao' && <>
            <label className="block text-sm">Descrição da campanha (opcional)<input maxLength={240} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: Peças para presentear neste Natal." className={campo} /></label>
            <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input type="checkbox" checked={form.regra === 'recentes'} onChange={e => setForm({ ...form, regra: e.target.checked ? 'recentes' : 'manual' })} className="mt-1 h-5 w-5 shrink-0 accent-hb-gold" />Incluir também as novidades dos últimos 30 dias</label>
            <p className="text-xs leading-6 text-luxury-muted">Escolha as peças em Estoque → Editar joia → Exibir também em. Uma campanha nova começa sem produtos até você marcá-los.</p>
          </>}
          <div><label htmlFor="ordem-menu" className="block text-sm">Ordem no menu</label><input id="ordem-menu" aria-describedby="ajuda-ordem-menu" type="number" min="0" max="999" step="1" required value={form.ordem} onChange={e => setForm({ ...form, ordem: e.target.value })} className={campo} /><p id="ajuda-ordem-menu" className="mt-2 text-xs text-luxury-muted">Números menores aparecem primeiro. Em empate, vale o nome.</p></div>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} className="h-5 w-5 accent-hb-gold" />Exibir no menu</label>
          {edicao && <p className="break-all text-xs leading-6 text-luxury-muted">O endereço {linkDoMenu(edicao)} é preservado ao renomear.</p>}
          <button type="submit" className="luxury-button luxury-button-solid w-full">{salvando ? <Loader2 size={17} className="animate-spin" /> : 'Salvar opção do menu'}</button>
          {edicao && <button type="button" onClick={() => editar(null)} className="luxury-button luxury-button-outline w-full">Cancelar edição / nova opção</button>}
        </fieldset>
      </form>
    </div>
  </main>
}
