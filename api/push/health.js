import { pushConfiguration } from '../../server/push/config.js'
import { createClient } from '@supabase/supabase-js'
import { serviceRoleKey, supabaseUrl } from '../../server/push/config.js'

export default async function handler(request,response){
 if(request.method!=='GET')return response.status(405).json({success:false,code:'METHOD_NOT_ALLOWED',message:'Método não permitido.'})
 const {vapid,vapidConfigured,storageConfigured,sendConfigured,vapidCode,storageCode,sendCode}=pushConfiguration()
 let subscriptionsTableAccessible=false,deliveryLogTableAccessible=false
 if(storageConfigured){
  const client=createClient(supabaseUrl(),serviceRoleKey(),{auth:{persistSession:false,autoRefreshToken:false}})
  const [subscriptions,deliveryLog]=await Promise.all([
   client.from('push_subscriptions').select('id',{head:true,count:'exact'}).limit(1),
   client.from('push_delivery_log').select('id',{head:true,count:'exact'}).limit(1)
  ])
  subscriptionsTableAccessible=!subscriptions.error
  deliveryLogTableAccessible=!deliveryLog.error
 }
 const healthy=sendConfigured&&subscriptionsTableAccessible&&deliveryLogTableAccessible
 return response.status(200).json({
  success:true,
  vapidConfigured,
  storageConfigured,
  sendConfigured:healthy,
  checks:{
   vapidPublicKeyPresent:vapid.checks.serverPublicKeyPresent,
   publicKeyBase64Url:vapid.checks.publicKeyBase64Url,
   publicKeyLength65:vapid.checks.publicKeyLength,
   publicKeyFirstByte04:vapid.checks.publicKeyUncompressed,
   privateKeyPresent:vapid.checks.privateKeyPresent,
   privateKeyValid:vapid.checks.privateKeyValid,
   keyPairValid:vapid.checks.keyPairValid,
   subjectValid:vapid.checks.subjectValid,
   supabaseUrlPresent:Boolean(supabaseUrl()),
   serviceRolePresent:Boolean(serviceRoleKey()),
   subscriptionsTableAccessible,
   deliveryLogTableAccessible
  },
  codes:[vapidCode,storageCode,sendCode,!subscriptionsTableAccessible&&storageConfigured?'PUSH_SUBSCRIPTIONS_TABLE_UNAVAILABLE':undefined,!deliveryLogTableAccessible&&storageConfigured?'PUSH_DELIVERY_LOG_TABLE_UNAVAILABLE':undefined].filter(Boolean)
 })
}
