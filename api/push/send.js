import { createClient } from '@supabase/supabase-js'
import { pushConfiguration, serviceRoleKey, supabaseUrl } from './config.js'
import { sendPushToUser } from './send-service.js'

const clean=value=>typeof value==='string'?value.trim():''
const safeText=(value,max)=>clean(value).slice(0,max)
const allowedGeneratorTypes=new Set(['sale_approved','sale_pending','pix_generated','pix_approved','pix_paid','credit_card_approved','credit_card_refused','boleto_generated','boleto_paid','subscription_approved','subscription_renewed','refund_done','chargeback_received','withdrawal_requested','withdrawal_sent','withdrawal_completed','payment_refused'])

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
 const generator=input.type==='generator_notification'
 if(input.type!=='infrastructure_test'&&!generator)return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'Tipo de notificação inválido.'})
 const eventId=clean(input.eventId)
 const prefix=input.type==='infrastructure_test'?'infrastructure-test-':'generator-'
 if(!eventId.startsWith(prefix)||eventId.length>160)return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'Os dados da notificação são inválidos.'})
 const generatorType=safeText(input.notificationType,60)
 const title=generator?safeText(input.title,70):'SphexPay conectada'
 const body=generator?safeText(input.body,180):'As notificações deste dispositivo estão funcionando.'
 const subscriptionId=safeText(input.subscriptionId,64)
 if(subscriptionId&&!/^[0-9a-f-]{36}$/i.test(subscriptionId))return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'O dispositivo selecionado é inválido.'})
 if(generator&&(!allowedGeneratorTypes.has(generatorType)||!title||!body||!subscriptionId))return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'Os dados da notificação são inválidos.'})
 const result=await sendPushToUser({
  client,userId:user.id,eventId,type:generator?generatorType:input.type,title,body,
  route:'/app/configuracoes',tag:generator?eventId:'sphexpay-infrastructure-test',subscriptionId:subscriptionId||undefined,
  metadata:generator?{source:'manual'}:{}
 }).catch(error=>({success:false,code:error?.code||'PUSH_DELIVERY_FAILED',sent:0,failed:0,duplicates:0}))
 if(result.success)return response.status(200).json(result)
 if(result.code==='NO_ACTIVE_SUBSCRIPTIONS')return response.status(404).json(result)
 if(result.code==='SUBSCRIPTION_EXPIRED')return response.status(410).json(result)
 return response.status(502).json(result)
}
