import { Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowDown, ArrowRight, Gem, ShieldCheck, Truck } from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import ColecoesEditorais from '@/components/ColecoesEditorais'
import { getCupomPublico, getVitrine } from '@/lib/catalogo'
import hero from '@/public/images/hero-colar.webp'

export const revalidate = 60

async function BeneficioPublico() {
  const cupom = await getCupomPublico().catch(() => null)
  if (!cupom) return null
  return <div className="border-y border-luxury-gold/20 bg-luxury-surface px-4 py-4 text-center text-xs leading-7 text-luxury-muted">
    Um convite para a sua próxima escolha. Use <strong className="mx-1 border-b border-luxury-gold/50 font-medium tracking-wider text-luxury-gold-light">{cupom.codigo}</strong> e receba <span className="text-luxury-ivory">{cupom.desconto}% de desconto.</span>
  </div>
}

async function Vitrine() {
  const produtos = await getVitrine().catch(() => null)
  if (!produtos) return <p className="border border-luxury-line p-8 text-sm text-luxury-muted">Não foi possível carregar a seleção agora. <Link href="/produtos" className="luxury-link">Abrir catálogo <ArrowRight size={15} /></Link></p>
  if (!produtos.length) return <div className="border border-luxury-line px-6 py-16 text-center"><p className="font-serif text-2xl text-luxury-ivory">Novas escolhas estão a caminho.</p><Link href="/colecoes" className="luxury-link mt-4">Explore nossas coleções <ArrowRight size={15} /></Link></div>
  return <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-14 lg:grid-cols-4 lg:gap-x-8">
    {produtos.map(produto => <ProductCard key={produto.id} produto={produto} />)}
  </div>
}

function VitrineSkeleton() {
  return <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4" aria-label="Carregando seleção" role="status">
    {[0, 1, 2, 3].map(id => <div key={id}><div className="aspect-[4/5] border border-luxury-line bg-luxury-surface" /><div className="my-5 h-5 w-3/4 bg-luxury-surface" /><div className="h-12 bg-luxury-surface" /></div>)}
  </div>
}

