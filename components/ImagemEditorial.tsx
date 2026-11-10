import type { ImgHTMLAttributes } from 'react'
import { imagemEditorial, type FotoEditorial } from '@/lib/imagem-editorial'

export default function ImagemEditorial({ foto, alt, sizes, loading = 'lazy', fetchPriority = 'auto', className }: {
  foto: FotoEditorial; alt: string; sizes: string; loading?: 'eager' | 'lazy';
  fetchPriority?: ImgHTMLAttributes<HTMLImageElement>['fetchPriority']; className?: string;
}) {
  const imagem = imagemEditorial(foto, { alt, sizes, fill: true })
  return <>
    {loading === 'eager' && fetchPriority === 'high' && <link rel="preload" as="image" type="image/avif" imageSrcSet={imagem.avif} imageSizes={sizes} fetchPriority="high" />}
    <picture>
      <source type="image/avif" srcSet={imagem.avif} sizes={sizes} />
      <img {...imagem.props} alt={alt} loading={loading} fetchPriority={fetchPriority} className={className} />
    </picture>
  </>
}
