import { createClient } from '@supabase/supabase-js'
import { serviceRoleKey, supabaseUrl } from './config.js'

const clean=value=>typeof value==='string'?value.trim():''

export default async function handler(request,response){
 if(request.method!=='POST')return response.status(405).json({success:false,code:'METHOD_NOT_ALLOWED',message:'Método não permitido.'})
 if(!supabaseUrl()||!serviceRoleKey())return response.status(503).json({success:false,code:'SUPABASE_SERVER_CREDENTIALS_MISSING',message:'O armazenamento server-side não está configurado.'})
 const token=clean(String(request.headers.authorization||'').replace(/^Bearer\s+/i,''))
 if(!token)return response.status(401).json({success:false,code:'UNAUTHORIZED',message:'Sessão inválida. Entre novamente.'})
 const client=createClient(supabaseUrl(),serviceRoleKey())
 const {data:{user}}=await client.auth.getUser(token)
 if(!user)return response.status(401).json({success:false,code:'UNAUTHORIZED',message:'Sessão inválida. Entre novamente.'})
 const input=typeof request.body==='string'?JSON.parse(request.body):request.body||{},endpoint=clean(input.endpoint)
 if(!endpoint)return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'A inscrição deste dispositivo é inválida.'})
 const now=new Date().toISOString()
 const {error}=await client.from('push_subscriptions').update({enabled:false,last_seen_at:now,updated_at:now}).eq('user_id',user.id).eq('endpoint',endpoint)
 if(error)return response.status(500).json({success:false,code:'SUBSCRIPTION_UPDATE_FAILED',message:'Não foi possível remover este dispositivo.'})
 return response.status(200).json({success:true})
}
