import type { AppNotification,NotificationFrequency,NotificationPriority } from '../types'
const priority:Record<NotificationPriority,number>={critical:4,high:3,normal:2,low:1}
const interval:Record<NotificationFrequency,number>={realtime:0,'1ps':1000,'2ps':500,'5ps':200,'5s':5000,'15s':15000,'30s':30000,'60s':60000,digest5m:300000}
export class NotificationQueue{private ids=new Set<string>();private items:AppNotification[]=[];private lastDelivery=0;enqueue(event:AppNotification){if(!event.id||this.ids.has(event.id))return false;this.ids.add(event.id);this.items.push(event);this.items.sort((a,b)=>(priority[b.priority||'normal']-priority[a.priority||'normal'])||b.createdAt.localeCompare(a.createdAt));if(this.items.length>500){const removed=this.items.splice(500);removed.forEach(item=>this.ids.delete(item.id))}return true}drain(frequency:NotificationFrequency,now=Date.now()){if(now-this.lastDelivery<interval[frequency])return[];this.lastDelivery=now;const ready=[...this.items];this.items=[];ready.forEach(item=>this.ids.delete(item.id));return ready}get size(){return this.items.length}clear(){this.items=[];this.ids.clear();this.lastDelivery=0}}
export const notificationQueueService=new NotificationQueue()

// Adapter boundary: backend events, WebSocket, SSE, Supabase, Firebase and APIs
// must be validated before enqueue. Test events never mutate sales or balances.
