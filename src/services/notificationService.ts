import type { CommerceNotificationPayload } from '../lib/notificationCatalog'
import { ensureServiceWorker,type PushSendResult } from './pushSubscriptionService'

export const notificationService={
 async registerWorker(){
  if(!('serviceWorker'in navigator))return undefined
  try{
   const registration=await ensureServiceWorker()
   if(import.meta.env.DEV)console.info('[PUSH] Service Worker registered')
   return registration
  }catch(error){if(import.meta.env.DEV)console.warn('[PUSH] Service Worker registration failed',error instanceof Error?error.message:'unknown');return undefined}
 },
 async sendCommerce(payload:CommerceNotificationPayload):Promise<PushSendResult>{
  void payload
  return{ok:false,code:'SERVER_SIDE_ONLY',message:'Eventos financeiros são enviados somente após confirmação no servidor.'}
 },
 dispose(){}
}

export const publishFinancialNotification=(payload:CommerceNotificationPayload)=>notificationService.sendCommerce(payload)
