export const MIN_SENHA_CLIENTE = 8
export const MIN_SENHA_ADMIN = 15
export const minimoSenha = (administrador: boolean) => administrador ? MIN_SENHA_ADMIN : MIN_SENHA_CLIENTE
