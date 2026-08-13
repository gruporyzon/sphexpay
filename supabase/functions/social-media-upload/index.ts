import {createClient} from 'npm:@supabase/supabase-js@2'
import {validateSocialImage} from '../_shared/socialMediaValidation.ts'

const allowedKinds=new Set(['avatars','covers','posts','messages'])
const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
const json=(body:Record<string,unknown>,status=200)=>Response.json(body,{status,headers:corsHeaders})

Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
 if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405)
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!url||!anon||!serviceRole)return json({code:'SERVER_NOT_CONFIGURED'},503)
 const authorization=request.headers.get('Authorization')||'',userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}}}),{data:{user}}=await userClient.auth.getUser()
 if(!user)return json({code:'UNAUTHORIZED'},401)
 let form:FormData
 try{form=await request.formData()}catch{return json({code:'INVALID_FORM'},400)}
 const file=form.get('file'),kind=String(form.get('kind')||''),conversationId=String(form.get('conversationId')||'')
 if(!(file instanceof File)||!allowedKinds.has(kind))return json({code:'INVALID_UPLOAD'},400)
 const bytes=new Uint8Array(await file.arrayBuffer())
 const validation=validateSocialImage(file,bytes)
 if(!validation.ok)return json({code:validation.code},400)
 if(kind==='messages'){
  if(!/^[0-9a-f-]{36}$/i.test(conversationId))return json({code:'CONVERSATION_REQUIRED'},400)
  const {data:member}=await userClient.from('social_conversation_members').select('conversation_id').eq('conversation_id',conversationId).eq('user_id',user.id).maybeSingle()
  if(!member)return json({code:'CONVERSATION_FORBIDDEN'},403)
 }
 const suffix=kind==='messages'?`messages/${conversationId}`:kind,path=`${user.id}/${suffix}/${crypto.randomUUID()}.${validation.extension}`
 const admin=createClient(url,serviceRole),{error}=await admin.storage.from('social-media').upload(path,bytes,{contentType:validation.mime,upsert:false})
 if(error)return json({code:'UPLOAD_FAILED'},500)
 return json({path,mime:validation.mime,size:file.size})
})
