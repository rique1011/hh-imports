'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props { src: string; alt: string; material?: string | null; fotos?: string[] }

function ImagemGaleria({ imagem, alt, primeira, material, renderizar }: { imagem: string; alt: string; primeira: boolean; material?: string | null; renderizar: boolean }) {
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

  if (!renderizar) return <div aria-hidden="true" className="aspect-[4/5] w-full flex-none snap-center bg-luxury-surface" />

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
  const miniaturas = useRef<HTMLDivElement>(null)
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
  useEffect(() => {
    const el = miniaturas.current
    const botao = el?.children[ativa] as HTMLElement | undefined
    if (el && botao) el.scrollTo({ left: botao.offsetLeft - (el.clientWidth - botao.offsetWidth) / 2,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [ativa])

  function ir(index: number) {
    const el = trilho.current
    if (!el) return
    el.scrollTo({ left: Math.max(0, Math.min(imagens.length - 1, index)) * el.clientWidth,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  function navegarTeclado(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const destinos: Record<string, number> = { ArrowLeft: ativa - 1, ArrowRight: ativa + 1, Home: 0, End: imagens.length - 1 }
    if (event.key in destinos) { event.preventDefault(); ir(destinos[event.key]) }
  }

  return <section role="region" aria-roledescription="carrossel" aria-label="Galeria do produto" className="min-w-0">
    <div className="relative overflow-hidden border border-luxury-line">
      <div ref={trilho} tabIndex={imagens.length > 1 ? 0 : -1} aria-label={`Fotos de ${alt}. Use as setas do teclado ou deslize para navegar.`}
        onKeyDown={navegarTeclado}
        className="flex w-full min-w-0 snap-x snap-mandatory overflow-x-auto overscroll-x-contain scrollbar-hide [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-hb-gold"
        onScroll={event => {
          const el = event.currentTarget
          if (!el.clientWidth || largura.current !== el.clientWidth) return
          const proxima = Math.max(0, Math.min(imagens.length - 1, Math.round(el.scrollLeft / el.clientWidth)))
          if (indice.current !== proxima) { indice.current = proxima; setAtiva(proxima) }
        }}>
        {imagens.map((imagem, index) => <ImagemGaleria key={imagem + index} imagem={imagem}
          alt={`${alt} — foto ${index + 1} de ${imagens.length}`} primeira={index === 0} material={material}
          renderizar={index === 0 || Math.abs(index - ativa) <= 1} />)}
      </div>
      {imagens.length > 1 && <>
        <button type="button" aria-label="Imagem anterior" disabled={ativa === 0} onClick={() => ir(ativa - 1)}
          className="absolute left-3 top-1/2 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center rounded-full border border-luxury-gold/30 bg-black/75 text-luxury-gold-light backdrop-blur-sm transition hover:bg-black disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-hb-gold"><ChevronLeft size={22} /></button>
        <button type="button" aria-label="Próxima imagem" disabled={ativa === imagens.length - 1} onClick={() => ir(ativa + 1)}
          className="absolute right-3 top-1/2 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center rounded-full border border-luxury-gold/30 bg-black/75 text-luxury-gold-light backdrop-blur-sm transition hover:bg-black disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-hb-gold"><ChevronRight size={22} /></button>
        <span aria-hidden="true" className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-luxury-gold/20 bg-black/80 px-3 py-1.5 text-[11px] tabular-nums text-luxury-gold-light">{ativa + 1} / {imagens.length}</span>
      </>}
    </div>
    {imagens.length > 1 && <>
      <div ref={miniaturas} className="relative mt-4 flex gap-2 overflow-x-auto overscroll-x-contain py-1 scrollbar-hide [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Selecionar foto">
        {imagens.map((imagem, index) => <button key={imagem + index} type="button" aria-label={`Mostrar imagem ${index + 1}`}
          aria-pressed={ativa === index} onClick={() => ir(index)}
          className={`relative h-20 w-16 shrink-0 overflow-hidden border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hb-gold ${ativa === index ? 'border-hb-gold' : 'border-luxury-line opacity-55 hover:opacity-100'}`}>
          <Image src={imagem} alt="" aria-hidden="true" fill sizes="64px" className="object-cover" />
        </button>)}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-luxury-muted">
        <p><span className="lg:hidden">Deslize para ver todos os detalhes.</span><span className="hidden lg:inline">Explore a peça por todos os ângulos.</span></p>
        <p role="status" aria-live="polite" aria-atomic="true" className="tabular-nums">Foto {ativa + 1} de {imagens.length}</p>
      </div>
    </>}
  </section>
}
