import { useEffect,useRef } from 'react'
import { useDemoStore } from '../store/useDemoStore'
import { realtimeEventsService } from '../services/realtimeEventsService'
import { getDashboardDataMode } from '../services/dashboardDataSource'

export function useRealtimeSales(){
 const active=useDemoStore(state=>state.preferences.sales.automaticUpdates),frequency=useDemoStore(state=>state.preferences.sales.updateFrequency),addSale=useDemoStore(state=>state.addSale),mode=useRef(getDashboardDataMode())
 useEffect(()=>{if(!active||mode.current!=='demo')return;return realtimeEventsService.subscribe(addSale,frequency)},[active,frequency,addSale])
}
