'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useHidratado } from '@/lib/use-hidratado'
import { travarRolagem } from '@/lib/scroll-lock'

interface Props {
  children: ReactNode
  onClose: () => void
  labelledBy: string
  className?: string
}

export default function Modal({ children, onClose, labelledBy, className = '' }: Props) {
  const hidratado = useHidratado()
  const overlayRef = useRef<HTMLDivElement>(null)
  const painelRef = useRef<HTMLDivElement>(null)
  const fecharRef = useRef(onClose)

  useEffect(() => { fecharRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!hidratado) return
    const focoAnterior = document.activeElement
    const restaurarRolagem = travarRolagem()

    const atualizarArea = () => {
      const viewport = window.visualViewport
      const overlay = overlayRef.current
      if (!overlay) return
      overlay.style.setProperty('--modal-viewport-height', `${viewport?.height || window.innerHeight}px`)
      overlay.style.top = `${viewport?.offsetTop || 0}px`
    }
    atualizarArea()
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', atualizarArea)
    viewport?.addEventListener('scroll', atualizarArea, { passive: true })
    window.addEventListener('resize', atualizarArea)

    const focaveis = () => Array.from(painelRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
    ) || []).filter(element => element.getClientRects().length > 0)
    const frame = requestAnimationFrame(() => (focaveis()[0] || painelRef.current)?.focus({ preventScroll: true }))
    const teclado = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); fecharRef.current(); return }
      if (event.key !== 'Tab') return
      const elementos = focaveis()
      const primeiro = elementos[0], ultimo = elementos[elementos.length - 1]
      if (!primeiro) { event.preventDefault(); return }
      if (event.shiftKey && document.activeElement === primeiro) { event.preventDefault(); ultimo.focus() }
      else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primeiro.focus() }
    }
    document.addEventListener('keydown', teclado)
    return () => {
      cancelAnimationFrame(frame)
      viewport?.removeEventListener('resize', atualizarArea)
      viewport?.removeEventListener('scroll', atualizarArea)
      window.removeEventListener('resize', atualizarArea)
      document.removeEventListener('keydown', teclado)
      restaurarRolagem()
      if (focoAnterior instanceof HTMLElement && focoAnterior.isConnected) focoAnterior.focus({ preventScroll: true })
    }
  }, [hidratado])

  if (!hidratado) return null
  return createPortal(
    <div ref={overlayRef} className="modal-overlay">
      <div ref={painelRef} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}
        className={`modal-panel ${className}`}>
        {children}
      </div>
    </div>, document.body
  )
}
