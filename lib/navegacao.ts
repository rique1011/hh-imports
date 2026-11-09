const ORIGEM_INTERNA = 'https://hh.local'

// Nunca envia URLs externas, esquemas executáveis ou páginas de autenticação ao router.
export function destinoInterno(valor: unknown, padrao = '/') {
  if (typeof valor !== 'string' || !valor.startsWith('/') || valor.startsWith('//') || /[\\\u0000-\u0020]/.test(valor)) return padrao
  try {
    const url = new URL(valor, ORIGEM_INTERNA)
    const caminho = decodeURIComponent(url.pathname)
    if (url.origin !== ORIGEM_INTERNA || caminho.startsWith('//') || /[\\\u0000-\u0020]/.test(caminho)
      || /^\/(?:api|_next|login|cadastro|verificar|esqueci-senha|redefinir-senha)(?:\/|$)/i.test(caminho)) return padrao
    return url.pathname + url.search + url.hash
  } catch { return padrao }
}

export function linkComRetorno(caminho: string, retorno: unknown) {
  const url = new URL(caminho, ORIGEM_INTERNA)
  url.searchParams.set('retorno', destinoInterno(retorno))
  return url.pathname + url.search + url.hash
}

export function destinoAposLogin(user: { role?: string; senhaAtual?: boolean; mfa?: boolean } | undefined, retorno: unknown) {
  if (user?.role === 'admin' && (user.senhaAtual === false || !user.mfa)) return '/minha-conta?aba=seguranca'
  if (user?.senhaAtual === false) return linkComRetorno('/minha-conta?aba=dados', retorno)
  return destinoInterno(retorno)
}
