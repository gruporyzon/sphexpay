// Upload validado de documentos de KYC.
// Arquivo único (validador embutido) para permitir deploy também pelo painel do Supabase.
import {createClient} from 'npm:@supabase/supabase-js@2'

// ---------------------------------------------------------------- validação
const KYC_DOCUMENT_MAX_BYTES=10*1024*1024
const KYC_DOCUMENT_MIMES=['image/jpeg','image/png','application/pdf'] as const
type KycDocumentMime=typeof KYC_DOCUMENT_MIMES[number]

const ascii=(bytes:Uint8Array,start:number,length:number)=>new TextDecoder().decode(bytes.slice(start,start+length))
const uint32be=(bytes:Uint8Array,offset:number)=>(bytes[offset]*0x1000000)+(bytes[offset+1]<<16)+(bytes[offset+2]<<8)+bytes[offset+3]

function validPng(bytes:Uint8Array){
 const signature=[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]
 return bytes.length>=45&&signature.every((value,index)=>bytes[index]===value)&&uint32be(bytes,8)===13&&ascii(bytes,12,4)==='IHDR'&&uint32be(bytes,16)>0&&uint32be(bytes,20)>0&&ascii(bytes,bytes.length-8,4)==='IEND'
}
function validJpeg(bytes:Uint8Array){
 if(bytes.length<20||bytes[0]!==0xff||bytes[1]!==0xd8||bytes.at(-2)!==0xff||bytes.at(-1)!==0xd9)return false
 let offset=2,hasFrame=false
 while(offset+3<bytes.length-2){
  if(bytes[offset]!==0xff)return false
  while(bytes[offset]===0xff)offset++
  const marker=bytes[offset++];if(marker===0xd9)break
  if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue
  if(offset+1>=bytes.length)return false
  const length=(bytes[offset]<<8)+bytes[offset+1]
  if(length<2||offset+length>bytes.length)return false
  if(marker>=0xc0&&marker<=0xc3&&length>=8)hasFrame=bytes[offset+3]>0||bytes[offset+4]>0
  if(marker===0xda)return hasFrame
  offset+=length
 }
 return hasFrame
}
function validPdf(bytes:Uint8Array){
 if(bytes.length<67||ascii(bytes,0,5)!=='%PDF-')return false
 if(!/^%PDF-[12]\.[0-9]/.test(ascii(bytes,0,8)))return false
 const tail=ascii(bytes,Math.max(0,bytes.length-1024),Math.min(1024,bytes.length))
 return tail.includes('%%EOF')
}
const validators:Record<KycDocumentMime,(bytes:Uint8Array)=>boolean>={'image/jpeg':validJpeg,'image/png':validPng,'application/pdf':validPdf}
const extensions:Record<KycDocumentMime,readonly string[]>={'image/jpeg':['jpg','jpeg'],'image/png':['png'],'application/pdf':['pdf']}

function validateKycDocument(file:{name:string;type:string;size:number},bytes:Uint8Array){
 if(file.size!==bytes.length||file.size<67||file.size>KYC_DOCUMENT_MAX_BYTES)return{ok:false as const,code:'INVALID_SIZE'}
 if(!KYC_DOCUMENT_MIMES.includes(file.type as KycDocumentMime))return{ok:false as const,code:'INVALID_MIME'}
 const mime=file.type as KycDocumentMime
 const extension=file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
 if(!extension||!extensions[mime].includes(extension))return{ok:false as const,code:'EXTENSION_MISMATCH'}
 if(!validators[mime](bytes))return{ok:false as const,code:'MIME_SIGNATURE_MISMATCH'}
 return{ok:true as const,mime,extension:extensions[mime][0]}
}

// ---------------------------------------------------------------- handler
const allowedDocTypes=new Set(['identity_front','identity_back','proof_of_address','company_registration','company_tax_card','representative_document'])
const uploadableProfileStatus=new Set(['draft','rejected','needs_more_info','pending'])
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
 const file=form.get('file'),docType=String(form.get('docType')||'')
 if(!(file instanceof File)||!allowedDocTypes.has(docType))return json({code:'INVALID_UPLOAD'},400)

 const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data:profile,error:profileError}=await admin.from('kyc_profiles').select('status').eq('user_id',user.id).maybeSingle()
 if(profileError)return json({code:'PROFILE_LOOKUP_FAILED'},503)
 if(!profile)return json({code:'PROFILE_REQUIRED'},409)
 if(!uploadableProfileStatus.has(String(profile.status)))return json({code:'PROFILE_LOCKED'},409)

 const bytes=new Uint8Array(await file.arrayBuffer())
 const validation=validateKycDocument(file,bytes)
 if(!validation.ok)return json({code:validation.code},400)

 const path=`${user.id}/${docType}/${crypto.randomUUID()}.${validation.extension}`
 const {data:previous}=await admin.from('kyc_documents').select('id,storage_path').eq('user_id',user.id).eq('doc_type',docType).maybeSingle()

 const {error:uploadError}=await admin.storage.from('kyc-documents').upload(path,bytes,{contentType:validation.mime,upsert:false})
 if(uploadError)return json({code:'UPLOAD_FAILED'},500)

 const record={user_id:user.id,doc_type:docType,storage_path:path,original_filename:file.name.slice(0,300),mime_type:validation.mime,byte_size:file.size,status:'pending',rejection_reason:null,uploaded_at:new Date().toISOString(),reviewed_at:null,reviewed_by:null}
 const {data:saved,error:saveError}=await admin.from('kyc_documents').upsert(record,{onConflict:'user_id,doc_type'}).select('id').single()
 if(saveError||!saved){await admin.storage.from('kyc-documents').remove([path]);return json({code:'PERSIST_FAILED'},500)}

 if(previous?.storage_path&&previous.storage_path!==path)await admin.storage.from('kyc-documents').remove([previous.storage_path])

 return json({id:saved.id,docType,path,mime:validation.mime,size:file.size})
})
