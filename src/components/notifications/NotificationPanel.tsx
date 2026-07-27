import { CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePlatformNotifications } from '../../hooks/usePlatformNotifications'
import { NotificationItem } from './NotificationItem'

export function NotificationPanel({onClose}:{onClose:()=>void}){const {notifications,read,readAll}=usePlatformNotifications(),navigate=useNavigate();const unread=notifications.filter(n=>!n.read).length;return <div className="notification-panel" role="dialog" aria-label="Notificações recentes"><div className="notification-panel-head"><div><strong>Notificações</strong><span>{unread} não {unread===1?'lida':'lidas'}</span></div>{unread>0&&<button className="btn btn-ghost" onClick={readAll}><CheckCheck size={15}/> Ler todas</button>}</div><div className="notification-panel-list scrollbar">{notifications.slice(0,5).map(n=><NotificationItem compact key={n.id} notification={n} onRead={read} onClose={onClose}/>)}</div><button className="notification-view-all" onClick={()=>{navigate('/app/notificacoes');onClose()}}>Ver todas as notificações</button></div>}
