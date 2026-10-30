'use client'

import { useState, useRef } from 'react'

interface ZoomImagemProps {
  src: string
  alt: string
  material?: string
}

export default function ZoomImagem({ src, alt, material }: ZoomImagemProps) {
  const [posicao, setPosicao] = useState({ x: 50, y: 50 })
  const [zoomAtivo, setZoomAtivo] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const lidarComMovimentoMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return

    // Pega o tamanho e posição exata da caixa da imagem na tela
    const { left, top, width, height } = containerRef.current.getBoundingClientRect()
    
    // Calcula a porcentagem X e Y de onde o mouse está (0 a 100%)
    const x = ((e.clientX - left) / width) * 100
    const y = ((e.clientY - top) / height) * 100

    setPosicao({ x, y })
  }

  return (
    <div 
      ref={containerRef}
      className="bg-gray-50 rounded-2xl overflow-hidden aspect-square border flex items-center justify-center relative cursor-zoom-in group"
      onMouseEnter={() => setZoomAtivo(true)}
      onMouseLeave={() => setZoomAtivo(false)}
      onMouseMove={lidarComMovimentoMouse}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover transition-transform duration-200 ease-out shadow-inner"
        style={{
          // Se o zoom estiver ativo, ele dá um scale(2.5) focando no eixo X/Y do mouse
          transformOrigin: `${posicao.x}% ${posicao.y}%`,
          transform: zoomAtivo ? 'scale(2.5)' : 'scale(1)'
        }}
      />

      {/* Tag de Material - Oculta suavemente quando o zoom aproxima */}
      {material && (
        <div className={`absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full border border-gray-100 transition-opacity duration-300 pointer-events-none ${zoomAtivo ? 'opacity-0' : 'opacity-100'}`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-900">{material}</p>
        </div>
      )}
    </div>
  )
}
