export function getSiteUrl(path = '') {
  const configured = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : '')
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new Error('Configure SITE_URL com a URL HTTPS publica da loja.')
  }
  const base = new URL(configured || 'http://localhost:3000')
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new Error('SITE_URL invalida.')
  }
  if (process.env.NODE_ENV === 'production' &&
      (base.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(base.hostname))) {
    throw new Error('SITE_URL precisa ser publica e HTTPS em producao.')
  }
  return new URL(path || '/', base.origin).toString().replace(/\/$/, '')
}
