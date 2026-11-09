'use client'
export async function uploadImagem(file: File, tipo: 'produtos' | 'trocas' | 'aparencia', contexto?: {pedidoId:string;produtoId:string}) {
  const form = new FormData()
  form.set('arquivo', file)
  form.set('tipo', tipo)
  if(contexto){form.set('pedidoId',contexto.pedidoId);form.set('produtoId',contexto.produtoId)}
  const response = await fetch('/api/uploads', { method: 'POST', body: form })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Falha no envio da imagem.')
  return data.publicUrl as string
}
