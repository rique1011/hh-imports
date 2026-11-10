import { getImageProps } from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { AparenciaLoja } from '@/lib/aparencia'
import { imagemEditorial } from '@/lib/imagem-editorial'

function imagemCampanha(src: string, alt: string, width: number, height: number) {
  // A campanha padrão e o hero compartilham o mesmo arquivo otimizado no celular.
  if (src === '/images/hero-colar.webp') {
    const imagem = imagemEditorial('hero', { alt, sizes: '100vw' })
    return { avif: imagem.avif, props: { ...imagem.props, width, height } }
  }
  return { avif: undefined, props: getImageProps({ src, alt, width, height, sizes: '100vw', quality: 85 }).props }
}

export default function BannerCampanha({ config, prioritario = true }: { config: AparenciaLoja; prioritario?: boolean }) {
  if (!config.bannerAtivo) return null
  const desktop = imagemCampanha(config.bannerDesktop, config.bannerAlt, 1920, 480)
  const mobile = config.bannerMobile
    ? imagemCampanha(config.bannerMobile, config.bannerAlt, 750, 800) : desktop
  const imagem = <picture className={config.bannerModo === 'editorial' ? 'absolute inset-0' : 'block'}>
    {desktop.avif && <source media="(min-width: 768px)" type="image/avif" srcSet={desktop.avif} sizes="100vw" />}
    <source media="(min-width: 768px)" srcSet={desktop.props.srcSet} sizes="100vw" />
    {mobile.avif && <source type="image/avif" srcSet={mobile.avif} sizes="100vw" />}
    {/* Art direction oficial do Next: o navegador baixa somente a versão adequada. */}
    <img {...mobile.props} alt={config.bannerAlt} loading={prioritario ? 'eager' : 'lazy'} fetchPriority={prioritario ? 'high' : 'auto'}
      className={config.bannerModo === 'editorial' ? 'h-full w-full object-cover object-[65%_50%]' : `block h-auto w-full object-contain ${config.bannerMobile ? 'aspect-[15/16] md:aspect-[4/1]' : 'aspect-[4/1]'}`} />
  </picture>
  if (config.bannerModo === 'imagem') return <section aria-label="Campanha H&H" className="border-b border-luxury-line bg-luxury-black">
    <Link href={config.botaoLink} className="block focus-visible:outline-2 focus-visible:outline-luxury-gold">{imagem}<span className="sr-only">{config.botaoTexto}</span></Link>
  </section>
  return <section aria-label="Campanha H&H" className="relative isolate overflow-hidden border-b border-luxury-gold/25 bg-luxury-surface">
    {imagem}<div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/85 to-black/20" />
    <div className="luxury-container relative grid min-h-[300px] items-center py-10 sm:min-h-[280px] lg:min-h-[310px] lg:py-12">
      <div className="max-w-xl">
        {config.chamada && <p className="eyebrow mb-4">{config.chamada}</p>}
        <h2 className="max-w-lg font-serif text-[clamp(1.9rem,5.2vw,3.4rem)] leading-[1.1] tracking-tight text-luxury-ivory">{config.titulo}</h2>
        {config.subtitulo && <p className="mb-5 mt-4 max-w-md text-sm leading-6 text-luxury-ivory/85">{config.subtitulo}</p>}
        <Link href={config.botaoLink} className="luxury-link mt-2 gap-3 text-luxury-gold-light">{config.botaoTexto}<ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>
    </div>
  </section>
}
