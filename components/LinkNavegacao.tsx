'use client'

import Link from 'next/link'
import { useState, type ComponentProps } from 'react'

// Evita consultar várias rotas no primeiro carregamento. Hover, foco ou toque
// antecipam a rota desejada; navegação e histórico continuam com o Next Link.
export default function LinkNavegacao({ onMouseEnter, onFocus, onTouchStart, prefetch, ...props }: ComponentProps<typeof Link>) {
  const [interesse, setInteresse] = useState(false)
  return <Link {...props} prefetch={interesse ? prefetch ?? null : false}
    onMouseEnter={event => { setInteresse(true); onMouseEnter?.(event) }}
    onFocus={event => { setInteresse(true); onFocus?.(event) }}
    onTouchStart={event => { setInteresse(true); onTouchStart?.(event) }} />
}
