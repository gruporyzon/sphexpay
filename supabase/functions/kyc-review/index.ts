// Fila de análise de KYC (uso administrativo).
//
// Um único endpoint porque o plano Vercel Hobby limita o número de funções em
// api/ — a lógica de análise vive aqui, como Edge Function do Supabase.
// Exige usuário autenticado com app_metadata.role === 'admin'. As leituras dos
// arquivos são sempre por URL assinada de curta duração gerada com service_role.

import {createClient} from 'npm:@supabase/supabase-js@2'

const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
const json=(body:Record<string,unknown>,status=200)=>Response.json(body,{status,headers:corsHeaders})

const PROFILE_FIELDS='user_id,person_type,legal_name,tax_id,company_name,trade_name,birth_date,phone,address,status,rejection_reason,submitted_at,reviewed_at,reviewed_by,created_at,updated_at'
const DOCUMENT_FIELDS='id,user_id,doc_type,storage_path,original_filename,mime_type,byte_size,status,rejection_reason,uploaded_at,reviewed_at,reviewed_by'
const LIST_STATUS=new Set(['draft','pending','approved','rejected','needs_more_info'])
const PROFILE_DECISIONS=new Set(['approved','rejected','needs_more_info'])
const DOCUMENT_DECISIONS=new Set(['approved','rejected'])
const UUID=/^[0-9a-f-]{36}$/i
const SIGNED_URL_TTL=300

const clampReason=(value:unknown)=>typeof value==='string'?value.trim().slice(0,2000):''

async function recordEvent(admin:ReturnType<typeof createClient>,eventType:string,actorId:string,metadata:Record<string,unknown>){
 try{await admin.from('security_audit_log').insert({event_type:eventType,actor_id:actorId,metadata})}catch{/* auditoria não bloqueia a decisão */}
}

Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
 if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405)
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!url||!anon||!serviceRole)return json({code:'SERVER_NOT_CONFIGURED'},503)

 const authorization=request.headers.get('Authorization')||''
 const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}}})
 const {data:{user}}=await userClient.auth.getUser()
 if(!user)return json({code:'UNAUTHORIZED'},401)
 if(user.app_metadata?.role!=='admin')return json({code:'FORBIDDEN'},403)

 let body:Record<string,unknown>
 try{body=await request.json()}catch{return json({code:'INVALID_PAYLOAD'},400)}
 const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})
 const action=String(body.action||'')

 if(action==='list'){
  const status=String(body.status||'')
  let query=admin.from('kyc_profiles').select(PROFILE_FIELDS)
  if(status&&LIST_STATUS.has(status))query=query.eq('status',status)
  const {data:profiles,error}=await query.order('submitted_at',{ascending:false,nullsFirst:false}).limit(200)
  if(error)return json({code:'KYC_STORAGE_ERROR'},503)
  const rows=profiles||[],userIds=rows.map(row=>row.user_id)
  const counts=new Map<string,{total:number;approved:number;rejected:number;pending:number}>()
  if(userIds.length){
   const {data:docs,error:docsError}=await admin.from('kyc_documents').select('user_id,status').in('user_id',userIds)
   if(docsError)return json({code:'KYC_STORAGE_ERROR'},503)
   for(const doc of docs||[]){
    const entry=counts.get(doc.user_id)||{total:0,approved:0,rejected:0,pending:0}
    entry.total+=1;entry[doc.status as 'approved'|'rejected'|'pending']+=1;counts.set(doc.user_id,entry)
   }
  }
  return json({ok:true,items:rows.map(row=>({...row,documents:counts.get(row.user_id)||{total:0,approved:0,rejected:0,pending:0}}))})
 }

 if(action==='detail'){
  const userId=String(body.userId||'')
  if(!UUID.test(userId))return json({code:'INVALID_USER'},400)
  const {data:profile,error}=await admin.from('kyc_profiles').select(PROFILE_FIELDS).eq('user_id',userId).maybeSingle()
  if(error)return json({code:'KYC_STORAGE_ERROR'},503)
  if(!profile)return json({code:'NOT_FOUND'},404)
  const {data:documents,error:docsError}=await admin.from('kyc_documents').select(DOCUMENT_FIELDS).eq('user_id',userId).order('uploaded_at',{ascending:true})
  if(docsError)return json({code:'KYC_STORAGE_ERROR'},503)
  const withUrls=await Promise.all((documents||[]).map(async doc=>{
   const {data:signed}=await admin.storage.from('kyc-documents').createSignedUrl(doc.storage_path,SIGNED_URL_TTL)
   return {...doc,signedUrl:signed?.signedUrl||null}
  }))
  return json({ok:true,profile,documents:withUrls})
 }

 if(action==='review'){
  const decision=String(body.decision||''),reason=clampReason(body.reason)

  if(body.target==='document'){
   const id=String(body.id||'')
   if(!UUID.test(id))return json({code:'INVALID_TARGET'},400)
   if(!DOCUMENT_DECISIONS.has(decision))return json({code:'INVALID_DECISION'},400)
   if(decision==='rejected'&&!reason)return json({code:'REASON_REQUIRED'},400)
   const {data,error}=await admin.from('kyc_documents').update({
    status:decision,rejection_reason:decision==='rejected'?reason:null,
    reviewed_at:new Date().toISOString(),reviewed_by:user.id
   }).eq('id',id).select(DOCUMENT_FIELDS).maybeSingle()
   if(error)return json({code:'KYC_STORAGE_ERROR'},503)
   if(!data)return json({code:'NOT_FOUND'},404)
   await recordEvent(admin,'kyc.document_reviewed',user.id,{documentId:data.id,userId:data.user_id,docType:data.doc_type,decision})
   return json({ok:true,document:data})
  }

  if(body.target==='profile'){
   const userId=String(body.userId||'')
   if(!UUID.test(userId))return json({code:'INVALID_TARGET'},400)
   if(!PROFILE_DECISIONS.has(decision))return json({code:'INVALID_DECISION'},400)
   if((decision==='rejected'||decision==='needs_more_info')&&!reason)return json({code:'REASON_REQUIRED'},400)
   const {data,error}=await admin.from('kyc_profiles').update({
    status:decision,rejection_reason:decision==='approved'?null:reason,
    reviewed_at:new Date().toISOString(),reviewed_by:user.id
   }).eq('user_id',userId).select(PROFILE_FIELDS).maybeSingle()
   if(error)return json({code:'KYC_STORAGE_ERROR'},503)
   if(!data)return json({code:'NOT_FOUND'},404)
   await recordEvent(admin,'kyc.profile_reviewed',user.id,{userId:data.user_id,personType:data.person_type,decision})
   return json({ok:true,profile:data})
  }

  return json({code:'INVALID_TARGET'},400)
 }

 return json({code:'UNKNOWN_ACTION'},400)
})
