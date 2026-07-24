import { X } from 'lucide-react'
import { SphexPayLogo } from '../branding/SphexPayLogo'
import { formatCommission,notificationTitles,type CommerceNotificationPayload } from '../../lib/notificationCatalog'

export type VisibleToast=CommerceNotificationPayload&{leaving?:boolean}
export function SalesNotificationToast({toast,onClose,onOpen}:{toast:VisibleToast;onClose:()=>void;onOpen:()=>void}){
 const time=new Date(toast.createdAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
 return <article className={`sales-notification-toast ${toast.leaving?'leaving':''}`} role="status" aria-live="polite" onClick={onOpen}><div className="sales-toast-logo"><SphexPayLogo/></div><div className="sales-toast-copy"><header><strong>{notificationTitles[toast.type]}</strong><time dateTime={toast.createdAt}>{time}</time></header><p>{formatCommission(toast.commission,toast.currency)}</p><small>{toast.status||'Atualização recebida'}</small></div><button aria-label="Fechar notificação" onClick={event=>{event.stopPropagation();onClose()}}><X/></button></article>
}
