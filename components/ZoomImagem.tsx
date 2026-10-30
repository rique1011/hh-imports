'use client'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props { src: string; alt: string; material?: string; fotos?: string[] }
export default function ZoomImagem({ src, alt, material, fotos }: Props) {
  const imagens = fotos?.length ? fotos : [src]
  const trilho = useRef<HTMLDivElement>(null)
  const frame = useRef<number | null>(null)
  const [ativa, setAtiva] = useState(0)
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current) }, [])
  function ir(index: number) { const el = trilho.current; if (el) el.scrollTo({ left: Math.max(0, Math.min(imagens.length - 1, index)) * el.clientWidth, behavior: 'smooth' }) }
  function mover(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') return
    const el = event.currentTarget, x = event.clientX, y = event.clientY
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      const img = el.querySelector('img'), rect = el.getBoundingClientRect()
      if (img && rect.width && rect.height) img.style.transformOrigin = `${(x - rect.left) / rect.width * 100}% ${(y - rect.top) / rect.height * 100}%`
    })
  }
  return <section aria-label="Galeria do produto" className="min-w-0">
    <div className="relative">
      <div ref={trilho} className="flex w-full min-w-0 overflow-x-auto snap-x snap-mandatory rounded-xl border border-gray-800 [scrollbar-width:none]" onScroll={e => setAtiva(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {imagens.map((imagem, index) => <div key={imagem + index} className="group relative basis-full shrink-0 min-w-0 snap-center aspect-square overflow-hidden bg-hb-gray cursor-zoom-in"
          onPointerMove={mover} onPointerEnter={e => { if (e.pointerType === 'mouse') { e.currentTarget.dataset.zoom = 'true'; const img = e.currentTarget.querySelector('img'); if (img) img.style.transform = 'scale(2.5)' } }}
          onPointerLeave={e => { e.currentTarget.dataset.zoom = 'false'; const img = e.currentTarget.querySelector('img'); if (img) img.style.transform = 'scale(1)' }}>
          {/* A resolução original é necessária para a ampliação. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagem} alt={`${alt} — imagem ${index + 1}`} width={1000} height={1000} loading={index ? 'lazy' : 'eager'} fetchPriority={index ? 'auto' : 'high'} decoding="async" draggable={false} className="w-full h-full object-cover transition-transform duration-200 motion-reduce:transition-none" />
          {material && <span className="absolute left-3 top-3 bg-white/90 text-black rounded-full px-3 py-2 text-[10px] font-bold uppercase pointer-events-none group-data-[zoom=true]:opacity-0 transition-opacity">{material}</span>}
        </div>)}
      </div>
      {imagens.length > 1 && <><button type="button" aria-label="Imagem anterior" onClick={() => ir(ativa - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 min-w-11 min-h-11 grid place-items-center bg-black/70 rounded-full"><ChevronLeft /></button><button type="button" aria-label="Próxima imagem" onClick={() => ir(ativa + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 min-w-11 min-h-11 grid place-items-center bg-black/70 rounded-full"><ChevronRight /></button></>}
    </div>
    {imagens.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto" aria-label="Selecionar imagem">{imagens.map((_, index) => <button key={index} type="button" aria-label={`Mostrar imagem ${index + 1}`} aria-pressed={ativa === index} onClick={() => ir(index)} className={`min-w-11 min-h-11 rounded border text-sm ${ativa === index ? 'border-hb-gold text-hb-gold' : 'border-gray-700 text-gray-400'}`}>{index + 1}</button>)}</div>}
    {imagens.length > 1 && <p className="mt-2 text-xs text-gray-400">Deslize para ver mais imagens. {ativa + 1}/{imagens.length}</p>}
  </section>
}
