// Migração única, com escopo fixo, prazo e credencial efêmera. Sem SQL ou caminhos do chamador.
import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
export const runtime='nodejs'
export const maxDuration=120
export async function POST(request:Request){
 const expected=process.env.SECURITY_MIGRATION_TOKEN||'',actual=request.headers.get('authorization')?.replace(/^Bearer /,'')||''
 const expira=Date.parse(process.env.SECURITY_MIGRATION_EXPIRES||'')
 if(!expected||!Number.isFinite(expira)||expira<Date.now()||actual.length!==expected.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(actual)))return NextResponse.json({error:'Indisponível.'},{status:404})
 const db=getSupabaseAdmin(),{data:claim,error}=await db.rpc('hh_claim_migracao_fotos',{})
 if(error)return NextResponse.json({error:'Migração indisponível.'},{status:503})
 if(!claim)return NextResponse.json({concluida:true},{status:410})
 try{
  const {data:bucket,error:consulta}=await db.storage.getBucket('devolucoes')
  if(consulta){const {error}=await db.storage.createBucket('devolucoes',{public:false,fileSizeLimit:5242880,allowedMimeTypes:['image/jpeg','image/png','image/webp']});if(error)throw error}
  else if(bucket.public){const {error}=await db.storage.updateBucket('devolucoes',{public:false});if(error)throw error}
  const paths:string[]=[]
  async function listar(prefix:string,depth=0){if(depth>5)throw Error('Estrutura inesperada.');const {data,error}=await db.storage.from('joias').list(prefix,{limit:1000});if(error||!data||data.length>=1000)throw Error('Listagem incompleta.');for(const e of data){const path=prefix+'/'+e.name;if(e.id)paths.push(path);else await listar(path,depth+1)}}
  await listar('trocas')
  let migradas=0
  for(const path of paths){
   const dest=db.storage.from('devolucoes')
   // Se houver retry após cópia, confirma a existência do destino antes de continuar.
   const {error:existe}=await dest.info(path)
   if(existe){const {error}=await db.storage.from('joias').copy(path,path,{destinationBucket:'devolucoes'});if(error)throw error}
   const {data:privado,error:verifica}=await dest.info(path);if(verifica||!privado)throw Error('Cópia não confirmada.')
   const antigo=db.storage.from('joias').getPublicUrl(path).data.publicUrl
   const {error:atualiza}=await db.from('trocas').update({foto_url:'private:devolucoes/'+path}).eq('foto_url',antigo);if(atualiza)throw atualiza
   const {error:remove}=await db.storage.from('joias').remove([path]);if(remove)throw remove
   migradas++
  }
  const {error:done}=await db.from('seguranca_tarefas').update({estado:'concluida',atualizado_em:new Date().toISOString()}).eq('chave','fotos_devolucoes_privadas');if(done)throw done
  return NextResponse.json({concluida:true,migradas})
 }catch{await db.from('seguranca_tarefas').update({estado:'pendente',atualizado_em:new Date().toISOString()}).eq('chave','fotos_devolucoes_privadas');return NextResponse.json({error:'Migração incompleta; originais pendentes preservados.'},{status:503})}
}
