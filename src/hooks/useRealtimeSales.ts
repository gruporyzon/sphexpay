import { useEffect, useRef } from 'react'
import { useDemoStore } from '../store/useDemoStore'
import { realtimeEventsService } from '../services/realtimeEventsService'
import { notificationService } from '../services/notificationService'
import { audioService } from '../services/audioService'
import { notificationQueueService } from '../services/notificationQueueService'
import { saleNotification } from '../services/notificationEventService'

export function useRealtimeSales(){
 const active=useDemoStore(s=>s.preferences.sales.automaticUpdates),frequency=useDemoStore(s=>s.preferences.sales.updateFrequency),addSale=useDemoStore(s=>s.addSale),addNotification=useDemoStore(s=>s.addNotification),deleteNotification=useDemoStore(s=>s.deleteNotification),prefs=useDemoStore(s=>s.preferences)
 const prefsRef=useRef(prefs);prefsRef.current=prefs
 useEffect(()=>{if(!active){audioService.dispose();notificationService.dispose();notificationQueueService.clear();return}const pump=()=>notificationQueueService.drain(prefsRef.current.notifications.frequency).forEach(addNotification),pumpTimer=window.setInterval(pump,100),unsubscribe=realtimeEventsService.subscribe(sale=>{addSale(sale);const event=saleNotification(sale);deleteNotification(event.id);notificationQueueService.enqueue(event);pump();const current=prefsRef.current,notifications=current.notifications,quiet=notifications.doNotDisturb||(notifications.quietHours&&inQuietHours(notifications.quietFrom,notifications.quietTo));if(sale.status==='Aprovado'&&!quiet&&notifications.device&&notifications.sales)notificationService.sale(sale);if(sale.status==='Aprovado'&&!quiet&&(current.sales.saleSound||notifications.sound))audioService.playSale(notifications.soundVolume,notifications.soundStyle);if(sale.status==='Aprovado'&&!quiet&&notifications.vibration)audioService.vibrate()},frequency);return()=>{unsubscribe();window.clearInterval(pumpTimer);notificationQueueService.clear();audioService.dispose();notificationService.dispose()}},[active,frequency,addSale,addNotification,deleteNotification])
}
function inQuietHours(from:string,to:string){const now=new Date(),value=now.getHours()*60+now.getMinutes(),[fromHour,fromMinute]=from.split(':').map(Number),[toHour,toMinute]=to.split(':').map(Number),start=fromHour*60+fromMinute,end=toHour*60+toMinute;return start<=end?value>=start&&value<end:value>=start||value<end}
