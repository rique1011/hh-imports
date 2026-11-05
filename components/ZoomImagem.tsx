'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props { src: string; alt: string; material?: string | null; fotos?: string[] }

function ImagemGaleria({ imagem, alt, primeira, material }: { imagem: string; alt: string; primeira: boolean; material?: string | null }) {
  const area = useRef<HTMLDivElement>(null)
  const frame = useRef<number | null>(null)
  const [original, setOriginal] = useState(false)
  const [originalCarregada, setOriginalCarregada] = useState(false)
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current) }, [])

  function mover(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') return
    const el = event.currentTarget, x = event.clientX, y = event.clientY
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      const rect = el.getBoundingClientRect()
      if (area.current && rect.width && rect.height) area.current.style.transformOrigin = `${(x - rect.left) / rect.width * 100}% ${(y - rect.top) / rect.height * 100}%`
    })
  }

  return <div className="group relative w-full flex-none snap-center aspect-[4/5] overflow-hidden bg-luxury-surface cursor-zoom-in"
    onPointerMove={mover}
    onPointerEnter={event => {
      if (event.pointerType !== 'mouse') return
      setOriginal(true)
      event.currentTarget.dataset.zoom = 'true'
      if (area.current) area.current.style.transform = 'scale(2.5)'
    }}
    onPointerLeave={event => {
      event.currentTarget.dataset.zoom = 'false'
      if (area.current) area.current.style.transform = 'scale(1)'
    }}>
    <div ref={area} className="absolute inset-0 transition-transform duration-200 motion-reduce:transition-none">
      <Image src={imagem} alt={alt} fill sizes="(max-width: 1023px) calc(100vw - 32px), (max-width: 1375px) 54vw, 700px"
        loading={primeira ? 'eager' : 'lazy'} fetchPriority={primeira ? 'high' : 'auto'} draggable={false} className="object-cover" />
      {original && <Image src={imagem} alt="" aria-hidden="true" fill sizes="1600px" quality={85} loading="eager" draggable={false}
        onLoad={() => setOriginalCarregada(true)} className={`object-cover ${originalCarregada ? 'opacity-100' : 'opacity-0'}`} />}
    </div>
    {material && <span className="absolute left-3 top-3 max-w-[calc(100%-24px)] truncate bg-luxury-black/90 text-luxury-gold-light border border-luxury-gold/30 px-3 py-2 text-[10px] font-bold uppercase pointer-events-none group-data-[zoom=true]:opacity-0 transition-opacity">{material}</span>}
  </div>
}

export default function ZoomImagem({ src, alt, material, fotos }: Props) {
  const imagens = fotos?.length ? fotos : [src]
  const trilho = useRef<HTMLDivElement>(null)
  const indice = useRef(0)
  const largura = useRef(0)
  const [ativa, setAtiva] = useState(0)
  useEffect(() => {
    const el = trilho.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      largura.current = el.clientWidth
      el.scrollTo({ left: indice.current * el.clientWidth, behavior: 'instant' })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  function ir(index: number) {
    const el = trilho.current
    if (!el) return
    el.scrollTo({ left: Math.max(0, Math.min(imagens.length - 1, index)) * el.clientWidth,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  return <section aria-label="Galeria do produto" className="min-w-0">
    <div className="relative">
      <div ref={trilho} className="flex w-full min-w-0 overflow-x-auto overscroll-x-contain snap-x snap-mandatory border border-luxury-line scrollbar-hide [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={event => {
          const el = event.currentTarget
          if (!el.clientWidth || largura.current !== el.clientWidth) return
          const proxima = Math.max(0, Math.min(imagens.length - 1, Math.round(el.scrollLeft / el.clientWidth)))
          if (indice.current !== proxima) { indice.current = proxima; setAtiva(proxima) }
        }}>
        {imagens.map((imagem, index) => <ImagemGaleria key={imagem + index} imagem={imagem} alt={`${alt} — imagem ${index + 1}`} primeira={index === 0} material={material} />)}
      </div>
      {imagens.length > 1 && <>
        <button type="button" aria-label="Imagem anterior" disabled={ativa === 0} onClick={() => ir(ativa - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 min-w-11 min-h-11 grid place-items-center bg-black/70 rounded-full border border-luxury-gold/20 text-luxury-gold-light disabled:opacity-40"><ChevronLeft /></button>
        <button type="button" aria-label="Próxima imagem" disabled={ativa === imagens.length - 1} onClick={() => ir(ativa + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 min-w-11 min-h-11 grid place-items-center bg-black/70 rounded-full border border-luxury-gold/20 text-luxury-gold-light disabled:opacity-40"><ChevronRight /></button>
      </>}
    </div>
    {imagens.length > 1 && <div className="mt-4 flex gap-3 overflow-x-auto scrollbar-hide" aria-label="Selecionar imagem">{imagens.map((imagem, index) => <button key={index} type="button" aria-label={`Mostrar imagem ${index + 1}`} aria-pressed={ativa === index} onClick={() => ir(index)} className={`relative h-16 w-14 shrink-0 overflow-hidden border transition-colors ${ativa === index ? 'border-hb-gold' : 'border-luxury-line opacity-60 hover:opacity-100'}`}><Image src={imagem} alt="" aria-hidden="true" fill sizes="56px" className="object-cover" /></button>)}</div>}
    {imagens.length > 1 && <p className="mt-2 text-xs text-gray-400">Deslize para ver mais imagens. {ativa + 1}/{imagens.length}</p>}
  </section>
}
