import { useMemo } from 'react'
import { demoNotificationToApp,useDashboardData } from '../providers/DashboardDataProvider'
import { useDemoStore } from '../store/useDemoStore'

export function usePlatformNotifications(){
 const regular=useDemoStore(state=>state.notifications),readRegular=useDemoStore(state=>state.markNotificationRead),readAllRegular=useDemoStore(state=>state.markAllNotificationsRead),archive=useDemoStore(state=>state.archiveNotification),remove=useDemoStore(state=>state.deleteNotification),clearRegular=useDemoStore(state=>state.clearNotifications),demo=useDashboardData()
 const notifications=useMemo(()=>demo.active?[...demo.notifications.map(demoNotificationToApp),...regular]:regular,[demo.active,demo.notifications,regular])
 return{notifications,read:(id:string)=>id.startsWith('notification-demo-')?demo.markNotificationRead(id):readRegular(id),readAll:()=>{readAllRegular();demo.markAllNotificationsRead()},archive,remove,clear:()=>{clearRegular();demo.clearDemoNotifications()}}
}
