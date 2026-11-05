# H&H IMPORTS — Direção de arte, implementação e performance

## Direção aplicada

Preto profundo `#0A0A0A`, superfícies `#111111`, dourado champagne `#C5A059`, reflexos `#E8D5AD` e texto marfim `#F3EFE7`. Playfair Display em títulos e Inter em textos/controles, servidas pelo Next com `display: swap`. Composição editorial assimétrica, fotografias amplas, filetes discretos, espaçamento generoso e efeitos breves de CSS.

Os aliases `hb-*` foram preservados para que checkout, conta, pedidos e admin continuem compatíveis. Mercado Pago, Melhor Envio, credenciais SMTP e regras de pedidos não foram trocados.

## Auditoria e correções

| Antes | Implementação |
| --- | --- |
| Home aguardava catálogo e consulta administrativa de cupons antes de renderizar o banner | Banner síncrono no servidor; vitrines e benefício público em `Suspense` |
| `revalidate = 0` na home | ISR/cache de 60 segundos apenas para a vitrine pública; invalidação imediata após alterações de produtos/cupons pelo admin |
| Três implementações de cards e repetição de produtos quando o catálogo era pequeno | `ProductCard` compartilhado, com uma seleção sem repetição |
| Busca carregada no navegador, com Supabase e efeito que ficava pendente sem termo | Busca no servidor, formulário GET acessível e estado inicial utilizável |
| Tokens e famílias de fonte sobrepostos por `!important` | Tema único, conectado ao Tailwind 4 com `@config` |
| Imagem remota no banner e originais grandes ao ampliar | Fotos editoriais locais em WebP; zoom de alta resolução otimizado, solicitado apenas ao usar o mouse |
| Compra disponível somente na página do produto | Compra rápida nos cards, respeitando estoque e unidades reservadas |
| Atalhos principais longe do polegar | Bottom navigation mobile, barra de compra na peça e finalização da sacola junto ao polegar |
| Animação podia alterar o referencial do CTA fixo | Transição de página usa opacidade, sem `transform` em ancestrais da barra fixa |
| Chamada a `/api/visitas`, rota inexistente | Chamada removida da página do produto |
| Ícones sociais com destino `#` | Rodapé usa links reais de atendimento, telefone, privacidade e termos |

### Limites do cache

A vitrine pode apresentar preço/disponibilidade por até 60 segundos, sujeitos à revalidação. O checkout continua validando os dados atuais no servidor. Página de produto e catálogo completo consultam os dados atuais; contas, pedidos, pagamentos, cotação de frete e informações privadas não entraram no cache público. O benefício exibido inclui apenas cupons ativos sem `usuario_id` e retorna somente código e percentual; a tabela de cupons continua privada.

## Checklist de performance da home

- [x] Manter `app/page.tsx` como Server Component, sem `use client`.
- [x] Renderizar o hero antes das consultas do banco. `Suspense` delimita somente as seções com dados.
- [x] Usar `next/image` com `fill`, `sizes` e proporções reservadas para evitar deslocamentos.
- [x] Reservar `preload` para a imagem principal. No Next.js 16, ele substitui o `priority` depreciado. Os cards abaixo da primeira dobra continuam lazy.
- [x] Usar imagem local no hero, eliminando dependência de conexão com Unsplash durante visitas. O arquivo de origem do banner tem aproximadamente 71 KiB antes da transformação do Next.
- [x] Habilitar negociação de AVIF/WebP e definir larguras/qualidades aceitas no otimizador.
- [x] Aplicar ISR e cache de 60 segundos ao conteúdo público e invalidar a vitrine após gravação de produtos/cupons pelo admin.
- [x] Manter rodapé e seções editoriais no servidor: não enviam um pacote de JavaScript para renderizar textos e links. `content-visibility` adia a pintura do rodapé em navegadores compatíveis.
- [x] Isolar o Toaster com `next/dynamic`; avaliações já usam importação dinâmica acionada pela proximidade da tela. Não adicionar Framer Motion ou outro pacote apenas para animações simples.
- [x] Enviar peças relacionadas por `Suspense` no servidor, com imagens lazy. Um `dynamic` em um Server Component não produz, por si só, o benefício de divisão de código de um componente cliente.
- [x] Respeitar `prefers-reduced-motion`, teclado, foco visível e áreas de toque de pelo menos 44–48 px.
- [ ] Após a publicação, medir LCP, INP e CLS em dispositivos/rede reais, inclusive primeira visita e cache frio.
- [ ] Acompanhar o percentil 75 em produção. Tratar “menos de 1 segundo” como meta de primeira apresentação em condições definidas, não como garantia para toda rede, aparelho ou página completa.
- [ ] Padronizar fotos de produtos adicionadas pelo admin: resolução suficiente, boa composição e arquivos de origem leves. `next/image` não corrige uma fotografia de baixa qualidade.

