import { NextResponse } from 'next/server'
import { exigirUsuario, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirUsuario(request)
    const { produtoId, nota, comentario } = await request.json()
    if (typeof produtoId !== 'string' || !Number.isInteger(nota) || nota < 1 || nota > 5 || typeof comentario !== 'string' || !comentario.trim() || comentario.length > 3000) throw new ErroHttp(400, 'Avaliação inválida.')
    const { error } = await user.db.from('avaliacoes').insert({ produto_id: produtoId, nota, comentario: comentario.trim(), usuario_nome: user.nome })
    if (error) throw error
    return NextResponse.json({ sucesso: true })
  } catch (error) { return responderErro(error) }
}
