import { createClient } from '@supabase/supabase-js'
import { serviceRoleKey, supabaseUrl } from './config.js'

const clean=value=>typeof value==='string'?value.trim():''
const failure=(response,status,code,message)=>response.status(status).json({success:false,code,message})
const statusFor=item=>{
 if(!item.enabled)return item.last_error==='SUBSCRIPTION_EXPIRED'?'Expirado':'Desconectado'
 if((item.failure_count||0)>=3)return'Erro'
 const recent=Date.now()-new Date(item.last_seen_at).getTime()<15*60*1000
 return recent?'Conectado':'Ativo'
}

export default async function handler(request,response){
 if(request.method!=='GET')return failure(response,405,'METHOD_NOT_ALLOWED','Método não permitido.')
 if(!supabaseUrl()||!serviceRoleKey())return failure(response,503,'SUPABASE_SERVER_CREDENTIALS_MISSING','O armazenamento server-side não está configurado.')
 const token=clean(String(request.headers.authorization||'').replace(/^Bearer\s+/i,''))
 if(!token)return failure(response,401,'AUTH_REQUIRED','Sessão autenticada necessária.')
 const client=createClient(supabaseUrl(),serviceRoleKey(),{auth:{persistSession:false,autoRefreshToken:false}})
 const {data:{user},error:authError}=await client.auth.getUser(token)
 if(authError||!user)return failure(response,401,'INVALID_ACCESS_TOKEN','A sessão autenticada não é válida.')
 const currentDeviceId=clean(request.query?.currentDeviceId)
 const {data,error}=await client.from('push_subscriptions').select('id,device_id,device_name,automatic_name,platform,browser,operating_system,display_mode,enabled,last_seen_at,last_success_at,last_error,failure_count').eq('user_id',user.id).order('last_seen_at',{ascending:false})
 if(error)return failure(response,500,'ACTIVE_DEVICES_QUERY_FAILED','Não foi possível consultar os dispositivos ativos.')
 return response.status(200).json({success:true,devices:(data||[]).map(item=>({id:item.id,deviceId:item.device_id,name:item.device_name||item.automatic_name||'Dispositivo',browser:item.browser||'Navegador',operatingSystem:item.operating_system||'Outro',platform:item.platform||'desktop',type:item.display_mode==='standalone'?'Aplicativo':'Navegador',status:statusFor(item),enabled:item.enabled===true,lastSeenAt:item.last_seen_at,lastSuccessAt:item.last_success_at,isCurrentDevice:Boolean(currentDeviceId&&item.device_id===currentDeviceId),lastErrorCode:item.last_error||null}))})
}
