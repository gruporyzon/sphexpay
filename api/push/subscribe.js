import { createClient } from '@supabase/supabase-js'

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})
const supabaseUrl=()=>process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL
const storageConfigured=()=>Boolean(supabaseUrl()&&process.env.SUPABASE_SERVICE_ROLE_KEY)
const clean=value=>typeof value==='string'?value.trim():''
const getClient=()=>createClient(supabaseUrl(),process.env.SUPABASE_SERVICE_ROLE_KEY)
async function authenticate(request,supabase){const token=clean(String(request.headers.authorization||'').replace(/^Bearer\s+/i,''));if(!token)return null;const {data:{user}}=await supabase.auth.getUser(token);return user||null}
function validSubscription(subscription){return Boolean(subscription&&typeof subscription==='object'&&/^https:\/\//.test(clean(subscription.endpoint))&&clean(subscription.endpoint).length<=2048&&clean(subscription.keys?.p256dh).length>=20&&clean(subscription.keys?.auth).length>=8)}

export default async function handler(request,response){
 if(!['GET','POST','DELETE'].includes(request.method))return response.status(405).json({success:false,code:'METHOD_NOT_ALLOWED',message:'Método não permitido.'})
 if(!storageConfigured())return response.status(503).json({success:false,code:'PUSH_STORAGE_NOT_CONFIGURED',message:'O armazenamento seguro de dispositivos ainda não foi configurado.'})
 const supabase=getClient(),user=await authenticate(request,supabase);if(!user)return response.status(401).json({success:false,code:'UNAUTHORIZED',message:'Sessão inválida. Entre novamente.'})
 let input={};try{input=typeof request.body==='string'?JSON.parse(request.body):request.body||{}}catch{return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'Os dados do dispositivo são inválidos.'})}
 if(request.method==='GET'){
  const endpoint=clean(request.query?.endpoint)
  if(!endpoint)return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'A inscrição deste dispositivo é inválida.'})
  const {data,error}=await supabase.from('push_subscriptions').select('id,last_success_at').eq('user_id',user.id).eq('endpoint',endpoint).eq('enabled',true).maybeSingle()
  if(error)return response.status(500).json({success:false,code:'SUBSCRIPTIONS_QUERY_FAILED',message:'Não foi possível consultar este dispositivo.'})
  return response.status(200).json({success:true,saved:Boolean(data),lastDelivery:data?.last_success_at||'—',storageConfigured:true})
 }
 const endpoint=clean(input.endpoint||input.subscription?.endpoint)
 if(request.method==='DELETE'){
  if(!endpoint)return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'A inscrição deste dispositivo é inválida.'})
  const {error}=await supabase.from('push_subscriptions').update({enabled:false,last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('user_id',user.id).eq('endpoint',endpoint)
  if(error)return response.status(500).json({success:false,code:'SUBSCRIPTION_UPDATE_FAILED',message:'Não foi possível remover este dispositivo.'})
  return response.status(200).json({success:true})
 }
 const subscription=input.subscription||input
 if(!validSubscription(subscription))return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'Os dados do dispositivo são inválidos.'})
 const now=new Date().toISOString(),record={user_id:user.id,endpoint,p256dh:clean(subscription.keys.p256dh),auth:clean(subscription.keys.auth),user_agent:clean(input.userAgent).slice(0,512),device_name:clean(input.deviceName).slice(0,120),platform:clean(input.platform).slice(0,40),browser:clean(input.browser).slice(0,40),enabled:true,last_seen_at:now,updated_at:now,last_error:null}
 const {data,error}=await supabase.from('push_subscriptions').upsert(record,{onConflict:'endpoint'}).select('id').single()
 if(error)return response.status(500).json({success:false,code:'SUBSCRIPTION_SAVE_FAILED',message:'Não foi possível registrar este dispositivo.'})
 return response.status(200).json({success:true,deviceId:data.id})
}
