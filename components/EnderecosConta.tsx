'use client'
import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/Modal'
import { ESTADOS, textoEndereco } from '@/lib/enderecos'
import { enderecoCompleto } from '@/lib/cadastro-compra'
import type { Endereco, EnderecoSalvo } from '@/types/loja'

const vazio = { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' }
type Editor = { id?: string; apelido: string; dados: Endereco; padrao: boolean }
interface Props {
  enderecos: EnderecoSalvo[]
  onChange: (enderecos: EnderecoSalvo[]) => void
  onEdicao: (editando: boolean) => void
  obrigatorio?: boolean
  onSalvo?: (enderecos: EnderecoSalvo[]) => Promise<void>
}
const campos = [
  ['cep', 'CEP', 9, 'postal-code'], ['logradouro', 'Rua', 200, 'address-line1'],
  ['numero', 'Número', 30, 'off'], ['complemento', 'Complemento (opcional)', 120, 'address-line2'],
  ['bairro', 'Bairro', 120, 'address-level3'], ['cidade', 'Cidade', 120, 'address-level2'],
] as const

export default function EnderecosConta({ enderecos, onChange, onEdicao, obrigatorio = false, onSalvo }: Props) {
  const novo = (): Editor => ({ apelido: enderecos.length ? `Endereço ${enderecos.length + 1}` : 'Casa', dados: { ...vazio }, padrao: !enderecos.some(enderecoCompleto) })
  const [editor, setEditor] = useState<Editor | null>(() => obrigatorio && !enderecos.some(enderecoCompleto) ? novo() : null)
  const [salvando, setSalvando] = useState(false), [erro, setErro] = useState(''), [buscando, setBuscando] = useState(false)
  const [avisoCep, setAvisoCep] = useState(''), [erroCep, setErroCep] = useState(false)
  const [remocao, setRemocao] = useState<EnderecoSalvo | null>(null)
  const consulta = useRef<AbortController | null>(null)
  const alterados = useRef(new Set<string>())
  const editando = !!editor || salvando
  useEffect(() => { onEdicao(editando) }, [editando, onEdicao])
  useEffect(() => () => { consulta.current?.abort(); onEdicao(false) }, [onEdicao])

  function abrir(endereco?: EnderecoSalvo) {
    consulta.current?.abort(); consulta.current = null; alterados.current.clear()
    setErro(''); setBuscando(false); setAvisoCep(''); setErroCep(false)
    setEditor(endereco ? { id: endereco.id, apelido: endereco.apelido, dados: { ...endereco }, padrao: endereco.padrao } : novo())
  }
  function fechar() {
    consulta.current?.abort(); consulta.current = null
    setEditor(null); setErro(''); setBuscando(false); setAvisoCep(''); setErroCep(false)
  }
  async function consultarCep(valor: string) {
    consulta.current?.abort(); consulta.current = null; alterados.current.clear()
    const cep = valor.replace(/\D/g, '').slice(0, 8)
    const formatado = cep.replace(/^(\d{5})(\d)/, '$1-$2')
    setEditor(e => e && { ...e, dados: { ...e.dados, cep: formatado, logradouro: '', bairro: '', cidade: '', uf: '' } })
    setBuscando(false); setAvisoCep(''); setErroCep(false)
    if (cep.length !== 8) return
    const controller = new AbortController(); consulta.current = controller; setBuscando(true)
    const timer = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(`/api/cep/${cep}`, { signal: controller.signal })
      const data = await response.json()
      if (consulta.current !== controller || controller.signal.aborted) return
      if (!response.ok) throw new Error(data.error || 'Não foi possível consultar o CEP. Preencha o endereço manualmente.')
      setEditor(e => {
        if (!e || e.dados.cep?.replace(/\D/g, '') !== cep) return e
        const sugestao: Endereco = { logradouro: data.logradouro || '', bairro: data.bairro || '', cidade: data.cidade || '', uf: data.uf || '' }
        for (const key of alterados.current) delete sugestao[key as keyof Endereco]
        return { ...e, dados: { ...e.dados, ...sugestao } }
      })
      setAvisoCep(data.logradouro && data.bairro ? 'Endereço encontrado. Informe o número e o complemento, se houver.' : 'CEP localizado. Complete a rua, o bairro e o número que faltarem.')
    } catch (e) {
      if (consulta.current !== controller) return
      setErroCep(true)
      setAvisoCep(controller.signal.aborted ? 'A consulta demorou mais que o esperado. Você pode preencher o endereço manualmente.' : (e as Error).message)
    } finally { clearTimeout(timer); if (consulta.current === controller) setBuscando(false) }
  }
  async function executar(acao: string, endereco?: EnderecoSalvo) {
    if (salvando) return
    setSalvando(true); setErro('')
    try {
      const response = await fetch('/api/usuario/enderecos', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acao === 'salvar' ? { acao, ...editor } : { acao, id: endereco?.id }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar o endereço.')
      onChange(data); fechar()
      if (acao === 'salvar' && onSalvo) await onSalvo(data)
      else toast.success(acao === 'excluir' ? 'Endereço removido.' : acao === 'padrao' ? 'Endereço padrão atualizado.' : 'Endereço salvo.')
    } catch (e) { setErro((e as Error).message) }
    finally { setSalvando(false) }
  }
  const faltaEndereco = obrigatorio && !enderecos.some(enderecoCompleto)
  return <section id="endereco-entrega" tabIndex={-1} className={`space-y-5 scroll-mt-36 rounded-xl ${faltaEndereco ? 'border border-red-400/60 p-4 md:p-5' : ''}`} aria-label="Endereços de entrega" aria-describedby={faltaEndereco ? 'endereco-obrigatorio' : undefined}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-luxury-line pb-4">
      <h2 className="text-xs font-bold uppercase tracking-[0.2em]">Meus endereços {faltaEndereco && <span className="block mt-2 text-red-300">Obrigatório para a entrega</span>}</h2>
      {!editor && <button type="button" disabled={salvando} onClick={() => abrir()} className="min-h-11 inline-flex items-center gap-2 text-sm text-hb-gold"><Plus size={16} /> Adicionar endereço</button>}
    </div>
    <p className="text-sm text-luxury-muted">Digite o CEP para preencher o endereço automaticamente. Confira os dados e informe o número.</p>
    {faltaEndereco && <p id="endereco-obrigatorio" className="text-sm text-red-300">Cadastre um endereço completo antes de continuar sua compra. Complemento é opcional.</p>}
    {!enderecos.length && !editor && <p className="text-sm text-gray-400">Nenhum endereço cadastrado.</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      {enderecos.map(e => <article key={e.id} className="min-w-0 rounded-xl border border-luxury-line bg-hb-gray p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3"><MapPin size={16} className="text-hb-gold shrink-0" /><h3 className="font-medium break-words">{e.apelido}</h3>{e.padrao && <span className="text-xs text-hb-gold">Padrão</span>}</div>
        <p className="text-sm leading-relaxed text-gray-300 break-words">{textoEndereco(e)}</p>
        <div className="flex flex-wrap gap-x-4 mt-3">
          <button type="button" disabled={salvando || !!editor} onClick={() => abrir(e)} className="min-h-11 inline-flex items-center gap-1.5 text-sm disabled:opacity-40"><Pencil size={14} /> Editar</button>
          {!e.padrao && <button type="button" disabled={salvando || !!editor} onClick={() => executar('padrao', e)} className="min-h-11 inline-flex items-center gap-1.5 text-sm text-hb-gold disabled:opacity-40"><Star size={14} /> Tornar padrão</button>}
          <button type="button" disabled={salvando || !!editor} onClick={() => setRemocao(e)} className="min-h-11 inline-flex items-center gap-1.5 text-sm text-red-300 disabled:opacity-40"><Trash2 size={14} /> Remover</button>
        </div>
      </article>)}
    </div>
    {editor && <form id="form-endereco" onSubmit={e => { e.preventDefault(); executar('salvar') }} className="rounded-xl border border-hb-gold/50 p-4 md:p-6 space-y-5">
      <h3 className="text-xl text-hb-gold">{editor.id ? 'Editar endereço' : 'Novo endereço'}</h3>
      <p className="text-xs text-luxury-muted">Os campos marcados com * são obrigatórios.</p>
      <label className="block text-sm text-gray-300">Nome do endereço *
        <input required maxLength={60} value={editor.apelido} onChange={e => setEditor({ ...editor, apelido: e.target.value })} placeholder="Casa, trabalho…" className="mt-2 w-full rounded border border-gray-700 bg-hb-black p-3 text-base text-white" />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        {campos.map(([campo, label, max, autocomplete]) => {
          const invalido = obrigatorio && campo !== 'complemento' && (campo === 'cep' ? editor.dados.cep?.replace(/\D/g, '').length !== 8 : !editor.dados[campo]?.trim())
          return <label key={campo} className={`block text-sm ${invalido ? 'text-red-300' : 'text-gray-300'}`}>{label}{campo !== 'complemento' && ' *'}
            <input required={campo !== 'complemento'} maxLength={max} autoComplete={autocomplete} aria-invalid={invalido || undefined}
              aria-describedby={campo === 'cep' ? 'aviso-cep-endereco' : undefined} inputMode={campo === 'cep' ? 'numeric' : 'text'} value={editor.dados[campo] || ''} onChange={e => {
              if (campo === 'cep') { consultarCep(e.target.value); return }
              alterados.current.add(campo); setEditor({ ...editor, dados: { ...editor.dados, [campo]: e.target.value } })
            }} className={`mt-2 w-full rounded border bg-hb-black p-3 text-base text-white focus:outline-none focus:border-hb-gold ${invalido ? 'border-red-400/70' : 'border-gray-700'}`} />
          </label>
        })}
        <label className={`block text-sm ${obrigatorio && !editor.dados.uf ? 'text-red-300' : 'text-gray-300'}`}>Estado *
          <select aria-label="Estado" required autoComplete="address-level1" aria-invalid={obrigatorio && !editor.dados.uf || undefined} value={editor.dados.uf || ''} onChange={e => { alterados.current.add('uf'); setEditor({ ...editor, dados: { ...editor.dados, uf: e.target.value } }) }} className={`mt-2 w-full rounded border bg-hb-black p-3 text-base text-white ${obrigatorio && !editor.dados.uf ? 'border-red-400/70' : 'border-gray-700'}`}><option value="">Selecione</option>{ESTADOS.map(uf => <option key={uf}>{uf}</option>)}</select>
        </label>
      </div>
      <p id="aviso-cep-endereco" role="status" className={`text-sm leading-relaxed ${erroCep ? 'text-red-300' : 'text-hb-goldLight'}`}>
        {buscando ? 'Buscando endereço pelo CEP… Você também pode preencher manualmente.' : avisoCep || 'Ao completar os oito dígitos do CEP, buscamos seu endereço.'}
      </p>
      <label className="min-h-11 flex items-center gap-3 text-sm"><input type="checkbox" className="accent-hb-gold" checked={editor.padrao} onChange={e => setEditor({ ...editor, padrao: e.target.checked })} /> Usar como endereço padrão</label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={salvando} className="min-h-12 bg-hb-gold text-black rounded px-5 py-3 font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50">{salvando && <Loader2 size={16} className="animate-spin" />} {onSalvo ? 'Salvar e continuar compra' : 'Salvar endereço'}</button>
        <button type="button" disabled={salvando} onClick={fechar} className="min-h-12 border border-gray-700 rounded px-5 py-3 text-sm">Cancelar</button>
      </div>
    </form>}
    {erro && <p role="alert" className="text-sm text-red-300">{erro}</p>}
    {remocao && <Modal labelledBy="remover-endereco-titulo" onClose={() => setRemocao(null)} className="max-w-md rounded-2xl border border-hb-gold/40 bg-hb-gray p-6 md:p-8 text-luxury-ivory shadow-gold">
      <h2 id="remover-endereco-titulo" className="text-2xl mb-4">Remover endereço?</h2>
      <p className="text-sm leading-relaxed text-luxury-muted">O endereço {remocao.apelido} será removido da sua conta. Seus pedidos anteriores serão preservados.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => setRemocao(null)} className="min-h-12 rounded border border-gray-600 px-5 text-sm">Cancelar</button>
        <button type="button" onClick={() => { const endereco = remocao; setRemocao(null); executar('excluir', endereco) }} className="min-h-12 rounded bg-hb-gold px-5 text-sm font-bold text-hb-black">Remover endereço</button>
      </div>
    </Modal>}
  </section>
}
