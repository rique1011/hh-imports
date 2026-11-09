import { destinoInterno } from '@/lib/navegacao'

export interface AparenciaLoja {
  logoUrl: string
  bannerAtivo: boolean
  bannerModo: 'editorial' | 'imagem'
  bannerDesktop: string
  bannerMobile: string
  bannerAlt: string
  chamada: string
  titulo: string
  subtitulo: string
  botaoTexto: string
  botaoLink: string
}
export const APARENCIA_PADRAO: AparenciaLoja = {
  logoUrl: '', bannerAtivo: true, bannerModo: 'editorial',
  bannerDesktop: '/images/hero-colar.webp', bannerMobile: '',
  bannerAlt: 'Joia dourada da seleção H&H IMPORTS',
  chamada: 'Um cuidado a mais, por nossa conta',
  titulo: 'Seu próximo brilho. Frete grátis.',
  subtitulo: 'Em todo o Brasil, a partir de R$ 100 em produtos.',
  botaoTexto: 'Explore as joias', botaoLink: '/selecao/joias',
}

export function validarAparencia(valor: unknown, origemStorage: string): AparenciaLoja {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Configuração inválida.')
  const v = valor as Record<string, unknown>
  if (Object.keys(v).some(k => !Object.hasOwn(APARENCIA_PADRAO, k))) throw new Error('Campo de aparência não permitido.')
  const texto = (campo: keyof AparenciaLoja, max: number, obrigatorio = true) => {
    const t = v[campo]
    if (typeof t !== 'string' || t.length > max || /[\u0000-\u001f]/.test(t) || (obrigatorio && !t.trim())) throw new Error('Confira o campo ' + campo + '.')
    return t.trim()
  }
  const imagem = (campo: keyof AparenciaLoja, opcional = false) => {
    const t = texto(campo, 2048, !opcional)
    if (!t && opcional) return ''
    if (/^\/images\/[a-zA-Z0-9_-]+\.(?:webp|png|jpe?g)$/.test(t)) return t
    try {
      const u = new URL(t), origem = new URL(origemStorage)
      if (u.protocol === 'https:' && u.origin === origem.origin && !u.username && !u.password && !u.search && !u.hash
        && /^\/storage\/v1\/object\/public\/joias\/(?:aparencia|produtos)\/[a-zA-Z0-9_/-]+\.webp$/.test(u.pathname)) return u.href
    } catch { /* A validação também rejeita URLs relativas e esquemas executáveis. */ }
    throw new Error('Envie a imagem pelo painel usando JPEG, PNG ou WebP.')
  }
  if (typeof v.bannerAtivo !== 'boolean' || !['editorial', 'imagem'].includes(String(v.bannerModo))) throw new Error('Formato do banner inválido.')
  const link = texto('botaoLink', 500)
  if (destinoInterno(link, '') !== link) throw new Error('Use um link interno da loja, por exemplo /produtos.')
  return { logoUrl: imagem('logoUrl', true), bannerAtivo: v.bannerAtivo, bannerModo: v.bannerModo as AparenciaLoja['bannerModo'],
    bannerDesktop: imagem('bannerDesktop'), bannerMobile: imagem('bannerMobile', true), bannerAlt: texto('bannerAlt', 180),
    chamada: texto('chamada', 90, false), titulo: texto('titulo', 100), subtitulo: texto('subtitulo', 200, false),
    botaoTexto: texto('botaoTexto', 45), botaoLink: link }
}
