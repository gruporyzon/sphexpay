import { formatCommission,notificationTitles,type CommerceNotificationPayload } from '../lib/notificationCatalog'
import { pushSubscriptionService,type PushSendResult } from './pushSubscriptionService'

export const notificationService={
 async registerWorker(){
  if(!('serviceWorker'in navigator))return undefined
  try{
   const registration=await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'})
   if(import.meta.env.DEV)console.info('[PUSH] Service Worker registered')
   await registration.update()
   if(registration.waiting&&navigator.serviceWorker.controller){registration.waiting.postMessage({type:'SKIP_WAITING'})}
   navigator.serviceWorker.addEventListener('controllerchange',()=>{if(import.meta.env.DEV)console.info('[PUSH] Service Worker controller changed')},{once:true})
   return registration
  }catch(error){if(import.meta.env.DEV)console.warn('[PUSH] Service Worker registration failed',error instanceof Error?error.message:'unknown');return undefined}
 },
 sendCommerce(payload:CommerceNotificationPayload):Promise<PushSendResult>{
  return pushSubscriptionService.send({eventId:payload.id,type:payload.type,title:payload.title||notificationTitles[payload.type],body:payload.body||formatCommission(payload.commission,payload.currency),currency:payload.currency,commission:payload.commission,route:payload.route,createdAt:payload.createdAt})
 },
 dispose(){}
}

export const publishFinancialNotification=(payload:CommerceNotificationPayload)=>notificationService.sendCommerce(payload)
