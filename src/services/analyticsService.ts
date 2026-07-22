import type { ChartPoint, PeriodFilter, Sale } from '../types'

export const periodOptions=[['today','Hoje'],['yesterday','Ontem'],['7d','Últimos 7 dias'],['30d','Últimos 30 dias'],['month','Este mês'],['lastMonth','Mês passado'],['custom','Período personalizado']] as const

export function periodBounds(period:PeriodFilter,now=new Date()){
 const end=new Date(now),start=new Date(now);end.setHours(23,59,59,999);start.setHours(0,0,0,0)
 if(period.preset==='yesterday'){start.setDate(start.getDate()-1);end.setDate(end.getDate()-1);end.setHours(23,59,59,999)}
 if(period.preset==='7d')start.setDate(start.getDate()-6)
 if(period.preset==='30d')start.setDate(start.getDate()-29)
 if(period.preset==='month')start.setDate(1)
 if(period.preset==='lastMonth'){start.setMonth(start.getMonth()-1,1);end.setDate(0);end.setHours(23,59,59,999)}
 if(period.preset==='custom'&&period.from&&period.to)return{start:new Date(`${period.from}T00:00:00`),end:new Date(`${period.to}T23:59:59`)}
 return{start,end}
}
export function filterSales(sales:Sale[],period:PeriodFilter){const {start,end}=periodBounds(period);return sales.filter(s=>{const date=new Date(s.date);return date>=start&&date<=end})}
export function smartMetrics(sales:Sale[],subscriptions:number){const approved=sales.filter(s=>s.status==='Aprovado'),revenue=approved.reduce((a,s)=>a+s.amount,0),fees=approved.reduce((a,s)=>a+s.fee,0);return{revenue,profit:revenue-fees,total:approved.length,ticket:approved.length?revenue/approved.length:0,approval:sales.length?approved.length/sales.length*100:0,pending:sales.filter(s=>s.status==='Pendente'||s.status==='Em análise').reduce((a,s)=>a+s.amount,0),refunds:sales.filter(s=>s.status==='Reembolsado').length,recurring:subscriptions}}
export function chartForPeriod(chart:ChartPoint[],period:PeriodFilter|PeriodFilter['preset']){const filter=typeof period==='string'?{preset:period}:period;let size=filter.preset==='today'||filter.preset==='yesterday'?8:filter.preset==='7d'?7:filter.preset==='30d'?30:filter.preset==='month'?new Date().getDate():filter.preset==='lastMonth'?30:chart.length;if(filter.preset==='custom'&&filter.from&&filter.to){const from=new Date(`${filter.from}T00:00:00`),to=new Date(`${filter.to}T00:00:00`);size=Math.max(1,Math.min(chart.length,Math.floor((to.getTime()-from.getTime())/86400000)+1))}return chart.slice(-Math.max(1,size))}
export function periodRatio(chart:ChartPoint[],period:PeriodFilter){if(!chart.length)return 1;const all=chart.reduce((sum,p)=>sum+p.revenue,0),visible=chartForPeriod(chart,period).reduce((sum,p)=>sum+p.revenue,0);return all?Math.min(1,visible/all):1}
