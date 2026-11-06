import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { exigirUsuario, validarOrigem, responderErro, ErroHttp } from '@/lib/autorizacao'
import { MAX_BYTES_FOTO_PRODUTO } from '@/lib/fotos-produto'
import { limitar } from '@/lib/seguranca'
export const runtime='nodejs'
export async function POST(request: Request){try{
 validarOrigem(request);const user=await exigirUsuario(request)
 if(Number(request.headers.get('content-length'))>5*1024*1024+16384)throw new ErroHttp(413,'A imagem deve ter até 5 MB.')
 const form=await request.formData(),file=form.get('arquivo'),tipo=String(form.get('tipo'))
 if(!(file instanceof File)||!['produtos','trocas'].includes(tipo))throw new ErroHttp(400,'Imagem inválida.')
 if(tipo==='produtos'&&!user.admin)throw new ErroHttp(403,'Acesso restrito ao administrador.')
 if(tipo==='produtos'){
  await limitar(request,'upload-catalogo',120,600,String(user.id))
  await limitar(request,'upload-catalogo-dia',600,86400,String(user.id))
  if(file.size>MAX_BYTES_FOTO_PRODUTO)throw new ErroHttp(400,'As fotos do catálogo devem ter até 4 MB cada.')
 }else await limitar(request,'upload',12,86400,String(user.id))
 if(file.size<1||file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new ErroHttp(400,'Envie JPEG, PNG ou WebP de até 5 MB.')
 const pedido=String(form.get('pedidoId')||''),produto=String(form.get('produtoId')||'')
 if(tipo==='trocas'){
  const {data:p,error}=await user.db.from('pedidos').select('id,status,itens').eq('id',pedido).eq('cliente_email',user.email).maybeSingle()
  if(error||!p||p.status.toLowerCase()!=='entregue'||!p.itens?.some((i:{id:string})=>String(i.id)===produto))throw new ErroHttp(404,'Item entregue não encontrado.')
  const {count,error:quota}=await user.db.from('devolucao_uploads').select('caminho',{count:'exact',head:true}).eq('usuario_id',String(user.id)).eq('pedido_id',pedido).eq('produto_id',produto)
  if(quota)throw Error('Falha ao conferir limite.');if((count||0)>=3)throw new ErroHttp(429,'Você já enviou três fotos para este item. Fale com o atendimento.')
 }
 let bytes:Buffer
 try{bytes=await sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:20_000_000,animated:false}).rotate().resize(2560,2560,{fit:'inside',withoutEnlargement:true}).webp({quality:88}).toBuffer()}
 catch{throw new ErroHttp(400,'Imagem inválida ou dimensões excessivas.')}
 const path=`${tipo}/${user.id}/${randomUUID()}.webp`,bucket=tipo==='trocas'?'devolucoes':'joias'
 // Registra antes de enviar: falhas também consomem a cota, impedindo concorrência ilimitada.
 if(tipo==='trocas'){
  const {error}=await user.db.rpc('hh_reservar_upload',{p_caminho:path,p_usuario:String(user.id),p_pedido:pedido,p_produto:produto})
  if(error)throw new ErroHttp(429,'Limite de fotos atingido. Fale com o atendimento.')
 }
 const {error}=await user.db.storage.from(bucket).upload(path,bytes,{contentType:'image/webp',upsert:false});if(error)throw Error('Falha ao enviar imagem.')
 const url=tipo==='trocas'?'private:devolucoes/'+path:user.db.storage.from(bucket).getPublicUrl(path).data.publicUrl
 return NextResponse.json({publicUrl:url})
}catch(e){return responderErro(e)}}
