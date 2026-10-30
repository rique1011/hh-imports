'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Star, Loader2 } from 'lucide-react'
import { useSession } from 'next-auth/react'

export default function Avaliacoes({ produtoId }: { produtoId: string }) {
  const { data: session } = useSession()
  const [reviews, setReviews] = useState<{ id: number; nota: number; usuario_nome: string; comentario: string }[]>([])
  const [nota, setNota] = useState(5)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('avaliacoes')
        .select('id,nota,usuario_nome,comentario')
        .eq('produto_id', produtoId)
        .order('created_at', { ascending: false }).limit(50)
      setReviews(data || [])
    }
    carregar()
  }, [produtoId])

  const enviarReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) return alert("Faça login para avaliar!")
    setEnviando(true)

    try {
      const response = await fetch('/api/avaliacoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produtoId, nota, comentario })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Falha ao publicar avaliação.')
      const { data: atualizadas } = await supabase.from('avaliacoes')
        .select('id,nota,usuario_nome,comentario').eq('produto_id', produtoId)
        .order('created_at', { ascending: false }).limit(50)
      setReviews(atualizadas || [])
      setComentario('')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Falha de conexão.')
    } finally { setEnviando(false) }
  }

  return (
    <div className="mt-12 md:mt-16 border-t border-neutral-800 pt-8 md:pt-12 text-white">
      <h2 className="text-lg md:text-xl font-light uppercase tracking-widest mb-6 md:mb-8">Avaliações de Clientes</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        {/* Lista de Reviews */}
        <div className="space-y-6 md:space-y-8">
          {reviews.length === 0 && <p className="text-neutral-500 italic text-sm">Este produto ainda não recebeu avaliações.</p>}
          {reviews.map((r) => (
            <div key={r.id} className="border-b border-neutral-800 pb-5 md:pb-6">
              <div className="flex gap-1 mb-2">
                {[...Array(5)].map((_, index) => (
                  <Star 
                    key={index} 
                    size={12} 
                    fill={index < r.nota ? "currentColor" : "none"} 
                    className={index < r.nota ? "text-hb-gold" : "text-neutral-700"} 
                  />
                ))}
              </div>
              <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-neutral-200">{r.usuario_nome}</p>
              <p className="text-xs md:text-sm text-neutral-400 mt-1 md:mt-2 italic leading-relaxed break-words">&ldquo;{r.comentario}&rdquo;</p>
            </div>
          ))}
        </div>

        {/* Formulário */}
        <div className="bg-neutral-900 p-6 md:p-8 rounded-2xl border border-neutral-800 h-fit">
          <h3 className="text-xs md:text-sm font-bold uppercase mb-4 md:mb-6 tracking-widest text-white">Deixe sua opinião</h3>
          {session ? (
            <form onSubmit={enviarReview} className="space-y-5 md:space-y-6">
              <div>
                <p className="text-[9px] md:text-[10px] text-neutral-400 uppercase tracking-widest mb-2 font-bold">Sua Nota</p>
                <div className="flex flex-wrap gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button type="button" key={n} onClick={() => setNota(n)} aria-label={`${n} estrela(s)`} aria-pressed={nota === n} className="min-w-11 min-h-11 grid place-items-center hover:scale-110 transition">
                      <Star 
                        size={20} 
                        className={`md:w-6 md:h-6 ${n <= nota ? "text-hb-gold" : "text-neutral-700"}`}
                        fill={n <= nota ? "currentColor" : "none"} 
                      />
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <p className="text-[9px] md:text-[10px] text-neutral-400 uppercase tracking-widest mb-2 font-bold">Seu Comentário</p>
                <textarea aria-label="Seu comentário" maxLength={3000}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="O que você achou da qualidade da joia?"
                  className="w-full bg-transparent border border-neutral-700 text-white placeholder-neutral-600 p-3 md:p-4 rounded-xl text-base md:text-sm h-28 md:h-32 outline-none focus:border-hb-gold resize-none transition"
                  required
                />
              </div>

              <button disabled={enviando} className="w-full bg-hb-gold text-hb-black py-3 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-widest hover:bg-hb-goldLight transition disabled:opacity-50 rounded">
                {enviando ? <Loader2 className="animate-spin mx-auto text-hb-black" size={16} /> : 'Publicar Avaliação'}
              </button>
            </form>
          ) : (
            <div className="text-center py-6">
              <p className="text-[10px] md:text-xs text-neutral-400 mb-4 leading-relaxed">Você precisa estar logado para avaliar este produto e compartilhar sua experiência.</p>
              <Link href="/login" className="inline-block border-b border-hb-gold text-hb-gold text-[9px] md:text-[10px] font-bold uppercase tracking-widest pb-1 hover:text-hb-goldLight transition">
                Fazer Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
