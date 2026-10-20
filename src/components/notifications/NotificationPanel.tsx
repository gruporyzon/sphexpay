import {T,useTranslation} from '../../i18n'
import { CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePlatformNotifications } from '../../hooks/usePlatformNotifications'
import { NotificationItem } from './NotificationItem'

export function NotificationPanel({onClose}:{onClose:()=>void}){
 const {t}=useTranslation()
const {notifications,read,readAll}=usePlatformNotifications(),navigate=useNavigate();const unread=notifications.filter(n=>!n.read).length;return <div className="notification-panel" role="dialog" aria-label={t('Notificações recentes')}><div className="notification-panel-head"><div><strong><T>Notificações</T></strong><span>{unread}<T> não </T><T>{unread===1?'lida':'lidas'}</T></span></div>{unread>0&&<button className="btn btn-ghost" onClick={readAll}><CheckCheck size={15}/><T> Ler todas</T></button>}</div><div className="notification-panel-list scrollbar">{notifications.slice(0,5).map(n=><NotificationItem compact key={n.id} notification={n} onRead={read} onClose={onClose}/>)}</div><button className="notification-view-all" onClick={()=>{navigate('/app/notificacoes');onClose()}}><T>Ver todas as notificações</T></button></div>}
