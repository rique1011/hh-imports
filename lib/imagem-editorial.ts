import type { ImgHTMLAttributes } from 'react'
import imagens from '@/lib/imagens-editoriais.json'

export type FotoEditorial = keyof typeof imagens

export function imagemEditorial(nome: FotoEditorial, opcoes: { alt: string; sizes: string; fill?: boolean }) {
  const imagem = imagens[nome]
  const fallback = imagem.webp[imagem.webp.length - 1]
  return {
    avif: imagem.avif.map(foto => `${foto.src} ${foto.width}w`).join(', '),
    props: {
      alt: opcoes.alt, sizes: opcoes.sizes,
      src: fallback.src,
      srcSet: imagem.webp.map(foto => `${foto.src} ${foto.width}w`).join(', '),
      width: opcoes.fill ? undefined : imagem.width,
      height: opcoes.fill ? undefined : imagem.height,
      decoding: 'async',
      style: opcoes.fill ? { position: 'absolute', height: '100%', width: '100%', inset: 0 } : undefined,
    } satisfies ImgHTMLAttributes<HTMLImageElement>,
  }
}
