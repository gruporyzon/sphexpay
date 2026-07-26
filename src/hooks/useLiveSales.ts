import { useCallback,useEffect,useMemo,useRef,useState } from 'react'
import { dashboardService } from '../services/dashboardService'
import { normalizeTransactions,previousPeriodBounds,periodBounds,type FinancialTransaction } from '../lib/dashboardFinance'
import type { PeriodFilter } from '../types'
import { supabase } from '../lib/supabase'

export function useLiveSales(userId:string|undefined,period:PeriodFilter){
 const [sales,setSales]=useState<FinancialTransaction[]>([]),[previous,setPrevious]=useState<FinancialTransaction[]>([]),[loading,setLoading]=useState(Boolean(supabase&&userId)),[error,setError]=useState(''),[realtime,setRealtime]=useState<'live'|'reconnecting'|'unavailable'>(supabase?'reconnecting':'unavailable'),[updatedAt,setUpdatedAt]=useState('')
 const mounted=useRef(true)
 const refresh=useCallback(async()=>{
  if(!userId){setSales([]);setPrevious([]);setLoading(false);return}
  setError('')
  try{
   const current=periodBounds(period),before=previousPeriodBounds(period)
   const [currentRows,previousRows]=await Promise.all([dashboardService.loadTransactions(userId,current.start,current.end),dashboardService.loadTransactions(userId,before.start,before.end)])
   if(mounted.current){setSales(normalizeTransactions(currentRows));setPrevious(normalizeTransactions(previousRows));setUpdatedAt(new Date().toISOString())}
  }catch{if(mounted.current)setError('Não foi possível carregar as transações reais.')}
  finally{if(mounted.current)setLoading(false)}
 },[userId,period])
 useEffect(()=>{mounted.current=true;setLoading(Boolean(supabase&&userId));void refresh();return()=>{mounted.current=false}},[refresh,userId])
 useEffect(()=>{
  if(!userId)return
  let wasDisconnected=false
  const channel=dashboardService.subscribe(userId,transaction=>{const bounds=periodBounds(period),occurredAt=new Date(transaction.occurredAt);if(transaction.ownerId!==userId||occurredAt<bounds.start||occurredAt>bounds.end)return;setSales(current=>normalizeTransactions([transaction,...current]));setUpdatedAt(new Date().toISOString())},status=>{setRealtime(status);if(status==='live'&&wasDisconnected)void refresh();wasDisconnected=status!=='live'})
  return()=>{void channel?.unsubscribe()}
 },[userId,period,refresh])
 return useMemo(()=>({sales,previous,loading,error,realtime,updatedAt,refresh}),[sales,previous,loading,error,realtime,updatedAt,refresh])
}
