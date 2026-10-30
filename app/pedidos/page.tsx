'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Package, RefreshCcw, Upload, AlertCircle, CheckCircle2, Loader2, ChevronRight, X } from 'lucide-react'
import Link from 'next/link'

export default function MeusPedidos() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  // Estados mockados para o exemplo (aqui você puxaria da sua tabela de pedidos)
  const [pedidos, setPedidos] = useState<any[]>([
    {
      id: 'PED-12345',
      data: '10/05/2026',
      status: 'Entregue',
      total: 299.90,
      itens: [
        { id: '1', nome: 'Anel Solitário Cravejado', preco: 299.90, foto: 'https://images.unsplash.com/photo-1605100804763-247f67b2548e?w=200&q=80' }
      ]
    }
  ])

  // Estados do Modal de Troca
  const [modalAberta, setModalAberta] = useState(false)
  const [itemSelecionado, setItemSelecionado] = useState<any>(null)
  const [pedidoIdSelecionado, setPedidoIdSelecionado] = useState('')
  const [motivo, setMotivo] = useState('arrependimento')
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null)
  
  const [carregando, setCarregando] = useState(false)
  const [mensagemSucesso, setMensagemSucesso] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const abrirModalTroca = (pedidoId: string, item: any) => {
    setPedidoIdSelecionado(pedidoId)
    setItemSelecionado(item)
    setMotivo('arrependimento')
    setFotoArquivo(null)
    setMensagemSucesso('')
    setErro('')
    setModalAberta(true)
  }

  const enviarSolicitacaoTroca = async (e: React.FormEvent) => {
    e.preventDefault()
    setCarregando(true)
    setErro('')

    if (motivo === 'defeito' && !fotoArquivo) {
      setErro('Para defeitos de fábrica, é obrigatório enviar uma foto.')
      setCarregando(false)
      return
    }

    try {
      let urlFoto = null
      
      // 1. Fazer upload da foto no Supabase (usaremos a pasta 'trocas' dentro do seu bucket 'joias')
      if (fotoArquivo) {
        const extensao = fotoArquivo.name.split('.').pop()
        const nomeArquivo = `trocas/${Math.random().toString(36).substring(2)}-${Date.now()}.${extensao}`
        
        const { error: uploadError } = await supabase.storage
          .from('joias')
          .upload(nomeArquivo, fotoArquivo)

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage.from('joias').getPublicUrl(nomeArquivo)
        urlFoto = publicUrlData.publicUrl
      }

      // 2. Chamar a nossa API inteligente
      // Obs: Precisamos do ID real do usuário logado. Como é um exemplo, passaremos um ID fictício ou o ID da session se existir.
      // const usuarioId = session?.user?.id 
      const usuarioId = null // Deixando nulo temporariamente só para o nosso teste funcionar

      const response = await fetch('/api/trocas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedidoId: pedidoIdSelecionado,
          produtoId: null, // Supondo que você tem o UUID do produto
          usuarioId: null,
          motivo,
          fotoUrl: urlFoto,
          precoProduto: itemSelecionado.preco
        })
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error)

      setMensagemSucesso(data.mensagem)
      
      // Fechar modal após 5 segundos
      setTimeout(() => {
        setModalAberta(false)
        setMensagemSucesso('')
      }, 5000)

    } catch (err: any) {
      setErro('Ocorreu um erro ao processar sua solicitação. Tente novamente.')
      console.error(err)
    } finally {
      setCarregando(false)
    }
  }

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>

  return (
    <main className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-4xl mx-auto px-6">
        
        <div className="flex items-center gap-3 mb-12">
          <Package className="text-black" size={28} />
          <h1 className="text-2xl font-light uppercase tracking-widest text-gray-900">
            Meus Pedidos
          </h1>
        </div>

        <div className="space-y-6">
          {pedidos.map((pedido) => (
            <div key={pedido.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Cabeçalho do Pedido */}
              <div className="bg-gray-50/50 p-6 border-b border-gray-100 flex flex-wrap justify-between items-center gap-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Pedido Realizado</p>
                  <p className="text-sm font-medium text-gray-900">{pedido.data}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total</p>
                  <p className="text-sm font-medium text-gray-900">R$ {pedido.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Pedido Nº</p>
                  <p className="text-sm font-medium text-gray-900">{pedido.id}</p>
                </div>
                <div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-green-50 text-green-700">
                    {pedido.status}
                  </span>
                </div>
              </div>

              {/* Itens do Pedido */}
              <div className="p-6">
                {pedido.itens.map((item: any, index: number) => (
                  <div key={index} className="flex flex-col sm:flex-row items-center gap-6 py-4 border-b border-gray-50 last:border-0 last:pb-0">
                    <img src={item.foto} alt={item.nome} className="w-24 h-24 object-cover rounded-xl border border-gray-100" />
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-2">{item.nome}</h3>
                      <p className="text-sm text-gray-500 mb-4">R$ {item.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    {pedido.status === 'Entregue' && (
                      <button 
                        onClick={() => abrirModalTroca(pedido.id, item)}
                        className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 px-4 py-2 rounded border border-gray-200 text-gray-600 hover:border-black hover:text-black transition"
                      >
                        <RefreshCcw size={14} /> Solicitar Troca
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* MODAL DE TROCA / DEVOLUÇÃO */}
      {modalAberta && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl relative">
            <button onClick={() => setModalAberta(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black transition">
              <X size={20} />
            </button>

            <h2 className="text-lg font-light uppercase tracking-widest text-gray-900 mb-6 flex items-center gap-2">
              <RefreshCcw size={20} /> Solicitar Troca
            </h2>

            {mensagemSucesso ? (
              <div className="bg-green-50 text-green-700 p-6 rounded-xl border border-green-100 text-center space-y-4">
                <CheckCircle2 size={40} className="mx-auto" />
                <p className="text-sm font-medium">{mensagemSucesso}</p>
              </div>
            ) : (
              <form onSubmit={enviarSolicitacaoTroca} className="space-y-6">
                
                {erro && (
                  <div className="p-3 bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-widest rounded flex items-center gap-2 border border-red-100">
                    <AlertCircle size={14} /> {erro}
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Item Selecionado</p>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-100">
                    <img src={itemSelecionado?.foto} className="w-10 h-10 object-cover rounded" />
                    <p className="text-xs font-bold text-gray-900 uppercase truncate">{itemSelecionado?.nome}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Motivo da Troca</label>
                  <select 
                    value={motivo} 
                    onChange={(e) => setMotivo(e.target.value)}
                    className="w-full border border-gray-200 p-3 rounded outline-none focus:border-black text-sm"
                  >
                    <option value="arrependimento">Arrependimento (Dentro de 7 dias)</option>
                    <option value="defeito">Defeito de Fabricação</option>
                    <option value="tamanho">Tamanho Incorreto</option>
                  </select>
                </div>

                {/* Aparece apenas se for Defeito */}
                {motivo === 'defeito' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-red-600 uppercase tracking-widest mb-2">
                      <Upload size={14} /> Foto do Defeito (Obrigatório)
                    </label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      required
                      onChange={(e) => setFotoArquivo(e.target.files?.[0] || null)}
                      className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-[10px] file:font-bold file:uppercase file:tracking-widest file:bg-gray-100 file:text-black hover:file:bg-gray-200 cursor-pointer border border-gray-200 p-2"
                    />
                    <p className="text-[9px] text-gray-400 mt-2">Envie uma foto clara mostrando o problema para acelerar a aprovação.</p>
                  </div>
                )}

                <button 
                  type="submit" disabled={carregando}
                  className="w-full bg-black text-white py-4 text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {carregando ? <><Loader2 size={16} className="animate-spin" /> ENVIANDO...</> : 'ENVIAR SOLICITAÇÃO'}
                </button>
                
                <p className="text-[9px] text-gray-400 text-center mt-4">
                  Ao solicitar, você concorda com a nossa <Link href="/trocas" className="underline hover:text-gray-900">Política de Trocas</Link>.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
