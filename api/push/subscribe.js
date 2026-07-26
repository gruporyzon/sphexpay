import { createClient } from '@supabase/supabase-js'
import { serviceRoleKey, supabaseUrl } from './config.js'

const storageConfigured=()=>Boolean(supabaseUrl()&&serviceRoleKey())
const clean=value=>typeof value==='string'?value.trim():''
const getClient=()=>createClient(supabaseUrl(),serviceRoleKey())
async function authenticate(request,supabase){const token=clean(String(request.headers.authorization||'').replace(/^Bearer\s+/i,''));if(!token)return null;const {data:{user}}=await supabase.auth.getUser(token);return user||null}
function validSubscription(subscription){return Boolean(subscription&&typeof subscription==='object'&&/^https:\/\//.test(clean(subscription.endpoint))&&clean(subscription.endpoint).length<=2048&&clean(subscription.keys?.p256dh).length>=20&&clean(subscription.keys?.auth).length>=8)}

export default async function handler(request,response){
 if(request.method!=='POST')return response.status(405).json({success:false,code:'METHOD_NOT_ALLOWED',message:'Método não permitido.'})
 if(!storageConfigured())return response.status(503).json({success:false,code:'SUPABASE_SERVER_CREDENTIALS_MISSING',message:'As credenciais server-side do armazenamento ainda não foram configuradas.'})
 const supabase=getClient(),user=await authenticate(request,supabase);if(!user)return response.status(401).json({success:false,code:'UNAUTHORIZED',message:'Sessão inválida. Entre novamente.'})
 let input={};try{input=typeof request.body==='string'?JSON.parse(request.body):request.body||{}}catch{return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'Os dados do dispositivo são inválidos.'})}
 const endpoint=clean(input.endpoint||input.subscription?.endpoint)
 const subscription=input.subscription||input
 if(!validSubscription(subscription))return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'Os dados do dispositivo são inválidos.'})
 const now=new Date().toISOString(),record={user_id:user.id,endpoint,p256dh:clean(subscription.keys.p256dh),auth:clean(subscription.keys.auth),user_agent:clean(input.userAgent).slice(0,512),device_name:clean(input.deviceName).slice(0,120),platform:clean(input.platform).slice(0,40),browser:clean(input.browser).slice(0,40),enabled:true,last_seen_at:now,updated_at:now,last_error:null}
 let {error}=await supabase.from('push_subscriptions').upsert(record,{onConflict:'user_id,endpoint'})
 if(error?.code==='42P10'){
  ;({error}=await supabase.from('push_subscriptions').upsert(record,{onConflict:'endpoint'}))
 }
 if(error)return response.status(500).json({success:false,code:'SUBSCRIPTION_SAVE_FAILED',message:'Não foi possível registrar este dispositivo.'})
 const {data:stored,error:verifyError}=await supabase.from('push_subscriptions').select('id').eq('user_id',user.id).eq('endpoint',endpoint).eq('enabled',true).maybeSingle()
 if(verifyError||!stored)return response.status(500).json({success:false,code:'SUBSCRIPTION_NOT_PERSISTED',message:'O dispositivo não foi confirmado no armazenamento.'})
 return response.status(200).json({success:true,registered:true,deviceId:stored.id})
}
