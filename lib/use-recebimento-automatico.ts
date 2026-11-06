'use client'
import { useEffect } from 'react'

// A página mostra os pedidos primeiro; a consulta à transportadora roda em paralelo.
export function useRecebimentoAutomatico(ativo: boolean, aoAtualizar: () => Promise<void>) {
  useEffect(() => {
    if (!ativo) return
    const controller = new AbortController()
    let consultando = false, ultimaConsulta = 0
    const atualizar = async () => {
      if (document.hidden || consultando || Date.now() - ultimaConsulta < 60_000) return
      consultando = true
      ultimaConsulta = Date.now()
      try {
        const response = await fetch('/api/pedidos/sincronizar-entregas', { method: 'POST', signal: controller.signal })
        if (response.ok && (await response.json()).entregues > 0 && !controller.signal.aborted) await aoAtualizar()
      } catch { /* Os dados existentes continuam visíveis; o cron retoma falhas. */ }
      finally { consultando = false }
    }
    void atualizar()
    const timer = window.setInterval(atualizar, 15 * 60_000)
    window.addEventListener('focus', atualizar)
    document.addEventListener('visibilitychange', atualizar)
    return () => {
      controller.abort()
      clearInterval(timer)
      window.removeEventListener('focus', atualizar)
      document.removeEventListener('visibilitychange', atualizar)
    }
  }, [ativo, aoAtualizar])
}
