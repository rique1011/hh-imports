'use client'
import Modal from '@/components/Modal'

import type { Cupom } from '@/types/loja'

import { useState, useEffect } from 'react'
import { Plus, Ticket, Loader2, Trash2, CheckCircle2, XCircle, X } from 'lucide-react'
import { supabaseAdmin as supabase } from '@/lib/admin-client'

export default function TelaCupons() {
  const [cupons, setCupons] = useState<Cupom[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberta, setModalAberta] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState({ codigo: '', desconto: '' })

  useEffect(() => {
    carregarCupons()
  }, [])

  async function carregarCupons() {
    try {
      const { data, error } = await supabase
        .from('cupons')
        .select('*')
        .gt('desconto', 0)
        .order('criado_em', { ascending: false })

      if (error) throw error
      setCupons(data || [])
    } catch (error) {
      console.error("Erro ao carregar cupons:", error)
    } finally {
      setCarregando(false)
    }
  }

  const handleSalvarCupom = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)

    try {
      const { error } = await supabase.from('cupons').insert([{
        codigo: form.codigo.toUpperCase().replace(/\s/g, ''),
        desconto: Number(form.desconto),
        valor_fixo: 0,
        ativo: true
      }])

      if (error) throw error

      alert("Cupom criado com sucesso! Ele já está aparecendo na loja.")
      setModalAberta(false)
      setForm({ codigo: '', desconto: '' })
      carregarCupons()
    } catch {
      alert("Erro ao criar cupom. Verifique se o código já existe.")
    } finally {
      setSalvando(false)
    }
  }

  const alternarStatus = async (id: string, ativoAtual: boolean) => {
    try {
      await supabase.from('cupons').update({ ativo: !ativoAtual }).eq('id', id)
      carregarCupons()
    } catch {
      alert("Erro ao alterar status.")
    }
  }

  const excluirCupom = async (id: string) => {
    if (!confirm("Tem certeza que deseja apagar este cupom permanentemente?")) return
    try {
      await supabase.from('cupons').delete().eq('id', id)
      carregarCupons()
    } catch {
      alert("Erro ao excluir.")
    }
  }

  return (
    <div className="text-gray-300 bg-hb-black min-h-screen">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl break-words font-light text-white uppercase tracking-widest mb-2">Cupons Promocionais</h1>
          <p className="text-sm text-gray-400">Crie cupons de desconto para incentivar compras na sua loja.</p>
        </div>
        <button onClick={() => setModalAberta(true)} className="bg-hb-gold text-hb-black px-6 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-hb-goldLight transition shadow-md">
          <Plus size={16} /> Novo Cupom
        </button>
      </header>

      {carregando ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-hb-gold" size={32} /></div>
      ) : cupons.length === 0 ? (
        <div className="bg-hb-gray p-12 rounded-2xl border border-gray-800 text-center shadow-sm">
          <Ticket size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400 uppercase tracking-widest text-sm font-bold mb-2">Nenhum cupom promocional ativo.</p>
          <p className="text-xs text-gray-500">Clique no botão acima para criar o seu primeiro cupom.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {cupons.map((cupom) => (
            <div key={cupom.id} className={`p-6 rounded-xl border relative overflow-hidden transition ${cupom.ativo ? 'bg-hb-gray border-gray-800 shadow-sm shadow-hb-gold/5' : 'bg-neutral-900 border-neutral-800 opacity-45'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-lg ${cupom.ativo ? 'bg-green-950/40 text-green-400 border border-green-800/30' : 'bg-neutral-800 text-neutral-500'}`}>
                  <Ticket size={24} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => alternarStatus(cupom.id, cupom.ativo)} className="p-2 text-gray-500 hover:text-white transition" title={cupom.ativo ? "Desativar" : "Ativar"}>
                    {cupom.ativo ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                  </button>
                  <button onClick={() => excluirCupom(cupom.id)} className="p-2 text-gray-500 hover:text-red-400 transition" title="Excluir">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Código do Cupom</p>
              <h3 className="text-2xl font-black text-white mb-4 uppercase tracking-wider">{cupom.codigo}</h3>
              <div className="flex justify-between items-center border-t border-gray-800 pt-4 mt-4">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Desconto:</span>
                <span className="text-sm font-black text-green-400">{cupom.desconto}% OFF</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL NOVO CUPOM */}
      {modalAberta && (
        <Modal onClose={() => setModalAberta(false)} labelledBy="titulo-cupom" className="bg-hb-gray border border-gray-800 rounded-2xl max-w-sm p-5 sm:p-8 shadow-2xl relative text-white">
            <button onClick={() => setModalAberta(false)} aria-label="Fechar janela" className="absolute top-3 right-3 min-w-11 min-h-11 grid place-items-center text-gray-400 hover:text-white transition"><X size={20} /></button>
            <h2 id="titulo-cupom" className="text-lg font-light uppercase tracking-widest text-white mb-6">Criar Cupom</h2>
            <form onSubmit={handleSalvarCupom} className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Código (Ex: BEMVINDO10)</label>
                <input required value={form.codigo} onChange={e => setForm({...form, codigo: e.target.value.toUpperCase()})} className="w-full bg-hb-black border border-gray-700 p-3 rounded text-sm text-white outline-none uppercase font-bold focus:border-hb-gold placeholder-gray-600" placeholder="DIGITE O CODIGO" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Porcentagem de Desconto (%)</label>
                <input required type="number" min="1" max="100" value={form.desconto} onChange={e => setForm({...form, desconto: e.target.value})} className="w-full bg-hb-black border border-gray-700 p-3 rounded text-sm text-white outline-none focus:border-hb-gold placeholder-gray-600" placeholder="Ex: 10" />
              </div>
              <button type="submit" disabled={salvando} className="w-full bg-hb-gold text-hb-black py-4 text-xs font-bold uppercase tracking-widest hover:bg-hb-goldLight transition disabled:opacity-50 flex items-center justify-center gap-2 rounded">
                {salvando ? <Loader2 size={16} className="animate-spin" /> : 'CRIAR E ATIVAR CUPOM'}
              </button>
            </form>
        </Modal>
      )}
    </div>
  )
}