### Trechos fundamentais de `app/page.tsx`

```tsx
export const revalidate = 60

// O componente pai não aguarda consultas antes de emitir o hero.
export default function Home() {
  return <main>
    {/* Hero síncrono com imagem local, espaço reservado e preload. */}
    <Suspense fallback={<VitrineSkeleton />}><Vitrine /></Suspense>
  </main>
}
```

```tsx
<Image
  src={hero}
  alt="Colar dourado com pedra verde em um estudo de luz e sombra"
  fill
  preload
  quality={85}
  sizes="(max-width: 1023px) 100vw, (max-width: 1536px) 48vw, 610px"
  placeholder="blur"
  className="object-cover"
/>
```

Não é necessário migrar a aplicação inteira para `cacheComponents` para esta mudança. Foi mantido o modelo de cache compatível com a configuração instalada, usando `unstable_cache` de forma explícita e limitada ao catálogo público.

## Fotografias editoriais

Fotografias ilustrativas obtidas do Unsplash e convertidas localmente para WebP. Não representam automaticamente produtos disponíveis; os cards usam as fotografias cadastradas no Supabase.

- Hero e coleção de colares: https://images.unsplash.com/photo-1599643477877-530eb83abc8e.
- Pulseiras: https://images.unsplash.com/photo-1611591437281-460bfbe1220a.
- Brincos: https://images.unsplash.com/photo-1535632066927-ab7c9ab60908.
- Editorial dourado: https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0.

## Referências técnicas

