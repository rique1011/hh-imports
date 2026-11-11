'use client'

import { useState } from 'react'
import { useHidratado } from '@/lib/use-hidratado'

export default function Template({ children }: { children: React.ReactNode }) {
  const hidratado = useHidratado()
  // Captura o tipo de montagem: HTML inicial visível, animação nas trocas internas.
  const [animar] = useState(hidratado)
  return <div className={animar ? 'motion-safe:animate-page-enter' : undefined}>{children}</div>
}
