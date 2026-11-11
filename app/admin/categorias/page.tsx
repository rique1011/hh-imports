'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Pencil, EyeOff, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import type { CategoriaLoja } from '@/lib/categorias'
import Link from 'next/link'

const campo = 'min-h-11 w-full rounded border border-luxury-line bg-hb-black p-3 text-base text-white outline-none focus:border-hb-gold'
export default function CategoriasAdmin() {
  const [categorias, setCategorias] = useState<CategoriaLoja[]>([])
  const [carregando, setCarregando] = useState(true), [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [edicao, setEdicao] = useState<CategoriaLoja | null>(null)
  const [nome, setNome] = useState(''), [ordem, setOrdem] = useState('0'), [ativo, setAtivo] = useState(true)
  const router = useRouter()
  async function carregar() {
    await fetch('/api/admin/categorias', { cache: 'no-store' }).then(async r => {
      const b = await r.json(); if (!r.ok) throw Error(b.error); setCategorias(b.categorias); setErro('')
    }).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar as categorias.')).finally(() => setCarregando(false))
  }
  useEffect(() => { void carregar() }, [])
  function editar(c: CategoriaLoja | null) { setEdicao(c); setNome(c?.nome || ''); setOrdem(String(c?.ordem ?? categorias.length)); setAtivo(c?.ativo ?? true); document.getElementById('nome-categoria')?.focus() }
  async function salvar(dados: { id?: string; nome: string; ordem: number; ativo: boolean; versao?: number }) {
    setSalvando(true)
    try {
      const r = await fetch('/api/admin/categorias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) })
      const b = await r.json(); if (!r.ok) throw Error(b.error)
      toast.success('Categoria salva. A navegação da loja foi atualizada.')
      setEdicao(null); setNome(''); setOrdem(String(categorias.length)); setAtivo(true)
      await carregar(); router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar a categoria.') }
    finally { setSalvando(false) }
  }
  return <main className="min-w-0 text-luxury-ivory">
    <h1 className="font-serif text-3xl">Categorias da loja</h1>
    <p className="my-4 max-w-3xl text-sm leading-7 text-luxury-muted">Crie, renomeie e organize as categorias que aparecem no menu Joias. Ocultar retira a categoria do menu e da página de coleções, preservando as peças e os pedidos. Você pode reativá-la a qualquer momento.</p>
    <Link href="/admin/menu" className="inline-flex min-h-11 items-center text-sm text-hb-gold underline">Editar menu superior e campanhas (Natal, Dia dos Pais…)</Link>
    <div className="mt-8 grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
      <section aria-label="Categorias cadastradas" className="min-w-0 space-y-3">
        {carregando ? <Loader2 className="animate-spin" aria-label="Carregando categorias" /> : erro ? <div role="alert" className="rounded border border-red-900 p-5 text-sm text-red-300">{erro}<button type="button" onClick={carregar} className="mt-4 block min-h-11 underline">Tentar novamente</button></div> : categorias.map(c => <article key={c.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-luxury-line bg-luxury-surface p-4">
          <div className="min-w-0"><h2 className="break-words text-base">{c.nome}</h2><p className="mt-2 break-all text-xs text-luxury-muted">/categoria/{c.slug} · Ordem {c.ordem} · {c.ativo ? 'Visível' : 'Oculta'}</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" disabled={salvando} onClick={() => editar(c)} aria-label={'Editar ' + c.nome} className="flex min-h-11 items-center gap-2 rounded border border-luxury-line px-3 text-xs"><Pencil size={15} />Editar</button><button type="button" disabled={salvando} onClick={() => salvar({ id: c.id, nome: c.nome, ordem: c.ordem, ativo: !c.ativo, versao: c.versao })} aria-label={(c.ativo ? 'Ocultar ' : 'Reativar ') + c.nome} className="flex min-h-11 items-center gap-2 rounded border border-luxury-gold/40 px-3 text-xs text-luxury-gold-light">{c.ativo ? <EyeOff size={15} /> : <Eye size={15} />}{c.ativo ? 'Ocultar' : 'Reativar'}</button></div>
        </article>)}
      </section>
      <form onSubmit={e => { e.preventDefault(); void salvar({ ...(edicao ? { id: edicao.id, versao: edicao.versao } : {}), nome, ordem: Number(ordem), ativo }) }} className="self-start rounded-xl border border-luxury-gold/30 bg-luxury-surface p-5">
        <h2 className="mb-5 flex items-center gap-2 font-serif text-xl"><Plus size={18} />{edicao ? 'Editar categoria' : 'Nova categoria'}</h2>
        <fieldset disabled={salvando || carregando} className="min-w-0 space-y-5">
          <label className="block text-sm">Nome<input id="nome-categoria" required minLength={2} maxLength={60} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Tornozeleiras" className={campo} /></label>
          <label className="block text-sm">Ordem no menu<input type="number" min="0" max="999" step="1" required value={ordem} onChange={e => setOrdem(e.target.value)} className={campo} /></label>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="h-5 w-5 accent-hb-gold" />Exibir na loja</label>
          <button type="submit" className="luxury-button luxury-button-solid w-full">{salvando ? <Loader2 size={17} className="animate-spin" /> : 'Salvar categoria'}</button>
          {edicao && <button type="button" onClick={() => editar(null)} className="luxury-button luxury-button-outline w-full">Cancelar edição</button>}
        </fieldset>
        <p className="mt-5 text-xs leading-6 text-luxury-muted">Depois, escolha a categoria de cada peça em Estoque. As campanhas criadas em Menu e campanhas ficam disponíveis em “Exibir também em”.</p>
      </form>
    </div>
  </main>
}
