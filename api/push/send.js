import { createClient } from '@supabase/supabase-js'
import { pushConfiguration, serviceRoleKey, supabaseUrl } from '../../server/push/config.js'
import { sendPushToUser } from '../../server/push/send-service.js'

const clean=value=>typeof value==='string'?value.trim():''
const safeText=(value,max)=>clean(value).slice(0,max)
const allowedGeneratorTypes=new Set(['sale_approved','sale_pending','pix_generated','pix_approved','pix_paid','credit_card_approved','credit_card_refused','boleto_generated','boleto_paid','subscription_approved','subscription_renewed','refund_done','chargeback_received','withdrawal_requested','withdrawal_sent','withdrawal_completed','payment_refused'])
const allowedManualTypes=new Set(['sale_approved','sale_pending','pix_generated','pix_paid','credit_card_approved','credit_card_refused','boleto_generated','boleto_paid','subscription_renewed','withdrawal_completed','refund_done','chargeback_received','custom'])
const requestWindows=new Map()
const rateLimit=(userId)=>{const now=Date.now(),windowStart=now-60_000,requests=(requestWindows.get(userId)||[]).filter(value=>value>windowStart);if(requests.length>=60)return false;requests.push(now);requestWindows.set(userId,requests);return true}

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
 if(!rateLimit(user.id))return response.status(429).json({success:false,code:'RATE_LIMITED',message:'Limite de envios atingido. Aguarde um minuto.'})
 let input
 try{input=typeof request.body==='string'?JSON.parse(request.body):request.body||{}}
 catch{return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'Os dados da notificação são inválidos.'})}
 const generator=input.type==='generator_notification',manual=input.type==='manual_notification'
 if(input.type!=='infrastructure_test'&&!generator&&!manual)return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'Tipo de notificação inválido.'})
 const eventId=clean(input.eventId)
 const prefix=input.type==='infrastructure_test'?'infrastructure-test-':manual?'manual-':'generator-'
 if(!eventId.startsWith(prefix)||eventId.length>160)return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'Os dados da notificação são inválidos.'})
 const generatorType=safeText(input.notificationType,60)
 const title=generator||manual?safeText(input.title,manual?80:70):'SphexPay conectada'
 const body=generator||manual?safeText(input.body,180):'Este dispositivo está pronto para receber notificações.'
 const targetDeviceId=safeText(input.targetDeviceId,64),targetDeviceIds=Array.isArray(input.targetDeviceIds)?[...new Set(input.targetDeviceIds.map(value=>safeText(value,64)))]:[]
 const uuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
 if((targetDeviceId&&!uuid(targetDeviceId))||targetDeviceIds.some(value=>!uuid(value))||targetDeviceIds.length>50)return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'O dispositivo selecionado é inválido.'})
 if(input.type==='infrastructure_test'&&!targetDeviceId)return response.status(400).json({success:false,code:'DEVICE_ID_REQUIRED',message:'O dispositivo atual não foi informado.'})
 if(generator&&(!allowedGeneratorTypes.has(generatorType)||!title||!body||(!targetDeviceId&&!targetDeviceIds.length&&input.target!=='all')))return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'Os dados da notificação são inválidos.'})
 if(manual&&(!allowedManualTypes.has(generatorType)||!title||!body||!targetDeviceIds.length))return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'Os dados da notificação são inválidos.'})
 const route=manual&&/^\/app(?:\/[A-Za-z0-9_?=&%./-]*)?$/.test(clean(input.route))?clean(input.route):'/app/configuracoes'
 const icon=manual&&['/icons/sphexpay-app-192.png','/icons/sphexpay-app-512.png'].includes(clean(input.icon))?clean(input.icon):'/icons/sphexpay-app-192.png'
 const result=await sendPushToUser({
  client,userId:user.id,eventId,type:generator||manual?generatorType:input.type,title,body,
  route,tag:manual?safeText(input.tag,80)||eventId:generator?eventId:'sphexpay-infrastructure-test',icon,deviceId:targetDeviceId||undefined,deviceIds:targetDeviceIds.length?targetDeviceIds:undefined,
  metadata:manual?{source:'manual',notificationType:generatorType,currency:['BRL','USD','EUR'].includes(input.metadata?.currency)?input.metadata.currency:'BRL'}:generator?{source:'manual'}:{}
 }).catch(error=>({success:false,code:error?.code||'PUSH_DELIVERY_FAILED',sent:0,failed:0,duplicates:0}))
 if(result.success)return response.status(200).json({...result,eventId})
 if(result.code==='NO_ACTIVE_SUBSCRIPTIONS')return response.status(404).json(result)
 if(result.code==='SUBSCRIPTION_EXPIRED')return response.status(410).json(result)
 return response.status(502).json(result)
}
