import { useEffect,useMemo } from 'react'
import { useAuth } from './useAuth'
import { demoNotificationToApp,useDashboardData } from '../providers/DashboardDataProvider'
import { useUserNotifications } from '../services/userNotificationService'

// Notificações reais do banco; o modo demonstração do painel (admin) soma as dele à parte.
export function usePlatformNotifications(){
 const userId=useAuth().user?.id??null,demo=useDashboardData()
 const regular=useUserNotifications(state=>state.items),start=useUserNotifications(state=>state.start)
 const readRegular=useUserNotifications(state=>state.read),readAllRegular=useUserNotifications(state=>state.readAll),archive=useUserNotifications(state=>state.archive),remove=useUserNotifications(state=>state.remove),clearRegular=useUserNotifications(state=>state.clear)
 useEffect(()=>{start(userId)},[start,userId])
 const notifications=useMemo(()=>demo.active?[...demo.notifications.map(demoNotificationToApp),...regular]:regular,[demo.active,demo.notifications,regular])
 return{notifications,read:(id:string)=>id.startsWith('notification-')?demo.markNotificationRead(id):readRegular(id),readAll:()=>{readAllRegular();demo.markAllNotificationsRead()},archive,remove,clear:()=>{clearRegular();demo.clearDemoNotifications()}}
}
