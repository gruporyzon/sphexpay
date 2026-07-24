import type { CommerceNotificationPayload } from '../lib/notificationCatalog'

type Listener=(payload:CommerceNotificationPayload)=>void
class NotificationToastService{
 private listeners=new Set<Listener>()
 private recent=new Map<string,number>()
 subscribe(listener:Listener){this.listeners.add(listener);return()=>this.listeners.delete(listener)}
 emit(payload:CommerceNotificationPayload){
  const now=Date.now(),last=this.recent.get(payload.id)||0
  if(now-last<30000)return false
  this.recent.set(payload.id,now)
  this.recent.forEach((time,id)=>{if(now-time>60000)this.recent.delete(id)})
  this.listeners.forEach(listener=>listener(payload))
  return true
 }
}
export const notificationToastService=new NotificationToastService()
