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
 client,userId,eventId,type,title,body,route,metadata={},pushClient,subscriptionId,endpoint
}){
 if(!client||!userId||!eventId||!type||!title||!body||!route)throw Object.assign(new Error('INVALID_PAYLOAD'),{code:'INVALID_PAYLOAD'})
 const sender=pushClient||configureWebPush()
 let query=client.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id',userId).eq('enabled',true)
 if(subscriptionId)query=query.eq('id',subscriptionId)
 if(endpoint)query=query.eq('endpoint',endpoint)
 const {data:subscriptions,error}=await query
 if(error)throw Object.assign(new Error('SUBSCRIPTIONS_QUERY_FAILED'),{code:'SUBSCRIPTIONS_QUERY_FAILED'})
 if(!subscriptions?.length)return{success:false,code:'NO_ACTIVE_SUBSCRIPTIONS',sent:0,failed:0,duplicates:0}
 const payload=JSON.stringify({eventId,type,title,body,route,metadata,createdAt:new Date().toISOString()})
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
    client.from('push_subscriptions').update({last_seen_at:new Date().toISOString(),last_success_at:new Date().toISOString(),last_error:null}).eq('id',subscription.id),
    updateDelivery(client,subscription.id,eventId,{status:'delivered',http_status:statusCode,error_code:null,delivered_at:new Date().toISOString()})
   ])
   return'sent'
  }catch(error){
   const statusCode=Number(error?.statusCode||0)||null,expired=isExpired(statusCode)
   const errorCode=expired?'SUBSCRIPTION_EXPIRED':statusCode?`PUSH_SERVICE_${statusCode}`:'PUSH_DELIVERY_FAILED'
   await Promise.all([
    client.from('push_subscriptions').update({enabled:expired?false:true,last_error:expired?'SUBSCRIPTION_EXPIRED':safeError(error),updated_at:new Date().toISOString()}).eq('id',subscription.id),
    updateDelivery(client,subscription.id,eventId,{status:'failed',http_status:statusCode,error_code:errorCode})
   ])
   return{status:expired?'expired':'failed',code:errorCode}
  }
 }))
 const results=settled.map(item=>item.status==='fulfilled'?item.value:{status:'failed',code:item.reason?.code||'PUSH_DELIVERY_FAILED'})
 const sent=results.filter(item=>item==='sent').length
 const duplicates=results.filter(item=>item==='duplicate').length
 const failures=results.filter(item=>typeof item==='object'&&item.status==='failed'||typeof item==='object'&&item.status==='expired')
 const failed=failures.length
 const failureCode=failures[0]?.code
 if(!sent&&!duplicates&&failureCode==='SUBSCRIPTION_EXPIRED')return{success:false,code:'SUBSCRIPTION_EXPIRED',sent,failed,duplicates}
 if(!sent&&!duplicates)return{success:false,code:failureCode||'PUSH_DELIVERY_FAILED',sent,failed,duplicates}
 return{success:true,sent,failed,duplicates}
}
