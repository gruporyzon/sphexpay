import type { PeriodFilter } from '../types'
import { useDemoStore } from '../store/useDemoStore'

export function useDashboardPeriod(){
 const period=useDemoStore(state=>state.period),setPeriodState=useDemoStore(state=>state.setPeriod)
 const setPeriod=(next:PeriodFilter)=>{
  if(next.preset==='custom'&&next.from&&next.to&&next.to<next.from)setPeriodState({...next,to:next.from})
  else setPeriodState(next)
 }
 return{period,setPeriod}
}
