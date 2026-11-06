import { exigirUsuario, responderErro, ErroHttp } from '@/lib/autorizacao'
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const user=await exigirUsuario(request),{id}=await params
 let q=user.db.from('trocas').select('id,usuario_id,foto_url').eq('id',id)
 if(!user.admin)q=q.eq('usuario_id',user.id)
 const {data:t,error}=await q.maybeSingle();if(error||!t)throw new ErroHttp(404,'Foto indisponível.')
 const prefix='private:devolucoes/'
 if(!t.foto_url?.startsWith(prefix))throw new ErroHttp(404,'Foto indisponível.')
 const {data,error:download}=await user.db.storage.from('devolucoes').download(t.foto_url.slice(prefix.length))
 if(download||!data)throw new ErroHttp(404,'Foto indisponível.')
 return new Response(data,{headers:{'Content-Type':data.type||'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}})
}catch(e){return responderErro(e)}}