export default function Home() {
  return <main className="min-w-0 bg-luxury-black">
    <section className="relative isolate overflow-hidden border-b border-luxury-line" aria-labelledby="hero-title">
      <div className="luxury-container relative grid min-h-[620px] items-center lg:min-h-[680px] lg:grid-cols-2 lg:gap-12 xl:gap-20">
        <div className="relative z-10 max-w-xl py-20 lg:py-24">
          <p className="eyebrow mb-7 flex items-center gap-3"><span className="h-px w-8 bg-luxury-gold/70" /> A seleção H&H</p>
          <h1 id="hero-title" className="font-serif text-[clamp(3rem,8.5vw,5.75rem)] font-normal leading-[1.06] tracking-[-0.045em] text-luxury-ivory">O detalhe<br />que <span className="italic text-luxury-gold-light">muda tudo.</span></h1>
          <p className="mb-8 mt-6 max-w-[290px] text-sm leading-7 text-[#d0cbc2] sm:max-w-sm lg:mt-7 lg:text-base">Peças que acompanham a sua história.<br className="hidden sm:block" /> Escolha o brilho que tem a ver com você.</p>
          <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
            <Link href="/produtos" className="luxury-button gap-5 px-6">Encontre a sua peça <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" /></Link>
            <Link href="/colecoes" className="luxury-link">Ver coleções</Link>
          </div>
          <a href="#destaques" className="mt-14 inline-flex min-h-11 items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-luxury-muted lg:mt-16"><ArrowDown size={14} strokeWidth={1.5} aria-hidden="true" /> Descubra a seleção</a>
        </div>
        <div className="absolute -right-4 inset-y-0 -left-4 -z-10 sm:-inset-x-6 lg:relative lg:inset-auto lg:z-0 lg:my-8 lg:aspect-[4/5] lg:max-h-[610px] lg:self-stretch">
          <Image src={hero} alt="Colar dourado com pedra verde em um estudo de luz e sombra" fill preload quality={85} sizes="(max-width: 1023px) 100vw, (max-width: 1536px) 48vw, 610px" placeholder="blur" className="object-cover object-[60%_45%] lg:object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/15 lg:hidden" />
          <div className="absolute inset-0 bg-gradient-to-t from-luxury-black/70 via-transparent to-transparent lg:from-black/40" />
          <p className="absolute bottom-7 right-6 hidden text-[9px] uppercase tracking-[0.2em] text-white/80 lg:block">H&H IMPORTS — Detalhes que ficam</p>
          <span className="pointer-events-none absolute inset-3 hidden border border-white/20 lg:block" aria-hidden="true" />
        </div>
      </div>
    </section>

    <div className="luxury-container grid grid-cols-1 gap-0 divide-y divide-luxury-line py-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:py-6">
      {[
        { Icon: Truck, titulo: 'Do nosso cuidado até você', texto: 'Frete calculado para o seu endereço.' },
        { Icon: ShieldCheck, titulo: 'Compre com tranquilidade', texto: 'Pagamento processado pelo Mercado Pago.' },
        { Icon: Gem, titulo: 'Escolhas com personalidade', texto: 'Detalhes para acompanhar seus momentos.' },
      ].map(({ Icon, titulo, texto }) => <div key={titulo} className="flex items-center gap-4 px-3 py-4 sm:justify-center sm:px-5"><Icon size={22} strokeWidth={1.2} className="shrink-0 text-luxury-gold" aria-hidden="true" /><div><p className="text-[11px] font-medium leading-5 text-luxury-ivory">{titulo}</p><p className="mt-0.5 text-[11px] leading-5 text-luxury-muted">{texto}</p></div></div>)}
    </div>

    <Suspense fallback={null}><BeneficioPublico /></Suspense>

    <section id="destaques" className="luxury-container py-16 sm:py-24 lg:py-28" aria-labelledby="vitrine-title">
      <div className="mb-9 flex flex-wrap items-end justify-between gap-6 sm:mb-12">
        <div><p className="eyebrow mb-3">Peças para chamar de suas</p><h2 id="vitrine-title" className="luxury-title">Um encontro com o seu <span className="italic text-luxury-gold-light">estilo.</span></h2></div>
        <Link href="/produtos" className="luxury-link shrink-0 border-b border-luxury-gold/40">Toda a seleção <ArrowRight size={16} strokeWidth={1.5} /></Link>
      </div>
      <Suspense fallback={<VitrineSkeleton />}><Vitrine /></Suspense>
    </section>

    <section id="lancamentos" className="border-y border-luxury-line bg-luxury-surface py-16 sm:py-24 lg:py-28" aria-labelledby="colecoes-title">
      <div className="luxury-container">
        <div className="mb-10 flex flex-col justify-between gap-5 sm:mb-14 sm:flex-row sm:items-end"><div><p className="eyebrow mb-3">Universo H&H</p><h2 id="colecoes-title" className="luxury-title">Cada detalhe.<br /><span className="italic text-luxury-gold-light">Uma possibilidade.</span></h2></div><p className="max-w-xs text-sm leading-7 text-luxury-muted">Do primeiro café a um momento inesquecível. Descubra a peça que vai com você.</p></div>
        <ColecoesEditorais />
      </div>
    </section>

    <section id="mais-vendidos" className="luxury-container grid items-center gap-10 py-16 sm:gap-16 sm:py-24 lg:grid-cols-2 lg:gap-24 lg:py-28">
      <div className="relative aspect-[5/4] overflow-hidden border border-luxury-line sm:aspect-square lg:aspect-[5/4]"><Image src="/images/editorial-dourado.webp" alt="Brincos dourados sobre pedra, iluminados pela luz natural" fill sizes="(max-width: 1023px) calc(100vw - 32px), 580px" className="object-cover object-[50%_60%]" /></div>
      <div><p className="eyebrow mb-5">Além do brilho</p><h2 className="luxury-title">Para usar hoje.<br /><span className="italic text-luxury-gold-light">Para lembrar sempre.</span></h2><p className="mb-6 mt-6 max-w-md text-sm leading-7 text-luxury-muted">Há peças que transformam um look. E outras que passam a fazer parte de quem somos. A H&H nasceu para estar nesses detalhes.</p><Link href="/sobre" className="luxury-link border-b border-luxury-gold/40">Conheça a H&H <ArrowRight size={16} strokeWidth={1.5} /></Link></div>
    </section>
  </main>
}
