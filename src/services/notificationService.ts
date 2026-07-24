import type { Sale } from '../types'
import { money } from '../lib/utils'
import { browserPermissionService } from './browserPermissionService'
import { formatCommission,notificationTitles,type CommerceNotificationPayload } from '../lib/notificationCatalog'

export const notificationService = {
  async registerWorker() {
    if ('serviceWorker' in navigator) {
      try { return await navigator.serviceWorker.register('/sw.js') } catch { return undefined }
    }
  },
  async show(title:string, body:string, path='/') {
    if (browserPermissionService.status() !== 'granted') return false
    try {
      if('serviceWorker'in navigator){
        const registration=await navigator.serviceWorker.ready
        const options:NotificationOptions&{renotify:boolean}={body,icon:'/icons/sphexpay-app-192.png',badge:'/icons/sphexpay-app-192.png',tag:`sphexpay-${Date.now()}`,renotify:true,data:{path}}
        await registration.showNotification(title,options)
        return true
      }
      const notification = new Notification(title, { body, icon:'/icons/sphexpay-app-192.png', tag:`sphexpay-${Date.now()}` })
      notification.onclick = () => { window.focus(); window.location.assign(path); notification.close() }
      return true
    } catch { return false }
  },
  showCommerce(payload:CommerceNotificationPayload){
    return this.show(payload.title||notificationTitles[payload.type],payload.body||formatCommission(payload.commission,payload.currency),payload.route)
  },
  sale(sale:Sale) { return nativeSaleAggregator.enqueue(sale) },
  dispose(){nativeSaleAggregator.dispose()}
}

const nativeSaleAggregator={sales:[] as Sale[],timer:undefined as number|undefined,enqueue(sale:Sale){this.sales.push(sale);if(this.timer)return true;this.timer=window.setTimeout(()=>{const batch=this.sales.splice(0),count=batch.length;this.timer=undefined;if(count===1){const item=batch[0];void notificationService.show('Nova venda aprovada',`Você recebeu uma nova venda de ${money(item.amount,item.currency)}.`,'/vendas')}else void notificationService.show(`${count} novas vendas recebidas`,`As vendas foram agrupadas para proteger sua experiência de notificações.`,'/vendas')},4000);return true},dispose(){if(this.timer)window.clearTimeout(this.timer);this.timer=undefined;this.sales=[]}}

// Futuro Web Push: conectar backend, VAPID, identificação do usuário e armazenamento
// seguro das inscrições push. Nenhuma inscrição ou chave é criada no cliente atual.
