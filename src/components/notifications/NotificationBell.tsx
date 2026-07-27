import { useEffect,useRef,useState } from 'react'
import { Bell } from 'lucide-react'
import { usePlatformNotifications } from '../../hooks/usePlatformNotifications'
import { NotificationPanel } from './NotificationPanel'

export function NotificationBell(){const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);const {notifications}=usePlatformNotifications();const unread=notifications.filter(n=>!n.read).length;const latest=notifications[0]?.id;const previous=useRef(latest);const [pulse,setPulse]=useState(false)
 useEffect(()=>{if(previous.current&&latest!==previous.current){setPulse(true);const timer=setTimeout(()=>setPulse(false),900);previous.current=latest;return()=>clearTimeout(timer)}previous.current=latest},[latest])
 useEffect(()=>{if(!open)return;const outside=(e:MouseEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)},escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};document.addEventListener('mousedown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('mousedown',outside);document.removeEventListener('keydown',escape)}},[open])
 return <div className="notification-bell-wrap" ref={root}><button aria-label={`Notificações${unread?`, ${unread} não lidas`:''}`} aria-expanded={open} aria-haspopup="dialog" className={`btn icon-btn notification-bell ${pulse?'new':''}`} onClick={()=>setOpen(v=>!v)}><Bell size={18}/>{unread>0&&<span>{unread>99?'99+':unread}</span>}</button>{open&&<NotificationPanel onClose={()=>setOpen(false)}/>}</div>}
