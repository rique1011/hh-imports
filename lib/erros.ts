export function mensagemErro(error: unknown, padrao = 'Não foi possível concluir a operação.') {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message || padrao
  }
  return padrao
}
