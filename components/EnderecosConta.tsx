'use client'
import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { ESTADOS, textoEndereco } from '@/lib/enderecos'
import type { Endereco, EnderecoSalvo } from '@/types/loja'
const vazio = { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' }
interface Props { enderecos: EnderecoSalvo[]; onChange: (enderecos: EnderecoSalvo[]) => void; onEdicao: (editando: boolean) => void }
export default function EnderecosConta({ enderecos, onChange, onEdicao }: Props) {
  const [editor, setEditor] = useState<{ id?: string; apelido: string; dados: Endereco; padrao: boolean } | null>(null)
  const [salvando, setSalvando] = useState(false), [erro, setErro] = useState(''), [buscando, setBuscando] = useState(false)
  const consulta = useRef<AbortController | null>(null)
  const alterados = useRef(new Set<string>())
  useEffect(() => () => { consulta.current?.abort(); onEdicao(false) }, [onEdicao])
  function abrir(endereco?: EnderecoSalvo) {
    consulta.current?.abort(); alterados.current.clear(); setErro(''); setBuscando(false)
    setEditor(endereco ? { id: endereco.id, apelido: endereco.apelido, dados: { ...endereco }, padrao: endereco.padrao } : { apelido: '', dados: { ...vazio }, padrao: !enderecos.length }); onEdicao(true)
  }
  function fechar() { consulta.current?.abort(); setEditor(null); setErro(''); setBuscando(false); onEdicao(false) }
  async function consultarCep(valor: string) {
    consulta.current?.abort(); alterados.current.clear()
    setEditor(e => e && { ...e, dados: { ...e.dados, cep: valor, logradouro: '', bairro: '', cidade: '', uf: '' } }); setBuscando(false)
    const cep = valor.replace(/\D/g, '')
    if (cep.length !== 8) return
    const controller = new AbortController(); consulta.current = controller; setBuscando(true)
    const timer = setTimeout(() => controller.abort(), 6000)
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal }), data = await response.json()
      if (!response.ok || data.erro || controller.signal.aborted) return
      setEditor(e => {
        if (!e || e.dados.cep?.replace(/\D/g, '') !== cep) return e
        const sugestao: Endereco = { logradouro: data.logradouro || '', bairro: data.bairro || '', cidade: data.localidade || '', uf: data.uf || '' }
        for (const key of alterados.current) delete sugestao[key as keyof Endereco]
        return { ...e, dados: { ...e.dados, ...sugestao } }
      })
    } catch { /* Preenchimento manual continua disponível. */ }
    finally { clearTimeout(timer); if (consulta.current === controller) setBuscando(false) }
  }
  async function executar(acao: string, endereco?: EnderecoSalvo) {
    if (salvando) return
    if (acao === 'excluir' && !window.confirm('Remover este endereço? Os pedidos anteriores serão preservados.')) return
    setSalvando(true); setErro(''); onEdicao(true)
    try {
      const response = await fetch('/api/usuario/enderecos', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acao === 'salvar' ? { acao, ...editor } : { acao, id: endereco?.id }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar o endereço.')
      onChange(data); fechar()
    } catch (e) { setErro((e as Error).message); onEdicao(Boolean(editor)) }
    finally { setSalvando(false) }
  }
  return <section className="space-y-5" aria-label="Endereços de entrega">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-4">
      <h2 className="text-xs font-bold uppercase tracking-[0.2em]">Meus endereços</h2>
      {!editor && <button type="button" disabled={salvando} onClick={() => abrir()} className="min-h-11 inline-flex items-center gap-2 text-sm text-hb-gold"><Plus size={16} /> Adicionar endereço</button>}
    </div>
    <p className="text-sm text-gray-400">Salve seus endereços e escolha onde receber cada compra.</p>
    {!enderecos.length && <p className="text-sm text-gray-400">Nenhum endereço cadastrado.</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      {enderecos.map(e => <article key={e.id} className="min-w-0 rounded-xl border border-gray-800 bg-gray-900/30 p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3"><MapPin size={16} className="text-hb-gold shrink-0" /><h3 className="font-medium break-words">{e.apelido}</h3>{e.padrao && <span className="text-xs text-hb-gold">Padrão</span>}</div>
        <p className="text-sm leading-relaxed text-gray-300 break-words">{textoEndereco(e)}</p>
        <div className="flex flex-wrap gap-x-4 mt-3">
          <button type="button" disabled={salvando || !!editor} onClick={() => abrir(e)} className="min-h-11 inline-flex items-center gap-1.5 text-sm disabled:opacity-40"><Pencil size={14} /> Editar</button>
          {!e.padrao && <button type="button" disabled={salvando || !!editor} onClick={() => executar('padrao', e)} className="min-h-11 inline-flex items-center gap-1.5 text-sm text-hb-gold disabled:opacity-40"><Star size={14} /> Tornar padrão</button>}
          <button type="button" disabled={salvando || !!editor} onClick={() => executar('excluir', e)} className="min-h-11 inline-flex items-center gap-1.5 text-sm text-red-300 disabled:opacity-40"><Trash2 size={14} /> Remover</button>
        </div>
      </article>)}
    </div>
    {editor && <form onSubmit={e => { e.preventDefault(); executar('salvar') }} className="rounded-xl border border-hb-gold/50 p-4 md:p-6 space-y-5">
      <h3 className="text-xl text-hb-gold">{editor.id ? 'Editar endereço' : 'Novo endereço'}</h3>
      <label className="block text-sm text-gray-300">Nome do endereço
        <input required maxLength={60} value={editor.apelido} onChange={e => setEditor({ ...editor, apelido: e.target.value })} placeholder="Casa, trabalho…" className="mt-2 w-full rounded border border-gray-700 bg-hb-black p-3 text-base text-white" />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        {([['cep', 'CEP', 9], ['logradouro', 'Rua', 200], ['numero', 'Número', 30], ['complemento', 'Complemento (opcional)', 120], ['bairro', 'Bairro', 120], ['cidade', 'Cidade', 120]] as const).map(([campo, label, max]) => <label key={campo} className="block text-sm text-gray-300">{label}
          <input required={campo !== 'complemento'} maxLength={max} inputMode={campo === 'cep' ? 'numeric' : 'text'} value={editor.dados[campo] || ''} onChange={e => {
            if (campo === 'cep') { consultarCep(e.target.value); return }
            alterados.current.add(campo); setEditor({ ...editor, dados: { ...editor.dados, [campo]: e.target.value } })
          }} className="mt-2 w-full rounded border border-gray-700 bg-hb-black p-3 text-base text-white" />
        </label>)}
        <label className="block text-sm text-gray-300">Estado
          <select aria-label="Estado" required value={editor.dados.uf || ''} onChange={e => { alterados.current.add('uf'); setEditor({ ...editor, dados: { ...editor.dados, uf: e.target.value } }) }} className="mt-2 w-full rounded border border-gray-700 bg-hb-black p-3 text-base text-white"><option value="">Selecione</option>{ESTADOS.map(uf => <option key={uf}>{uf}</option>)}</select>
        </label>
      </div>
      {buscando && <p className="text-xs text-gray-400" role="status">Buscando CEP… Você também pode preencher manualmente.</p>}
      <label className="min-h-11 flex items-center gap-3 text-sm"><input type="checkbox" checked={editor.padrao} onChange={e => setEditor({ ...editor, padrao: e.target.checked })} /> Usar como endereço padrão</label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={salvando} className="min-h-11 bg-hb-gold text-black rounded px-5 py-3 font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50">{salvando && <Loader2 size={16} className="animate-spin" />} Salvar endereço</button>
        <button type="button" disabled={salvando} onClick={fechar} className="min-h-11 border border-gray-700 rounded px-5 py-3 text-sm">Cancelar</button>
      </div>
    </form>}
    {erro && <p role="alert" className="text-sm text-red-300">{erro}</p>}
  </section>
}
