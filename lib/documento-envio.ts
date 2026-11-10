type DocumentoFiscal = 'nfe' | 'declaracao'

export function destinatarioCnpj(documento: string | null | undefined) {
  return (documento || '').replace(/\D/g, '').length === 14
}

// Esta é a preferência operacional da loja, não uma validação de dispensa
// fiscal. A declaração continua exigindo a confirmação do administrador.
export function documentoFiscalDoPedido(
  documento: string | null | undefined,
  preferencia: DocumentoFiscal,
  notaFiscal?: string | null,
): DocumentoFiscal {
  if (notaFiscal || (documento || '').replace(/\D/g, '').length !== 11) return 'nfe'
  return preferencia
}
