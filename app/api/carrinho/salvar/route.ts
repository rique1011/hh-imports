import { limitar, lerJson } from '@/lib/seguranca'
import { NextResponse } from 'next/server'
import { exigirUsuario, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
export async function GET() { return NextResponse.json({ status: 'Rota disponível.' }) }
export async function POST(request: Request) {
  try {
    validarOrigem(request)
    const user = await exigirUsuario(request)
    await limitar(request,'salvar-sacola',60,600,String(user.id))
    const { itens } = await lerJson(request) as {itens:{id:string;quantidade:number}[]}
    if (!Array.isArray(itens) || itens.length > 100) throw new ErroHttp(400, 'Carrinho inválido.')
    if (!itens.length) {
      const { error } = await user.db.from('carrinhos_abandonados').delete().eq('cliente_email', user.email)
      if (error) throw error
    } else {
      if (itens.some(item => !item.id || !Number.isSafeInteger(item.quantidade) || item.quantidade < 1 || item.quantidade > 999)) throw new ErroHttp(400, 'Quantidade inválida.')
      const { data: catalogo, error: catalogoError } = await user.db.from('produtos')
        .select('id,nome,preco,fotos,slug').in('id', itens.map(item => item.id))
      if (catalogoError) throw catalogoError
      const validos = itens.map(item => {
        const p = catalogo?.find(p => String(p.id) === String(item.id))
        if (!p) throw new ErroHttp(400, 'Produto não encontrado.')
        return { id: p.id, nome: p.nome, preco: Number(p.preco), foto: p.fotos?.[0] || '', slug: p.slug, quantidade: item.quantidade }
      })
      const total = Math.round(validos.reduce((sum, item) => sum + item.preco * item.quantidade, 0) * 100) / 100
      const { error } = await user.db.from('carrinhos_abandonados').upsert({ cliente_email: user.email,
        itens: validos, total, atualizado_em: new Date().toISOString(), email_enviado: false }, { onConflict: 'cliente_email' })
      if (error) throw error
    }
    return NextResponse.json({ success: true })
  } catch (error) { return responderErro(error) }
}
