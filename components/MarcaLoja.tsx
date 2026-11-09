import Image from 'next/image'

export default function MarcaLoja({ url = '', rodape = false }: { url?: string; rodape?: boolean }) {
  if (url) return <span className={`relative block ${rodape ? 'h-16 w-40' : 'h-12 w-[116px] sm:h-14 sm:w-40'}`}>
    <Image src={url} alt="H&H IMPORTS" fill sizes="(max-width: 639px) 116px, 160px" className="object-contain" />
  </span>
  return <span><span className="block font-serif text-[28px] leading-none tracking-[-0.06em] text-luxury-gold-light sm:text-4xl">H&H</span><span className="mt-1.5 block text-[8px] font-medium tracking-[0.38em] text-luxury-ivory sm:text-[9px]">IMPORTS</span></span>
}
