import { createClient } from '@supabase/supabase-js'
import { serviceRoleKey, supabaseUrl } from './config.js'

const clean=value=>typeof value==='string'?value.trim():''
const failure=(response,status,code,message)=>response.status(status).json({success:false,code,message})

export default async function handler(request,response){
 if(request.method!=='GET')return failure(response,405,'METHOD_NOT_ALLOWED','Método não permitido.')
 if(!supabaseUrl()||!serviceRoleKey())return failure(response,503,'SUPABASE_SERVER_CREDENTIALS_MISSING','O armazenamento server-side não está configurado.')
 const token=clean(String(request.headers.authorization||'').replace(/^Bearer\s+/i,''))
 if(!token)return failure(response,401,'SESSION_MISSING','Sessão autenticada não encontrada.')
 const client=createClient(supabaseUrl(),serviceRoleKey(),{auth:{persistSession:false,autoRefreshToken:false}})
 const {data:{user},error:authError}=await client.auth.getUser(token)
 if(authError||!user)return failure(response,401,'INVALID_ACCESS_TOKEN','A sessão autenticada não é válida.')
 const {data,error}=await client.from('push_subscriptions').select('id,device_name,platform,browser,last_seen_at,last_success_at,last_error').eq('user_id',user.id).eq('enabled',true).order('last_seen_at',{ascending:false})
 if(error)return failure(response,500,'ACTIVE_DEVICES_QUERY_FAILED','Não foi possível consultar os dispositivos ativos.')
 return response.status(200).json({success:true,devices:(data||[]).map(item=>({id:item.id,name:item.device_name||'Dispositivo',platform:item.platform||'Outro',browser:item.browser||'Navegador',lastSeen:item.last_seen_at,lastDelivery:item.last_success_at,lastError:item.last_error||null}))})
}
