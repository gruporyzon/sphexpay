import { browserPermissionService } from './browserPermissionService'
import { formatCommission,notificationTitles,type CommerceNotificationPayload } from '../lib/notificationCatalog'

export interface DeviceNotificationPayload{eventId:string;type:string;title:string;body:string;route:string;createdAt:string;currency?:string;amount?:number;commission?:number|null}
const recentKey='sphexpay_device_notification_events'
const alreadyDelivered=(eventId:string)=>{
 try{const now=Date.now(),saved=JSON.parse(localStorage.getItem(recentKey)||'{}') as Record<string,number>;Object.keys(saved).forEach(key=>{if(now-saved[key]>86400000)delete saved[key]});if(saved[eventId])return true;saved[eventId]=now;localStorage.setItem(recentKey,JSON.stringify(saved));return false}catch{return false}
}
export async function showDeviceNotification(payload:DeviceNotificationPayload){
 if(browserPermissionService.status()!=='granted'||!('serviceWorker'in navigator)||alreadyDelivered(payload.eventId))return false
 try{
  const registration=await navigator.serviceWorker.ready
  const worker=registration.active||registration.waiting||registration.installing
  if(worker){worker.postMessage({type:'SHOW_DEVICE_NOTIFICATION',payload});return true}
  await registration.showNotification(payload.title,{body:payload.body,icon:'/icons/sphexpay-app-192.png',badge:'/icons/sphexpay-app-192.png',tag:payload.eventId,silent:false,data:{eventId:payload.eventId,type:payload.type,route:payload.route}})
  return true
 }catch{return false}
}
export const notificationService={
 async registerWorker(){if(!('serviceWorker'in navigator))return undefined;try{return await navigator.serviceWorker.register('/sw.js')}catch{return undefined}},
 show(title:string,body:string,path='/app/notificacoes'){return showDeviceNotification({eventId:`manual-${crypto.randomUUID?.()||Date.now()}`,type:'manual',title,body,route:path,createdAt:new Date().toISOString()})},
 showCommerce(payload:CommerceNotificationPayload){return showDeviceNotification({eventId:payload.id,type:payload.type,title:payload.title||notificationTitles[payload.type],body:payload.body||formatCommission(payload.commission,payload.currency),currency:payload.currency,commission:payload.commission,route:payload.route,createdAt:payload.createdAt})},
 dispose(){}
}
