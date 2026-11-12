import { NextResponse, after } from 'next/server'
import { exigirUsuario, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
import { lerJson, limitar } from '@/lib/seguranca'
import { processarReembolsosRetirada } from '@/lib/retirada-reembolsos'
import { processarNotificacoes } from '@/lib/notificacoes'
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    validarOrigem(request); const user = await exigirUsuario(request)
    await limitar(request,'cancelar-retirada',10,600,String(user.id))
    const { id } = await params, b = await lerJson(request)
    if (b.confirmar !== true || !Number.isSafeInteger(b.versao)) throw new ErroHttp(400,'Confirme o cancelamento e recarregue o pedido.')
    const { data: p, error } = await user.db.from('pedidos').select('id').eq('id', id).eq('cliente_email', user.email).maybeSingle()
    if (error || !p) throw new ErroHttp(404,'Pedido não encontrado.')
    const result = await user.db.rpc('hh_acao_retirada',{p_pedido_id:String(p.id),p_acao:'cancelar',p_versao:b.versao,p_codigo:''})
    if (result.error) throw new ErroHttp(409,'Não foi possível cancelar. Confira se a retirada já ocorreu ou está em conferência e fale com o atendimento.')
    after(async()=>{try{await processarReembolsosRetirada(String(p.id));await processarNotificacoes(String(p.id),8)}catch{console.error('[retirada] Cancelamento persistido aguarda nova tentativa.',{pedidoId:p.id})}})
    return NextResponse.json({sucesso:true},{headers:{'Cache-Control':'private, no-store'}})
  } catch(e){return responderErro(e)}
}
