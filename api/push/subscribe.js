import { createClient } from '@supabase/supabase-js'
import { serviceRoleKey, supabaseUrl } from './config.js'

const storageConfigured=()=>Boolean(supabaseUrl()&&serviceRoleKey())
const clean=value=>typeof value==='string'?value.trim():''
const getClient=()=>createClient(supabaseUrl(),serviceRoleKey(),{auth:{persistSession:false,autoRefreshToken:false}})
const base64UrlBytes=value=>{
 const normalized=clean(value).replace(/\s+/g,'').replace(/=+$/g,'')
 if(!/^[A-Za-z0-9_-]+$/.test(normalized))return null
 try{return Buffer.from(normalized,'base64url')}catch{return null}
}
async function authenticate(request,supabase){
 const token=clean(String(request.headers.authorization||'').replace(/^Bearer\s+/i,''))
 if(!token)return null
 const {data:{user},error}=await supabase.auth.getUser(token)
 return error?null:user||null
}
function validateInput(input){
 if(!input||typeof input!=='object')return null
 const allowed=new Set(['endpoint','expirationTime','keys','userAgent','deviceName','platform','browser'])
 if(Object.keys(input).some(key=>!allowed.has(key))||!input.keys||Object.keys(input.keys).some(key=>!['p256dh','auth'].includes(key)))return null
 const endpoint=clean(input.endpoint),p256dh=clean(input.keys?.p256dh),auth=clean(input.keys?.auth)
 const p256dhBytes=base64UrlBytes(p256dh),authBytes=base64UrlBytes(auth)
 const expirationTime=input.expirationTime
 if(!/^https:\/\//.test(endpoint)||endpoint.length>2048||!p256dhBytes||p256dhBytes.length!==65||p256dhBytes[0]!==4||!authBytes||authBytes.length<16||authBytes.length>32||(expirationTime!==null&&expirationTime!==undefined&&(!Number.isFinite(expirationTime)||expirationTime<0)))return null
 return{endpoint,p256dh,auth}
}
const failure=(response,status,code,message)=>response.status(status).json({registered:false,code,message})

export default async function handler(request,response){
 if(request.method!=='POST')return failure(response,405,'METHOD_NOT_ALLOWED','Método não permitido.')
 if(!storageConfigured())return failure(response,503,'SUPABASE_SERVER_CREDENTIALS_MISSING','As credenciais server-side do armazenamento ainda não foram configuradas.')
 const token=clean(String(request.headers.authorization||'').replace(/^Bearer\s+/i,''))
 if(!token)return failure(response,401,'SESSION_MISSING','Sessão autenticada não encontrada.')
 const supabase=getClient(),user=await authenticate(request,supabase)
 if(!user)return failure(response,401,'INVALID_ACCESS_TOKEN','A sessão autenticada não é válida.')
 let input={}
 try{input=typeof request.body==='string'?JSON.parse(request.body):request.body||{}}
 catch{return failure(response,400,'INVALID_PAYLOAD','Os dados do dispositivo não formam um JSON válido.')}
 const subscription=validateInput(input)
 if(!subscription)return failure(response,400,'INVALID_SUBSCRIPTION','Endpoint ou chaves da inscrição são inválidos.')
 const now=new Date().toISOString(),record={user_id:user.id,endpoint:subscription.endpoint,p256dh:subscription.p256dh,auth:subscription.auth,user_agent:clean(input.userAgent).slice(0,180),device_name:clean(input.deviceName).slice(0,120),platform:clean(input.platform).slice(0,40),browser:clean(input.browser).slice(0,40),enabled:true,last_seen_at:now,updated_at:now,last_error:null}
 const {error}=await supabase.from('push_subscriptions').upsert(record,{onConflict:'user_id,endpoint'})
 if(error)return failure(response,500,'SUBSCRIPTION_UPSERT_FAILED','O banco recusou o registro do dispositivo.')
 const {data:stored,error:verifyError}=await supabase.from('push_subscriptions').select('id,enabled,user_id').eq('user_id',user.id).eq('endpoint',subscription.endpoint).eq('enabled',true).maybeSingle()
 if(verifyError)return failure(response,500,'SUBSCRIPTION_CONFIRMATION_FAILED','O banco não confirmou o registro do dispositivo.')
 if(!stored||stored.user_id!==user.id||stored.enabled!==true)return failure(response,500,'SUBSCRIPTION_NOT_PERSISTED','O dispositivo não foi encontrado após o registro.')
 return response.status(200).json({registered:true,active:true,deviceId:stored.id})
}
