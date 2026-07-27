import webpush from 'web-push'
import { pushConfiguration } from './config.js'

let configuredSignature=''

const configureWebPush=()=>{
 const configuration=pushConfiguration()
 if(!configuration.vapidConfigured)throw Object.assign(new Error('VAPID_NOT_CONFIGURED'),{code:'VAPID_NOT_CONFIGURED'})
 const signature=`${configuration.vapid.subject}:${configuration.vapid.publicKey}`
 if(signature!==configuredSignature){
  webpush.setVapidDetails(configuration.vapid.subject,configuration.vapid.publicKey,configuration.vapid.privateKey)
  configuredSignature=signature
 }
 return webpush
}

const safeError=error=>String(error?.message||'PUSH_DELIVERY_FAILED').slice(0,180)
const isExpired=statusCode=>statusCode===404||statusCode===410
const missingDiagnosticColumns=error=>error?.code==='42703'||error?.code==='PGRST204'
const updateDelivery=async(client,subscriptionId,eventId,values)=>{
 let {error}=await client.from('push_delivery_log').update(values).eq('subscription_id',subscriptionId).eq('event_id',eventId)
 if(error&&missingDiagnosticColumns(error)){
  const {http_status:ignoredStatus,error_code:ignoredCode,...compatible}=values
  void ignoredStatus
  void ignoredCode
  ;({error}=await client.from('push_delivery_log').update(compatible).eq('subscription_id',subscriptionId).eq('event_id',eventId))
 }
 return error
}

export async function sendPushToUser({
 client,userId,eventId,type,title,body,route,tag,metadata={},pushClient,subscriptionId,deviceId,deviceIds
}){
 if(!client||!userId||!eventId||!type||!title||!body||!route)throw Object.assign(new Error('INVALID_PAYLOAD'),{code:'INVALID_PAYLOAD'})
 const sender=pushClient||configureWebPush()
 let query=client.from('push_subscriptions').select('id,device_id,endpoint,p256dh,auth,failure_count').eq('user_id',userId).eq('enabled',true)
 if(subscriptionId)query=query.eq('id',subscriptionId)
 if(deviceId)query=query.eq('device_id',deviceId)
 if(deviceIds?.length)query=query.in('device_id',deviceIds)
 const {data:subscriptions,error}=await query
 if(error)throw Object.assign(new Error('SUBSCRIPTIONS_QUERY_FAILED'),{code:'SUBSCRIPTIONS_QUERY_FAILED'})
 if(!subscriptions?.length)return{success:false,code:'NO_ACTIVE_SUBSCRIPTIONS',reason:'Nenhuma inscrição ativa foi encontrada para o usuário.',sent:0,failed:0,expired:0,duplicates:0,results:[]}
 const payload=JSON.stringify({eventId,type,title,body,route,tag:tag||eventId,metadata,createdAt:new Date().toISOString()})
 const settled=await Promise.allSettled(subscriptions.map(async subscription=>{
  const attemptedAt=new Date().toISOString()
  const {error:insertError}=await client.from('push_delivery_log').insert({user_id:userId,subscription_id:subscription.id,event_id:eventId,status:'sending',attempted_at:attemptedAt})
  if(insertError){
   if(insertError.code==='23505')return'duplicate'
   throw Object.assign(new Error('DELIVERY_LOG_SAVE_FAILED'),{code:'DELIVERY_LOG_SAVE_FAILED'})
  }
  try{
   const result=await sender.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},payload)
   const statusCode=Number(result?.statusCode||201)
   await Promise.all([
    client.from('push_subscriptions').update({last_seen_at:new Date().toISOString(),last_success_at:new Date().toISOString(),last_error:null,last_failure_at:null,failure_count:0}).eq('id',subscription.id),
    updateDelivery(client,subscription.id,eventId,{status:'delivered',http_status:statusCode,error_code:null,delivered_at:new Date().toISOString()})
   ])
   return{status:'sent',deviceId:subscription.device_id,code:null}
  }catch(error){
   const statusCode=Number(error?.statusCode||0)||null,expired=isExpired(statusCode)
   const errorCode=expired?'SUBSCRIPTION_EXPIRED':statusCode?`PUSH_SERVICE_${statusCode}`:'PUSH_DELIVERY_FAILED'
   await Promise.all([
    client.from('push_subscriptions').update({enabled:expired?false:true,last_error:expired?'SUBSCRIPTION_EXPIRED':safeError(error),last_failure_at:new Date().toISOString(),failure_count:(subscription.failure_count||0)+1,updated_at:new Date().toISOString()}).eq('id',subscription.id),
    updateDelivery(client,subscription.id,eventId,{status:'failed',http_status:statusCode,error_code:errorCode})
   ])
   return{status:expired?'expired':'failed',deviceId:subscription.device_id,code:errorCode}
  }
 }))
 const results=settled.map(item=>item.status==='fulfilled'?item.value:{status:'failed',code:item.reason?.code||'PUSH_DELIVERY_FAILED'})
 const sent=results.filter(item=>typeof item==='object'&&item.status==='sent').length
 const duplicates=results.filter(item=>item==='duplicate').length
 const failures=results.filter(item=>typeof item==='object'&&item.status==='failed'||typeof item==='object'&&item.status==='expired')
 const failed=failures.length
 const expired=results.filter(item=>typeof item==='object'&&item.status==='expired').length
 const failureCode=failures[0]?.code
 const safeResults=results.filter(item=>typeof item==='object').map(item=>({deviceId:item.deviceId,status:item.status,code:item.code||undefined}))
 if(!sent&&!duplicates&&failureCode==='SUBSCRIPTION_EXPIRED')return{success:false,code:'SUBSCRIPTION_EXPIRED',reason:'A inscrição expirou e foi desativada.',sent,failed,expired,duplicates,results:safeResults}
 if(!sent&&!duplicates)return{success:false,code:failureCode||'PUSH_DELIVERY_FAILED',reason:'O serviço Push recusou a entrega.',sent,failed,expired,duplicates,results:safeResults}
 return{success:true,reason:failed?'Entrega parcial.':'Entrega aceita pelo serviço Push.',sent,failed,expired,duplicates,results:safeResults}
}
