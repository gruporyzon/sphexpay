import type { Sale } from '../types'
import { money } from '../lib/utils'
import { browserPermissionService } from './browserPermissionService'

export const notificationService = {
  async registerWorker() {
    if ('serviceWorker' in navigator) {
      try { return await navigator.serviceWorker.register('/sw.js') } catch { return undefined }
    }
  },
  show(title:string, body:string, path='/') {
    if (browserPermissionService.status() !== 'granted') return false
    try {
      const notification = new Notification(title, { body, icon:'/icons/sphexpay-app-192.png', tag:`sphexpay-${Date.now()}` })
      notification.onclick = () => { window.focus(); window.location.assign(path); notification.close() }
      return true
    } catch { return false }
  },
  sale(sale:Sale) { return nativeSaleAggregator.enqueue(sale) },
  dispose(){nativeSaleAggregator.dispose()}
}

const nativeSaleAggregator={sales:[] as Sale[],timer:undefined as number|undefined,enqueue(sale:Sale){this.sales.push(sale);if(this.timer)return true;this.timer=window.setTimeout(()=>{const batch=this.sales.splice(0),count=batch.length;this.timer=undefined;if(count===1){const item=batch[0];notificationService.show('Nova venda aprovada',`Você recebeu uma nova venda de ${money(item.amount,item.currency)}.`,'/vendas')}else notificationService.show(`${count} novas vendas recebidas`,`As vendas foram agrupadas para proteger sua experiência de notificações.`,'/vendas')},4000);return true},dispose(){if(this.timer)window.clearTimeout(this.timer);this.timer=undefined;this.sales=[]}}

// Futuro Web Push: conectar backend, VAPID, identificação do usuário e armazenamento
// seguro das inscrições push. Nenhuma inscrição ou chave é criada no cliente atual.
