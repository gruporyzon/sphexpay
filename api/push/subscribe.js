import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
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
 const allowed=new Set(['deviceId','subscription','automaticName','deviceName','browser','operatingSystem','platform','displayMode','locale','timezone'])
 if(Object.keys(input).some(key=>!allowed.has(key))||!input.subscription||typeof input.subscription!=='object')return null
 const subscription=input.subscription,subscriptionKeys=new Set(['endpoint','expirationTime','keys'])
 if(Object.keys(subscription).some(key=>!subscriptionKeys.has(key))||!subscription.keys||Object.keys(subscription.keys).some(key=>!['p256dh','auth'].includes(key)))return null
 const endpoint=clean(subscription.endpoint),p256dh=clean(subscription.keys?.p256dh),auth=clean(subscription.keys?.auth),deviceId=clean(input.deviceId)
 const p256dhBytes=base64UrlBytes(p256dh),authBytes=base64UrlBytes(auth)
 const expirationTime=subscription.expirationTime
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId))return{error:'DEVICE_ID_REQUIRED'}
 if(!/^https:\/\//.test(endpoint)||endpoint.length>2048||!p256dhBytes||p256dhBytes.length!==65||p256dhBytes[0]!==4||!authBytes||authBytes.length<16||authBytes.length>32||(expirationTime!==null&&expirationTime!==undefined&&(!Number.isFinite(expirationTime)||expirationTime<0)))return{error:'INVALID_SUBSCRIPTION'}
 return{deviceId,endpoint,p256dh,auth}
}
const failure=(response,status,code,message)=>response.status(status).json({registered:false,code,message})

export default async function handler(request,response){
 if(request.method!=='POST')return failure(response,405,'METHOD_NOT_ALLOWED','Método não permitido.')
 if(!storageConfigured())return failure(response,503,'SUPABASE_SERVER_CREDENTIALS_MISSING','As credenciais server-side do armazenamento ainda não foram configuradas.')
 const token=clean(String(request.headers.authorization||'').replace(/^Bearer\s+/i,''))
 if(!token)return failure(response,401,'AUTH_REQUIRED','Sessão autenticada necessária.')
 const supabase=getClient(),user=await authenticate(request,supabase)
 if(!user)return failure(response,401,'INVALID_ACCESS_TOKEN','A sessão autenticada não é válida.')
 let input={}
 try{input=typeof request.body==='string'?JSON.parse(request.body):request.body||{}}
 catch{return failure(response,400,'INVALID_PAYLOAD','Os dados do dispositivo não formam um JSON válido.')}
 const subscription=validateInput(input)
 if(!subscription||subscription.error)return failure(response,400,subscription?.error||'INVALID_SUBSCRIPTION',subscription?.error==='DEVICE_ID_REQUIRED'?'Identidade persistente do dispositivo ausente.':'Endpoint ou chaves da inscrição são inválidos.')
 const endpointHash=createHash('sha256').update(subscription.endpoint).digest('hex')
 const {data:owner,error:ownerError}=await supabase.from('push_subscriptions').select('id,user_id,device_id').eq('endpoint_hash',endpointHash).maybeSingle()
 if(ownerError)return failure(response,500,'DATABASE_WRITE_FAILED','Não foi possível validar a assinatura existente.')
 if(owner&&owner.user_id!==user.id)return failure(response,409,'SUBSCRIPTION_CONFLICT','A assinatura já pertence a outra conta.')
 const now=new Date().toISOString(),automaticName=clean(input.automaticName).slice(0,120)||'Dispositivo',record={user_id:user.id,device_id:subscription.deviceId,endpoint:subscription.endpoint,endpoint_hash:endpointHash,p256dh:subscription.p256dh,auth:subscription.auth,device_name:clean(input.deviceName).slice(0,120)||automaticName,automatic_name:automaticName,browser:clean(input.browser).slice(0,40),operating_system:clean(input.operatingSystem).slice(0,40),platform:clean(input.platform).slice(0,40),display_mode:clean(input.displayMode).slice(0,20),locale:clean(input.locale).slice(0,20),timezone:clean(input.timezone).slice(0,80),enabled:true,last_seen_at:now,updated_at:now,last_error:null,last_failure_at:null,failure_count:0}
 let error
 if(owner){
  ;({error}=await supabase.from('push_subscriptions').update(record).eq('id',owner.id).eq('user_id',user.id))
 }else{
  ;({error}=await supabase.from('push_subscriptions').upsert(record,{onConflict:'user_id,device_id'}))
 }
 if(error)return failure(response,500,'DATABASE_WRITE_FAILED','O banco recusou o registro do dispositivo.')
 const {data:stored,error:verifyError}=await supabase.from('push_subscriptions').select('id,user_id,device_id,device_name,automatic_name,browser,operating_system,enabled,last_seen_at').eq('user_id',user.id).eq('device_id',subscription.deviceId).eq('enabled',true).maybeSingle()
 if(verifyError||!stored)return failure(response,500,'DATABASE_CONFIRMATION_FAILED','O banco não confirmou o registro do dispositivo.')
 if(stored.user_id!==user.id||stored.device_id!==subscription.deviceId||stored.enabled!==true)return failure(response,409,'SUBSCRIPTION_CONFLICT','A confirmação do dispositivo não corresponde à sessão.')
 return response.status(200).json({registered:true,device:{id:stored.id,deviceId:stored.device_id,name:stored.device_name||stored.automatic_name,browser:stored.browser||'Navegador',operatingSystem:stored.operating_system||'Outro',enabled:true,lastSeenAt:stored.last_seen_at}})
}
