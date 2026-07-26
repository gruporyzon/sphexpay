import { createClient } from '@supabase/supabase-js'
import { serviceRoleKey, supabaseUrl } from './config.js'

const clean=value=>typeof value==='string'?value.trim():''
const configured=()=>Boolean(supabaseUrl()&&serviceRoleKey())
const authenticate=async(request,client)=>{
 const token=clean(String(request.headers.authorization||'').replace(/^Bearer\s+/i,''))
 if(!token)return null
 const {data:{user}}=await client.auth.getUser(token)
 return user||null
}

export default async function handler(request,response){
 if(request.method!=='GET')return response.status(405).json({success:false,code:'METHOD_NOT_ALLOWED',message:'Método não permitido.'})
 if(!configured())return response.status(503).json({success:false,code:'SUPABASE_SERVER_CREDENTIALS_MISSING',message:'O armazenamento server-side não está configurado.'})
 const token=clean(String(request.headers.authorization||'').replace(/^Bearer\s+/i,''))
 if(!token)return response.status(401).json({success:false,code:'UNAUTHORIZED',message:'Sessão inválida. Entre novamente.'})
 const client=createClient(supabaseUrl(),serviceRoleKey()),user=await authenticate(request,client)
 if(!user)return response.status(401).json({success:false,code:'UNAUTHORIZED',message:'Sessão inválida. Entre novamente.'})
 const endpoint=clean(request.query?.endpoint)
 if(!endpoint)return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'A inscrição deste dispositivo é inválida.'})
 const {data,error}=await client.from('push_subscriptions').select('id,last_success_at,last_error').eq('user_id',user.id).eq('endpoint',endpoint).eq('enabled',true).maybeSingle()
 if(error)return response.status(500).json({success:false,code:'SUBSCRIPTIONS_QUERY_FAILED',message:'Não foi possível consultar este dispositivo.'})
 return response.status(200).json({success:true,saved:Boolean(data),storageConfigured:true,lastDelivery:data?.last_success_at||'—',lastError:data?.last_error||'—'})
}