- [Next Image](https://nextjs.org/docs/app/api-reference/components/image)
- [Fontes do Next](https://nextjs.org/docs/app/getting-started/fonts)
- [Lazy loading](https://nextjs.org/docs/app/guides/lazy-loading)
- [Tailwind 4: `@config`](https://tailwindcss.com/docs/functions-and-directives#config)
- [Revalidação por tags](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)


## Validação executada

- Build de produção Next.js 16.2.4 concluído, incluindo TypeScript. A home foi pré-renderizada com revalidação de 1 minuto.
- ESLint e `tsc --noEmit` sem erros.
- 53 testes existentes de estoque, checkout, segurança, notificações e Melhor Envio passaram; 3 novos testes de invalidação da vitrine passaram (56 no total).
- 277 verificações de interface/fluxo em 320, 390, 412, 768, 1024 e 1440 px: navegação, menu/foco/Escape, busca, filtros, favoritos, compra rápida, estoque reservado, persistência, galeria, CEP, seleção de frete, total e liberação do checkout. Sem erros JavaScript ou respostas HTTP de erro.
- Os testes visuais usaram catálogo isolado e respostas simuladas de frete. Não criaram pedidos reais, compraram etiquetas ou enviaram e-mails. iPhone 14 e Pixel 7 foram perfis de emulação Chromium; isso não equivale a executar Safari e Android físicos.

### Medição de laboratório

Build de produção local, catálogo isolado, emulação de iPhone 14, CPU 4× mais lenta, rede de 10 Mbit/s e latência adicional de 40 ms. Três visitas com contexto novo por visita: LCP de 1.80–2.08 s, mediana 2.03 s; CLS igual a zero. Esses números não são métricas de visitantes nem comprovam carga abaixo de 1 segundo em produção. Não foi feita uma comparação antes/depois sob condições equivalentes.

## Código completo dos arquivos solicitados

Os blocos abaixo são os arquivos efetivamente usados pela aplicação. Os imports apontam para os componentes e tipos do próprio repositório.

### `tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss'

const config = {
  theme: {
    extend: {
      colors: {
        luxury: {
          black: '#0A0A0A', surface: '#111111', raised: '#191816',
          ivory: '#F3EFE7', muted: '#ABA69D', line: '#2C2923',
          gold: { DEFAULT: '#C5A059', light: '#E8D5AD', dark: '#93703B' },
        },
        // Preserva as telas de checkout, conta e admin existentes.
        'hb-black': '#0A0A0A', 'hb-gray': '#111111',
        'hb-gold': '#C5A059', 'hb-goldLight': '#E8D5AD', 'hb-goldDark': '#93703B',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Arial', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
      boxShadow: { gold: '0 8px 32px -16px rgb(197 160 89 / 40%)' },
      backgroundImage: { 'gold-metal': 'linear-gradient(115deg, #B38A48 0%, #E8D5AD 48%, #C5A059 100%)' },
      keyframes: {
        'page-enter': { from: { opacity: '0.92' }, to: { opacity: '1' } },
        'gold-sheen': { from: { transform: 'translateX(-150%) skewX(-18deg)' }, to: { transform: 'translateX(250%) skewX(-18deg)' } },
        'cart-pop': { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.12)' } },
      },
      animation: {
        'page-enter': 'page-enter 180ms ease-out',
        'gold-sheen': 'gold-sheen 650ms ease-out',
        'cart-pop': 'cart-pop 260ms ease-out',
      },
    },
  },
} satisfies Config

export default config
```

### `app/globals.css`

```css
@import "tailwindcss";

@config "../tailwind.config.ts";
@theme inline {
  --font-sans: var(--font-inter), sans-serif;
  --font-serif: var(--font-playfair), serif;


}

@layer base {
  html { color-scheme: dark; background: #0a0a0a; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; scroll-padding-top: calc(7rem + env(safe-area-inset-top, 0px)); scrollbar-color: #625139 #111; scrollbar-width: thin; }
  body { margin: 0; min-width: 0; background: #0a0a0a; color: #f3efe7; font-family: var(--font-inter), Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; padding-inline: env(safe-area-inset-left, 0px) env(safe-area-inset-right, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
  h1, h2, h3, h4, h5, h6 { font-family: var(--font-playfair), Georgia, serif; text-wrap: balance; }
  button, a, input, select, textarea { -webkit-tap-highlight-color: transparent; }
  button:not(:disabled), summary { cursor: pointer; }
  button:disabled { cursor: not-allowed; }
  :focus-visible { outline: 2px solid #e8d5ad; outline-offset: 5px; }
  ::selection { background: #c5a059; color: #0a0a0a; }
}

.site-header {
  padding-top: env(safe-area-inset-top, 0px);
}

/* O painel acompanha a área visível inclusive quando o teclado abre. */
.modal-overlay {
  position: fixed;
  inset: 0;
  bottom: auto;
  z-index: 80;
  height: var(--modal-viewport-height, 100dvh);
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 1rem;
  padding-top: max(1rem, env(safe-area-inset-top, 0px));
  padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
  padding-left: max(1rem, env(safe-area-inset-left, 0px));
  padding-right: max(1rem, env(safe-area-inset-right, 0px));
  background: rgb(0 0 0 / 80%);
}

.modal-panel {
  min-width: 0;
  width: 100%;
  max-height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  overflow-wrap: anywhere;
}

.price-range {
  width: 100%;
  height: 44px;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  cursor: pointer;
}

.price-range::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 4px;
  background: #374151;
}

.price-range::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 24px;
  height: 24px;
  margin-top: -10px;
  border-radius: 50%;
  background: #c5a059;
}

.price-range::-moz-range-track {
  height: 4px;
  border-radius: 4px;
  background: #374151;
}

.price-range::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 50%;
  background: #c5a059;
}

@media (max-width: 1023px), (pointer: coarse) {
  input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='hidden']):not([type='color']),
  select,
  textarea {
    min-width: 0;
    max-width: 100%;
    min-height: 44px;
    font-size: max(16px, 1rem);
  }
}

@media (max-width: 1023px) {
  body:has(.product-page), body:has(.cart-page) {
    padding-bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px));
  }

  /* O botão não deve cobrir o campo em edição acima do teclado. */
  .product-page:has(input:focus, textarea:focus, select:focus, .shipping-calculator:focus-within) .mobile-purchase-bar {
    visibility: hidden;
    pointer-events: none;
  }
}

@layer components {
  .luxury-container { width: min(100% - 2rem, 80rem); margin-inline: auto; }
  .eyebrow { font-family: var(--font-inter), sans-serif; font-size: 0.625rem; font-weight: 500; letter-spacing: 0.22em; line-height: 1.8; text-transform: uppercase; color: #c5a059; }
  .luxury-title { font-size: clamp(2rem, 4.5vw, 3.75rem); font-weight: 400; letter-spacing: -0.035em; line-height: 1.15; }
  .luxury-link { display: inline-flex; align-items: center; gap: 0.75rem; min-height: 44px; font-size: 0.6875rem; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: #e8d5ad; }
  .luxury-link:hover { color: #f3efe7; }
  .luxury-button { position: relative; isolation: isolate; display: inline-flex; align-items: center; justify-content: center; gap: 0.625rem; min-height: 48px; padding: 0.875rem 1.25rem; overflow: hidden; border: 1px solid #c5a059; background: #c5a059; color: #0a0a0a; font-family: var(--font-inter), sans-serif; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.1em; line-height: 1.4; text-transform: uppercase; transition: background-color 180ms, color 180ms, box-shadow 180ms, border-color 180ms; }
  .luxury-button::after { content: ''; position: absolute; inset: 0; z-index: -1; width: 45%; background: linear-gradient(90deg, transparent, #fff6, transparent); transform: translateX(-150%) skewX(-18deg); pointer-events: none; }
  .luxury-button:disabled { opacity: 0.6; }
  .luxury-button[data-added='true'] { background: #e8d5ad; border-color: #e8d5ad; }
  .luxury-button-outline { background: transparent; color: #e8d5ad; border-color: #625139; }
  .gold-rule { height: 1px; background: linear-gradient(90deg, transparent, #c5a05980, transparent); }
  .mobile-bottom-nav { padding-bottom: env(safe-area-inset-bottom, 0px); }
  .skip-link { position: fixed; top: 0.5rem; left: 1rem; z-index: 100; padding: 0.75rem 1rem; background: #e8d5ad; color: #0a0a0a; transform: translateY(-200%); }
  .skip-link:focus { transform: translateY(0); }
}

@media (hover: hover) and (pointer: fine) {
  .luxury-button:not(:disabled):hover { background: #e8d5ad; border-color: #e8d5ad; box-shadow: 0 8px 32px -16px #c5a05980; }
  .luxury-button:not(:disabled):hover::after { animation: gold-sheen 650ms ease-out; }
  .luxury-button-outline:not(:disabled):hover { background: #c5a059; color: #0a0a0a; }
}
@media (min-width: 640px) { .luxury-container { width: min(100% - 3rem, 80rem); } }
@media (min-width: 1024px) { .luxury-container { width: min(100% - 6rem, 80rem); } }

/* A revelação é progressiva: o conteúdo nunca depende de JS para aparecer. */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .product-reveal { animation: product-reveal linear both; animation-timeline: view(); animation-range: entry 0% entry 70%; }
    @keyframes product-reveal { from { transform: translateY(14px); } to { transform: translateY(0); } }
  }
}
@utility text-gold-metal { background: linear-gradient(115deg, #b38a48, #e8d5ad 48%, #c5a059); background-clip: text; -webkit-background-clip: text; color: transparent; }
@utility scrollbar-hide { scrollbar-width: none; &::-webkit-scrollbar { display: none; } }
@utility gold-glow { box-shadow: 0 8px 32px -16px rgb(197 160 89 / 40%); }
@utility render-later { content-visibility: auto; contain-intrinsic-size: auto 600px; }

@media (max-width: 1023px) {
  body:has(.mobile-bottom-nav) { padding-bottom: calc(4.25rem + env(safe-area-inset-bottom, 0px)); }
  body:has(input:focus, textarea:focus, select:focus) :is(.mobile-bottom-nav, .mobile-checkout-bar),
  body:has(.cart-page form:focus-within) .mobile-checkout-bar { visibility: hidden; pointer-events: none; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
```

### `components/ProductCard.tsx`

```tsx
import Image from 'next/image'
import Link from 'next/link'
import type { Produto } from '@/types/loja'
import BuyButton from '@/components/BuyButton'
import BotaoFavorito from '@/components/BotaoFavorito'
import { formatarPreco } from '@/lib/formatacao'

export type ProdutoCard = Pick<Produto, 'id' | 'nome' | 'slug' | 'preco' | 'fotos' | 'material' | 'estoque' | 'estoque_reservado'>

// Só os botões de compra e favoritos precisam de hidratação nas páginas do servidor.
export default function ProductCard({ produto, sizes = '(max-width: 639px) calc(50vw - 24px), (max-width: 1023px) calc(50vw - 36px), (max-width: 1375px) calc(25vw - 42px), 296px', eager = false }: {
  produto: ProdutoCard; sizes?: string; eager?: boolean
}) {
  const href = `/produto/${produto.slug}`
  return <article className="product-reveal group min-w-0" aria-label={produto.nome}>
    <div className="relative isolate overflow-hidden border border-luxury-line bg-luxury-surface transition-colors duration-300 hover:border-luxury-gold/40">
      <Link href={href} className="relative block aspect-[4/5] overflow-hidden" aria-label={`Ver ${produto.nome}`}>
        {produto.fotos?.[0] ? <Image src={produto.fotos[0]} alt={produto.nome} fill sizes={sizes} loading={eager ? 'eager' : 'lazy'} quality={75}
          className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.045]" />
          : <div className="flex h-full items-center justify-center p-4 text-center text-xs text-luxury-muted">Imagem em breve</div>}
      </Link>
      <div className="absolute right-2 top-2 sm:right-3 sm:top-3"><BotaoFavorito produto={produto} /></div>
    </div>
    <div className="pt-4 sm:pt-5">
      <p className="mb-1 min-h-4 truncate font-sans text-[9px] uppercase tracking-[0.16em] text-luxury-muted sm:text-[10px]">{produto.material || 'Seleção H&H'}</p>
      <Link href={href} className="block h-11 sm:h-14"><h3 className="line-clamp-2 break-words text-base font-normal leading-snug text-luxury-ivory transition-colors group-hover:text-luxury-gold-light sm:text-xl">{produto.nome}</h3></Link>
      <p className="mb-4 mt-2 text-sm font-medium tabular-nums text-luxury-gold-light sm:text-base">{formatarPreco(produto.preco)}</p>
      {produto.estoque !== undefined ? <BuyButton produto={produto} compact /> : <Link href={href} className="luxury-button luxury-button-outline w-full">Conhecer a peça</Link>}
    </div>
  </article>
}
```

### `components/BuyButton.tsx`

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ShoppingBag } from 'lucide-react'
import { useCart } from '@/lib/store'
import { useHidratado } from '@/lib/use-hidratado'

export interface ProdutoCompra {
  id: string
  nome: string
  preco: number
  fotos?: string[] | null
  estoque?: number | null
  estoque_reservado?: number
  slug?: string
}

export default function BuyButton({ produto, compact = false }: { produto: ProdutoCompra; compact?: boolean }) {
  const adicionar = useCart(state => state.adicionarAoCarrinho)
  const quantidade = useCart(state => state.itens.find(item => item.id === produto.id)?.quantidade || 0)
  const hidratado = useHidratado()
  const [adicionado, setAdicionado] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const disponivel = Math.max(0, Number(produto.estoque || 0) - Number(produto.estoque_reservado || 0))
  const esgotado = !disponivel || (hidratado && quantidade >= disponivel)

  function comprar() {
    if (!hidratado || esgotado || adicionado) return
    adicionar({ id: produto.id, nome: produto.nome, preco: Number(produto.preco), foto: produto.fotos?.[0] || '', slug: produto.slug, quantidade: 1 })
    setAdicionado(true)
    timer.current = setTimeout(() => setAdicionado(false), 1800)
  }

  const texto = adicionado ? 'Adicionado' : esgotado ? disponivel ? 'Limite na sacola' : 'Indisponível' : compact ? 'Adicionar' : 'Adicionar à sacola'
  return <>
    <button type="button" onClick={comprar} disabled={!hidratado || esgotado || adicionado}
      aria-label={adicionado ? `${produto.nome} adicionado à sacola` : esgotado ? `${produto.nome}: ${texto}` : `Adicionar ${produto.nome} à sacola`}
      data-added={adicionado} className={`luxury-button w-full ${compact ? 'px-2 text-[10px] sm:text-[11px]' : ''}`}>
      {adicionado ? <Check size={16} strokeWidth={1.5} className="shrink-0 motion-safe:animate-cart-pop" aria-hidden="true" /> : <ShoppingBag size={16} strokeWidth={1.5} className="shrink-0" aria-hidden="true" />}
      <span>{texto}</span>
    </button>
    <span className="sr-only" role="status" aria-live="polite">{adicionado ? `${produto.nome} adicionado à sacola.` : ''}</span>
  </>
}
```

### `components/BotaoAdicionar.tsx`

```tsx
import BuyButton, { type ProdutoCompra } from '@/components/BuyButton'
import { formatarPreco } from '@/lib/formatacao'

export default function BotaoAdicionar({ produto }: { produto: ProdutoCompra }) {
  const disponivel = Math.max(0, Number(produto.estoque || 0) - Number(produto.estoque_reservado || 0))
  return <>
    <div className="hidden lg:block"><BuyButton produto={produto} /></div>
    <p className="mt-3 text-xs leading-relaxed text-luxury-muted">{disponivel ? 'Disponível. Escolha o frete para o seu endereço abaixo.' : 'Produto indisponível no momento.'}</p>
    <div className="mobile-purchase-bar fixed inset-x-0 bottom-0 z-40 border-t border-luxury-gold/25 bg-luxury-black pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] pt-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <div className="shrink-0"><p className="mb-1 text-[9px] uppercase tracking-[0.16em] text-luxury-muted">Sua escolha</p><span className="text-base font-medium tabular-nums text-luxury-gold-light">{formatarPreco(produto.preco)}</span></div>
        <div className="min-w-0 flex-1"><BuyButton produto={produto} /></div>
      </div>
    </div>
  </>
}
```

### `app/page.tsx`

```tsx
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
```
