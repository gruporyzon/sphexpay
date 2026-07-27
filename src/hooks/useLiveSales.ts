import { useCallback,useEffect,useMemo,useRef,useState } from 'react'
import { dashboardService } from '../services/dashboardService'
import { normalizeTransactions,previousPeriodBounds,periodBounds,type FinancialTransaction } from '../lib/dashboardFinance'
import type { PeriodFilter } from '../types'
import { supabase } from '../lib/supabase'
import { useOptionalDashboardData } from '../providers/DashboardDataProvider'
import { convertDemoCents } from '../demo/demoSimulationEngine'

export function useLiveSales(userId:string|undefined,period:PeriodFilter){
 const context=useOptionalDashboardData(),demo=context??{active:false,ledger:[]}
 const [sales,setSales]=useState<FinancialTransaction[]>([]),[previous,setPrevious]=useState<FinancialTransaction[]>([]),[eligibleRevenueCents,setEligibleRevenueCents]=useState(0),[loading,setLoading]=useState(Boolean(supabase&&userId)),[error,setError]=useState(''),[realtime,setRealtime]=useState<'live'|'reconnecting'|'unavailable'>(supabase?'reconnecting':'unavailable'),[updatedAt,setUpdatedAt]=useState('')
 const mounted=useRef(true)
 const refresh=useCallback(async()=>{
  if(demo.active){
   const current=periodBounds(period),before=previousPeriodBounds(period),inRange=(start:Date,end:Date)=>demo.ledger.filter(item=>{const date=new Date(item.occurredAt);return date>=start&&date<=end})
   setSales(normalizeTransactions(inRange(current.start,current.end)));setPrevious(normalizeTransactions(inRange(before.start,before.end)))
   setEligibleRevenueCents(demo.ledger.filter(item=>item.status==='approved').reduce((sum,item)=>sum+convertDemoCents(item.amountCents,item.currency,'BRL'),0));setLoading(false);setError('');setRealtime('unavailable');setUpdatedAt(new Date().toISOString());return
  }
  if(!userId){setSales([]);setPrevious([]);setLoading(false);return}
  setError('')
  try{
   const current=periodBounds(period),before=previousPeriodBounds(period)
   const [currentRows,previousRows,eligibleRevenue]=await Promise.all([dashboardService.loadTransactions(userId,current.start,current.end),dashboardService.loadTransactions(userId,before.start,before.end),dashboardService.loadEligibleRevenue()])
   if(mounted.current){setSales(normalizeTransactions(currentRows));setPrevious(normalizeTransactions(previousRows));setEligibleRevenueCents(eligibleRevenue);setUpdatedAt(new Date().toISOString())}
  }catch{if(mounted.current)setError('Não foi possível carregar as transações reais.')}
  finally{if(mounted.current)setLoading(false)}
 },[userId,period,demo.active,demo.ledger])
 useEffect(()=>{mounted.current=true;setLoading(Boolean(supabase&&userId));void refresh();return()=>{mounted.current=false}},[refresh,userId])
 useEffect(()=>{
  if(!userId||demo.active)return
  let wasDisconnected=false
  const channel=dashboardService.subscribe(userId,transaction=>{if(transaction.ownerId!==userId)return;const bounds=periodBounds(period),occurredAt=new Date(transaction.occurredAt);if(occurredAt>=bounds.start&&occurredAt<=bounds.end)setSales(current=>normalizeTransactions([transaction,...current]));setUpdatedAt(new Date().toISOString());void refresh()},status=>{setRealtime(status);if(status==='live'&&wasDisconnected)void refresh();wasDisconnected=status!=='live'})
  return()=>{void channel?.unsubscribe()}
 },[userId,period,refresh,demo.active])
 return useMemo(()=>({sales,previous,eligibleRevenueCents,loading,error,realtime,updatedAt,refresh,demo:demo.active}),[sales,previous,eligibleRevenueCents,loading,error,realtime,updatedAt,refresh,demo.active])
}
