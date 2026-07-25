import { formatCommission,notificationTitles,type CommerceNotificationPayload } from '../lib/notificationCatalog'
import { ensureServiceWorker,pushSubscriptionService,type PushSendResult } from './pushSubscriptionService'

export const notificationService={
 async registerWorker(){
  if(!('serviceWorker'in navigator))return undefined
  try{
   const registration=await ensureServiceWorker()
   if(import.meta.env.DEV)console.info('[PUSH] Service Worker registered')
   return registration
  }catch(error){if(import.meta.env.DEV)console.warn('[PUSH] Service Worker registration failed',error instanceof Error?error.message:'unknown');return undefined}
 },
 sendCommerce(payload:CommerceNotificationPayload):Promise<PushSendResult>{
  return pushSubscriptionService.send({eventId:payload.id,type:payload.type,title:payload.title||notificationTitles[payload.type],body:payload.body||formatCommission(payload.commission,payload.currency),currency:payload.currency,commission:payload.commission,route:payload.route,createdAt:payload.createdAt})
 },
 dispose(){}
}

export const publishFinancialNotification=(payload:CommerceNotificationPayload)=>notificationService.sendCommerce(payload)
