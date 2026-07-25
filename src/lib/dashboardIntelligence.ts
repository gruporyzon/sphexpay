import type { ChartPoint, DashboardKpis, PeriodFilter } from '../types'

export type DashboardKpiChanges=Partial<Pick<DashboardKpis,'revenue'|'sales'|'ticket'|'goal'>>

const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value))
const finite=(value:number,fallback:number)=>Number.isFinite(value)&&value>=0?value:fallback

export function periodRevenueLabel(period:PeriodFilter){
 if(period.preset==='today')return'Faturamento de hoje'
 if(period.preset==='7d')return'Faturamento dos últimos 7 dias'
 if(period.preset==='30d')return'Faturamento dos últimos 30 dias'
 if(period.preset==='custom')return'Faturamento do período selecionado'
 if(period.preset==='yesterday')return'Faturamento de ontem'
 if(period.preset==='month')return'Faturamento deste mês'
 return'Faturamento do mês passado'
}
export const getDashboardPeriodLabel=periodRevenueLabel

export function deriveDashboardKpis(current:DashboardKpis,changes:DashboardKpiChanges):DashboardKpis{
 let revenue=finite(changes.revenue??current.revenue,current.revenue)
 let sales=Math.max(0,Math.round(finite(changes.sales??current.sales,current.sales)))
 let ticket=finite(changes.ticket??current.ticket,current.ticket)
 const changedRevenue=changes.revenue!==undefined
 const changedSales=changes.sales!==undefined
 const changedTicket=changes.ticket!==undefined

 if(changedRevenue&&changedSales)ticket=sales?revenue/sales:0
 else if(changedRevenue&&changedTicket)sales=revenue?Math.max(1,Math.round(revenue/Math.max(1,ticket))):0
 else if(changedSales&&changedTicket)revenue=ticket*sales
 else if(changedRevenue){sales=revenue?Math.max(1,Math.round(revenue/Math.max(1,current.ticket))):0;ticket=sales?revenue/sales:0}
 else if(changedSales)ticket=sales?revenue/sales:0
 else if(changedTicket)revenue=ticket*sales

 const goal=Math.max(1,finite(changes.goal??current.goal,current.goal))
 const progress=clamp(revenue/goal*100,0,100)
 const approval=clamp(current.approval+(progress-current.progress)*.025,72,99.4)
 const pending=Math.round(revenue*clamp(.16-approval/1000,.045,.14))
 const profit=Math.round(revenue*.72)
 const growth=clamp(current.growth+(revenue-current.revenue)/Math.max(1,current.revenue)*32,-65,180)
 return{revenue:Math.round(revenue*100)/100,sales,ticket:Math.round(ticket*100)/100,goal,progress,approval:Math.round(approval*10)/10,pending,profit,growth:Math.round(growth*10)/10}
}

export function rebalanceChart(data:ChartPoint[],kpis:DashboardKpis){
 if(!data.length)return[]
 const weights=data.map((point,index)=>Math.max(1,point.revenue)*(1+Math.sin((index+1)*1.71)*.035))
 const totalWeight=weights.reduce((sum,value)=>sum+value,0)
 let revenueAssigned=0,salesAssigned=0
 return data.map((point,index)=>{
  const last=index===data.length-1
  const revenue=last?Math.max(0,Math.round(kpis.revenue-revenueAssigned)):Math.max(0,Math.round(kpis.revenue*weights[index]/totalWeight))
  const sales=last?Math.max(0,kpis.sales-salesAssigned):Math.max(0,Math.round(kpis.sales*weights[index]/totalWeight))
  revenueAssigned+=revenue;salesAssigned+=sales
  return{...point,revenue,profit:Math.round(revenue*.72),sales}
 })
}

export function awardProgress(revenue:number,target:number){
 const safeTarget=Math.max(1,target)
 return{progress:clamp(revenue/safeTarget*100,0,100),remaining:Math.max(0,safeTarget-revenue)}
}
