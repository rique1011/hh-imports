import { limitar, lerJson } from '@/lib/seguranca'
import { createHmac } from 'node:crypto'
import { NextResponse } from 'next/server'
import { exigirUsuario, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirUsuario(request)
    await limitar(request,'avaliacoes',5,3600,String(user.id))
    const { produtoId, nota, comentario } = await lerJson(request)
    if (typeof produtoId !== 'string' || typeof nota!=='number' || !Number.isInteger(nota) || nota < 1 || nota > 5 || typeof comentario !== 'string' || !comentario.trim() || comentario.length > 3000) throw new ErroHttp(400, 'Avaliação inválida.')
    const { error } = await user.db.rpc('hh_avaliar',{p_usuario:createHmac('sha256',process.env.MFA_ENCRYPTION_KEY!).update(String(user.id)+':'+produtoId).digest('hex'),p_email:user.email,p_produto:produtoId,p_nota:nota,p_comentario:comentario.trim(),p_nome:user.nome})
    if (error) throw error
    return NextResponse.json({ sucesso: true })
  } catch (error) { return responderErro(error) }
}
