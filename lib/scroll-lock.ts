'use client'

/** Mantém a posição da página ao abrir menus e modais, inclusive no iOS. */
export function travarRolagem() {
  const body = document.body
  const anterior = { overflow: body.style.overflow, position: body.style.position,
    top: body.style.top, width: body.style.width, paddingRight: body.style.paddingRight }
  const scroll = window.scrollY
  const scrollbar = window.innerWidth - document.documentElement.clientWidth
  if (scrollbar > 0) body.style.paddingRight = `calc(${getComputedStyle(body).paddingRight} + ${scrollbar}px)`
  body.style.overflow = 'hidden'
  body.style.position = 'fixed'
  body.style.top = `-${scroll}px`
  body.style.width = '100%'
  return () => {
    Object.assign(body.style, anterior)
    window.scrollTo(0, scroll)
  }
}
