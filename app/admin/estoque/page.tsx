'use client'
import Modal from '@/components/Modal'
import FotosProdutoEditor from '@/components/FotosProdutoEditor'
import type { FotoProdutoEdicao } from '@/lib/fotos-produto'

import Image from 'next/image'
import type { Produto } from '@/types/loja'
import { mensagemErro } from '@/lib/erros'

import { uploadImagem } from '@/lib/upload-imagem'

import { useState, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, Loader2, Image as ImageIcon, Box, X } from 'lucide-react'
import { supabaseAdmin as supabase } from '@/lib/admin-client'
import { CATEGORIAS, categoriaDoProduto, obterCategoria } from '@/lib/categorias'
import toast from 'react-hot-toast'
import { VITRINES_PRODUTO, SELECOES, type VitrineProduto } from '@/lib/selecoes'

export default function TelaEstoque() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')

  const [modalAberta, setModalAberta] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [fotos, setFotos] = useState<FotoProdutoEdicao[]>([])
  const [vitrines, setVitrines] = useState<VitrineProduto[]>([])
  const [progressoFotos, setProgressoFotos] = useState({ feitas: 0, total: 0 })
  
  const [produtoEditandoId, setProdutoEditandoId] = useState<string | null>(null)

  const [form, setForm] = useState({
    nome: '',
    preco: '',
    estoque: '0',
    material: 'Ouro 18k',
    descricao: '',
    video_url: '',
    categoria_slug: ''
  })

  useEffect(() => {
    carregarProdutos()
  }, [])

  async function carregarProdutos() {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('criado_em', { ascending: false })

      if (error) throw error
      setProdutos(data || [])
    } catch (error) {
      console.error("Erro ao carregar estoque:", error)
    } finally {
      setCarregando(false)
    }
  }

  const abrirModalNovo = () => {
    setProdutoEditandoId(null)
    setFotos([])
    setVitrines([])
    setForm({ nome: '', preco: '', estoque: '0', material: 'Ouro 18k', descricao: '', video_url: '', categoria_slug: '' })
    setProgressoFotos({ feitas: 0, total: 0 })
    setModalAberta(true)
  }

  const abrirModalEditar = (produto: Produto) => {
    setVitrines(produto.vitrines || [])
    setProdutoEditandoId(produto.id)
    setFotos((produto.fotos || []).map((url, index) => ({ id: String(index) + ':' + url, url })))
    setForm({
      nome: produto.nome || '',
      preco: produto.preco?.toString() || '',
      estoque: String(produto.estoque ?? 0),
      material: produto.material || 'Ouro 18k',
      descricao: produto.descricao || '',
      video_url: produto.video_url || '',
      categoria_slug: categoriaDoProduto(produto) || ''
    })
    setProgressoFotos({ feitas: 0, total: 0 })
    setModalAberta(true)
  }

  const gerarSlug = (texto: string) => {
    return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
  }

  const handleSalvarProduto = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)

    try {
      const fotosArray: string[] = []
      const pendentes = fotos.filter(foto => foto.arquivo).length
      setProgressoFotos({ feitas: 0, total: pendentes })
      // Cada sucesso fica no formulário: uma falha pode ser retomada sem reenviar tudo.
      for (const foto of fotos) {
        let url = foto.url
        if (foto.arquivo) {
          url = await uploadImagem(foto.arquivo, 'produtos')
          setFotos(atuais => atuais.map(atual => atual.id === foto.id ? { id: atual.id, url } : atual))
          setProgressoFotos(atual => ({ ...atual, feitas: atual.feitas + 1 }))
        }
        fotosArray.push(url)
      }

      const dadosProduto = {
        nome: form.nome,
        slug: gerarSlug(form.nome),
        preco: Number(form.preco),
        estoque: Number(form.estoque),
        material: form.material,
        descricao: form.descricao,
        video_url: form.video_url || null,
        categoria_slug: form.categoria_slug,
        vitrines,
        fotos: fotosArray
      }

      if (produtoEditandoId) {
        const { error } = await supabase.from('produtos').update(dadosProduto).eq('id', produtoEditandoId)
        if (error) throw error
        toast.success("Produto atualizado com sucesso!")
      } else {
        const { error } = await supabase.from('produtos').insert([dadosProduto])
        if (error) throw error
        toast.success("Produto adicionado com sucesso!")
      }

      setModalAberta(false)
      carregarProdutos()
    } catch (error) {
      toast.error("Erro ao salvar produto: " + mensagemErro(error))
    } finally {
      setSalvando(false)
    }
  }

  const excluirProduto = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja EXCLUIR "${nome}" da loja? Essa ação não pode ser desfeita.`)) return

    try {
      const { error } = await supabase.from('produtos').delete().eq('id', id)
      if (error) throw error
      setProdutos(produtos.filter(p => p.id !== id))
    } catch {
      alert("Erro ao excluir produto.")
    }
  }

  const produtosFiltrados = produtos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div className="text-gray-300 bg-hb-black min-h-screen">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl break-words font-light text-white uppercase tracking-widest mb-2">Controle de Estoque</h1>
          <p className="text-sm text-gray-400">Cadastre suas joias, ajuste preços e organize a vitrine.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto min-w-0">
          <div className="bg-hb-gray border border-gray-800 rounded-full px-4 py-2 flex items-center gap-2 shadow-sm flex-1 min-w-0 md:w-64">
            <Search size={16} className="text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar peça..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="outline-none text-sm text-white bg-transparent w-full min-w-0 placeholder-gray-600"
            />
          </div>
          <button onClick={abrirModalNovo} className="bg-hb-gold text-hb-black px-6 py-2 rounded-full font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-hb-goldLight transition shadow-md">
            <Plus size={16} /> Novo Produto
          </button>
        </div>
      </header>

      {carregando ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-hb-gold" size={32} /></div>
      ) : produtosFiltrados.length === 0 ? (
        <div className="bg-hb-gray p-12 rounded-2xl border border-gray-800 text-center shadow-sm">
          <Box size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400 uppercase tracking-widest text-sm font-bold mb-2">Nenhum produto encontrado.</p>
          <p className="text-xs text-gray-500">Clique em &quot;Novo Produto&quot; para adicionar sua primeira joia.</p>
        </div>
      ) : (
        <div className="bg-hb-gray border border-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-900/50 border-b border-gray-800 text-[10px] uppercase tracking-widest text-gray-500">
                  <th className="p-4 font-bold">Produto</th>
                  <th className="p-4 font-bold">Material</th>
                  <th className="p-4 font-bold">Preço</th>
                  <th className="p-4 font-bold text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {produtosFiltrados.map((produto) => (
                  <tr key={produto.id} className="hover:bg-gray-800/40 transition">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {produto.fotos && produto.fotos[0] ? (
                          <Image width={40} height={40} sizes="40px" src={produto.fotos[0]} alt={produto.nome} className="w-10 h-10 object-cover rounded border border-gray-700" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-hb-black border border-gray-800 flex items-center justify-center text-gray-600"><ImageIcon size={16}/></div>
                        )}
                        <div>
                          <p className="text-xs font-bold text-gray-200 uppercase">{produto.nome}</p>
                          <p className="text-[10px] text-gray-500">Slug: /{produto.slug}</p>
                          <p className="mt-1 text-[10px] text-hb-goldLight">Categoria: {obterCategoria(categoriaDoProduto(produto))?.nome || 'Não definida'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-hb-black text-gray-400 rounded text-[9px] font-bold uppercase tracking-widest border border-gray-800">{produto.material || 'N/A'}</span>
                    </td>
                    <td className="p-4 text-xs font-bold text-hb-gold">
                      R$ {Number(produto.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => abrirModalEditar(produto)} className="p-2 text-gray-500 hover:text-hb-gold transition" title="Editar"><Edit size={16} /></button>
                        <button onClick={() => excluirProduto(produto.id, produto.nome)} className="p-2 text-gray-500 hover:text-red-400 transition" title="Excluir"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR / EDITAR PRODUTO */}
      {modalAberta && (
        <Modal onClose={() => { if (!salvando) setModalAberta(false) }} labelledBy="titulo-produto" className="bg-hb-gray border border-gray-800 rounded-2xl max-w-2xl p-5 sm:p-8 shadow-2xl relative text-white">
            <button disabled={salvando} onClick={() => setModalAberta(false)} aria-label="Fechar janela" className="absolute top-3 right-3 min-w-11 min-h-11 grid place-items-center text-gray-400 hover:text-white transition"><X size={20} /></button>
            <h2 id="titulo-produto" className="text-lg font-light uppercase tracking-widest text-white mb-6 border-b border-gray-800 pb-4">
              {produtoEditandoId ? 'Editar Joia' : 'Cadastrar Nova Joia'}
            </h2>
            
            <form onSubmit={handleSalvarProduto} className="space-y-6">
              <fieldset disabled={salvando} className="min-w-0 space-y-6">
              <div>
                <label htmlFor="categoria-produto" className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Categoria da peça *</label>
                <select id="categoria-produto" required value={form.categoria_slug} onChange={e => setForm({ ...form, categoria_slug: e.target.value })}
                  className="min-h-11 w-full bg-hb-black border border-gray-700 p-3 rounded text-base text-white outline-none focus:border-hb-gold">
                  <option value="">Selecione a coleção</option>
                  {CATEGORIAS.map(c => <option key={c.slug} value={c.slug}>{c.nome}</option>)}
                </select>
                <p className="mt-2 text-xs text-gray-400">Define em qual coleção a peça aparece na loja.</p>
              </div>
              <fieldset className="rounded border border-luxury-line p-4">
                <legend className="px-2 text-sm text-luxury-gold-light">Exibir também em</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-2">{VITRINES_PRODUTO.map(slug => <label key={slug} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-hb-gold" checked={vitrines.includes(slug)} onChange={e => setVitrines(atuais => e.target.checked ? [...atuais, slug] : atuais.filter(s => s !== slug))} />{SELECOES.find(s => s.slug === slug)?.nome}</label>)}</div>
                <p className="mt-2 text-xs leading-6 text-gray-400">Masculino e Presentes mostram as peças marcadas aqui. Lançamentos inclui também os produtos cadastrados nos últimos 30 dias.</p>
              </fieldset>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Nome do Produto</label>
                  <input required value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full bg-hb-black border border-gray-700 p-3 rounded text-sm text-white outline-none focus:border-hb-gold placeholder-gray-600" placeholder="Ex: Colar Riviera Diamantes" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Preço (R$)</label>
                  <input required type="number" step="0.01" value={form.preco} onChange={e => setForm({...form, preco: e.target.value})} className="w-full bg-hb-black border border-gray-700 p-3 rounded text-sm text-white outline-none focus:border-hb-gold placeholder-gray-600" placeholder="Ex: 1499.90" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Material / Composição</label>
                  <select value={form.material} onChange={e => setForm({...form, material: e.target.value})} className="w-full bg-hb-black border border-gray-700 p-3 rounded text-sm text-white outline-none focus:border-hb-gold">
                    <option value="Ouro 18k">Ouro 18k</option>
                    <option value="Prata 925">Prata 925</option>
                    <option value="Banhado a Ouro">Banhado a Ouro</option>
                    <option value="Aço Inoxidável">Aço Inoxidável</option>
                    <option value="Couro Premium">Couro Premium</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">URL do Vídeo (Opcional)</label>
                  <input value={form.video_url} onChange={e => setForm({...form, video_url: e.target.value})} className="w-full bg-hb-black border border-gray-700 p-3 rounded text-sm text-white outline-none focus:border-hb-gold placeholder-gray-600" placeholder="Link do vídeo MP4" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Descrição da Peça</label>
                <textarea rows={4} value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} className="w-full bg-hb-black border border-gray-700 p-3 rounded text-sm text-white outline-none focus:border-hb-gold resize-none placeholder-gray-600" placeholder="Conte a história e os detalhes do acabamento desta peça..."></textarea>
              </div>

              <div>
                <label htmlFor="estoque-disponivel" className="block text-xs text-gray-400 mb-2">Estoque físico (unidades)</label>
                <input id="estoque-disponivel" type="number" inputMode="numeric" min="0" step="1" required value={form.estoque} onChange={e => setForm({ ...form, estoque: e.target.value })} className="min-h-11 w-full bg-hb-black border border-gray-700 rounded p-3" />
                <p className="mt-2 text-xs text-gray-500">O estoque físico deve cobrir as unidades já reservadas por pedidos.</p>
              </div>
              <FotosProdutoEditor fotos={fotos} onChange={setFotos} desabilitado={salvando} />
              {salvando && progressoFotos.total > 0 && <p role="status" className="text-sm text-hb-gold">Enviando fotos: {progressoFotos.feitas}/{progressoFotos.total}. Aguarde para concluir o cadastro.</p>}

              <button type="submit" disabled={salvando} className="w-full bg-hb-gold text-hb-black py-4 text-xs font-bold uppercase tracking-widest hover:bg-hb-goldLight transition disabled:opacity-50 flex items-center justify-center gap-2 rounded">
                {salvando ? <Loader2 size={16} className="animate-spin" /> : (produtoEditandoId ? 'SALVAR ALTERAÇÕES' : 'SALVAR PRODUTO')}
              </button>
              </fieldset>
            </form>
        </Modal>
      )}
    </div>
  )
}
