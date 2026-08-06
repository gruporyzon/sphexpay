import { useEffect,useState } from 'react'
import { useAnimatedDashboardValue } from './useDashboardDemo'

const steps=[
 {balance:18420.8,sales:23,goal:68,event:'Pagamento recebido',amount:197},
 {balance:18705.7,sales:24,goal:70,event:'Venda aprovada',amount:284.9},
 {balance:18902.7,sales:25,goal:72,event:'Nova venda registrada',amount:197},
 {balance:19141.1,sales:26,goal:74,event:'Transação processada',amount:238.4},
]

function reducedMotion(){return typeof window!=='undefined'&&typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches}

export function useMobileDemo(){
 const [index,setIndex]=useState(0),[revision,setRevision]=useState(0)
 useEffect(()=>{
  if(reducedMotion())return
  const timer=window.setInterval(()=>{setIndex(value=>(value+1)%steps.length);setRevision(value=>value+1)},4200)
  return()=>window.clearInterval(timer)
 },[])
 const current=steps[index]??steps[0]!
 const balance=useAnimatedDashboardValue(current.balance,950),sales=useAnimatedDashboardValue(current.sales,700),goal=useAnimatedDashboardValue(current.goal,700),amount=useAnimatedDashboardValue(current.amount,800)
 return {
  balance,sales,goal,
  event:current.event,
  amount,
  revision,
 }
}
