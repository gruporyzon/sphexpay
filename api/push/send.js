import { createClient } from '@supabase/supabase-js'
import { pushConfiguration, serviceRoleKey, supabaseUrl } from './config.js'
import { sendPushToUser } from './send-service.js'

const clean=value=>typeof value==='string'?value.trim():''

export default async function handler(request,response){
 if(request.method!=='POST')return response.status(405).json({success:false,code:'METHOD_NOT_ALLOWED',message:'Método não permitido.'})
 const configuration=pushConfiguration()
 if(!configuration.vapidConfigured)return response.status(503).json({success:false,code:'VAPID_NOT_CONFIGURED',message:'O envio Push não está configurado.'})
 if(!configuration.storageConfigured)return response.status(503).json({success:false,code:'SUPABASE_SERVER_CREDENTIALS_MISSING',message:'O armazenamento server-side não está configurado.'})
 const token=clean(String(request.headers.authorization||'').replace(/^Bearer\s+/i,''))
 if(!token)return response.status(401).json({success:false,code:'UNAUTHORIZED',message:'Sessão inválida. Entre novamente.'})
 const client=createClient(supabaseUrl(),serviceRoleKey())
 const {data:{user}}=await client.auth.getUser(token)
 if(!user)return response.status(401).json({success:false,code:'UNAUTHORIZED',message:'Sessão inválida. Entre novamente.'})
 let input
 try{input=typeof request.body==='string'?JSON.parse(request.body):request.body||{}}
 catch{return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'Os dados da notificação são inválidos.'})}
 if(input.type!=='push_test'&&input.type!=='infrastructure_test')return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'Este endpoint aceita somente testes técnicos.'})
 const eventId=clean(input.eventId)
 const prefix=input.type==='infrastructure_test'?'infrastructure-test-':'push-test-'
 if(!eventId.startsWith(prefix)||eventId.length>160)return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'Os dados da notificação são inválidos.'})
 const result=await sendPushToUser({
  client,userId:user.id,eventId,type:input.type,title:input.type==='infrastructure_test'?'Teste técnico da infraestrutura':'Notificações ativadas',
  body:input.type==='infrastructure_test'?'Realtime e Push estão sendo verificados. Nenhuma venda foi criada.':'Seu dispositivo está conectado.',route:'/app'
 }).catch(error=>({success:false,code:error?.code||'PUSH_DELIVERY_FAILED',sent:0,failed:0,duplicates:0}))
 if(result.success)return response.status(200).json(result)
 if(result.code==='NO_ACTIVE_SUBSCRIPTIONS')return response.status(404).json(result)
 if(result.code==='SUBSCRIPTION_EXPIRED')return response.status(410).json(result)
 return response.status(502).json(result)
}
