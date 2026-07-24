import { useEffect,useRef } from 'react'
import { useDemoStore } from '../store/useDemoStore'
import { realtimeEventsService } from '../services/realtimeEventsService'
import { publishFinancialNotification } from '../services/notificationService'
import { commercePayloadFromSale } from '../lib/notificationCatalog'
import type { CommerceNotificationType,NotificationPreferences } from '../types'

export function useRealtimeSales(){
 const active=useDemoStore(state=>state.preferences.sales.automaticUpdates),frequency=useDemoStore(state=>state.preferences.sales.updateFrequency),addSale=useDemoStore(state=>state.addSale),preferences=useDemoStore(state=>state.preferences.notifications),prefsRef=useRef(preferences)
 prefsRef.current=preferences
 useEffect(()=>{if(!active)return;return realtimeEventsService.subscribe(sale=>{addSale(sale);const payload=commercePayloadFromSale(sale),prefs=prefsRef.current,quiet=prefs.doNotDisturb||(prefs.quietHours&&inQuietHours(prefs.quietFrom,prefs.quietTo));if(!quiet&&prefs.device&&eventAllowed(payload.type,prefs))void publishFinancialNotification(payload)},frequency)},[active,frequency,addSale])
}
function inQuietHours(from:string,to:string){const now=new Date(),value=now.getHours()*60+now.getMinutes(),[fromHour,fromMinute]=from.split(':').map(Number),[toHour,toMinute]=to.split(':').map(Number),start=fromHour*60+fromMinute,end=toHour*60+toMinute;return start<=end?value>=start&&value<end:value>=start||value<end}
function eventAllowed(type:CommerceNotificationType,prefs:NotificationPreferences){if(type==='sale_approved'||type==='sale_pending')return prefs.saleApproved!==false&&prefs.sales;if(type.startsWith('pix_'))return prefs.pixGenerated!==false&&prefs.sales;if(type.startsWith('credit_card_')||type==='payment_refused')return prefs.cardApproved!==false&&prefs.sales;if(type.startsWith('boleto_'))return prefs.boletoEvents!==false&&prefs.sales;if(type==='subscription_approved'||type==='subscription_renewed')return prefs.subscriptionEvents!==false&&prefs.subscriptions;if(type.startsWith('withdrawal_'))return prefs.withdrawalEvents!==false&&prefs.withdrawals;return prefs.sales}
