import { useEffect,useRef,useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationToastService } from '../../services/notificationToastService'
import { SalesNotificationToast,type VisibleToast } from './SalesNotificationToast'

const maxVisible=4,life=6200,exitTime=280
export function NotificationToastViewport(){
 const [toasts,setToasts]=useState<VisibleToast[]>([]),timers=useRef(new Map<string,number>()),navigate=useNavigate()
 const close=(id:string)=>{
  const timer=timers.current.get(id);if(timer)clearTimeout(timer)
  setToasts(items=>items.map(item=>item.id===id?{...item,leaving:true}:item))
  const exit=window.setTimeout(()=>{setToasts(items=>items.filter(item=>item.id!==id));timers.current.delete(id)},exitTime)
  timers.current.set(id,exit)
 }
 useEffect(()=>{
  const unsubscribe=notificationToastService.subscribe(payload=>setToasts(items=>{
   if(items.some(item=>item.id===payload.id))return items
   const next=[payload,...items].slice(0,maxVisible)
   const timer=window.setTimeout(()=>close(payload.id),life)
   timers.current.set(payload.id,timer)
   return next
  }))
  const active=timers.current
  return()=>{unsubscribe();active.forEach(clearTimeout);active.clear()}
 },[])
 return <div className="notification-toast-viewport" aria-label="Notificações recentes">{toasts.map(toast=><SalesNotificationToast key={toast.id} toast={toast} onClose={()=>close(toast.id)} onOpen={()=>{close(toast.id);navigate(toast.route)}}/>)}</div>
}
