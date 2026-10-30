import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { exigirUsuario, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirUsuario(request)
    const form = await request.formData()
    const file = form.get('arquivo')
    const tipo = form.get('tipo')
    if (!(file instanceof File) || !['produtos','trocas'].includes(String(tipo))) throw new ErroHttp(400, 'Imagem inválida.')
    if (tipo === 'produtos' && !user.admin) throw new ErroHttp(403, 'Acesso restrito ao administrador.')
    if (file.size < 1 || file.size > 5 * 1024 * 1024) throw new ErroHttp(400, 'A imagem deve ter até 5 MB.')
    const bytes = new Uint8Array(await file.arrayBuffer())
    const tipos: Record<string, { ext: string; valido: boolean }> = {
      'image/jpeg': { ext: 'jpg', valido: bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 },
      'image/png': { ext: 'png', valido: [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v) },
      'image/webp': { ext: 'webp', valido: new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP' },
    }
    const formato = tipos[file.type]
    if (!formato?.valido) throw new ErroHttp(400, 'Envie uma imagem JPEG, PNG ou WebP válida.')
    const path = `${tipo}/${user.id}/${randomUUID()}.${formato.ext}`
    const { error } = await user.db.storage.from('joias').upload(path, bytes, { contentType: file.type, upsert: false })
    if (error) throw error
    const { data } = user.db.storage.from('joias').getPublicUrl(path)
    return NextResponse.json({ publicUrl: data.publicUrl })
  } catch (error) { return responderErro(error) }
}
