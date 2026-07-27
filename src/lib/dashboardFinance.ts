import type { PeriodFilter } from '../types'

export type Currency='BRL'|'USD'|'EUR'
export type TransactionStatus='approved'|'pending'|'declined'|'refunded'|'chargeback'
export interface FinancialTransaction{transactionId:string;ownerId?:string;productId?:string|null;buyerName:string|null;productName:string;paymentMethod:string;status:TransactionStatus;amountCents:number;grossAmountCents?:number;discountCents?:number;feeCents:number;netAmountCents?:number;commissionCents?:number;currency:Currency;occurredAt:string;updatedAt?:string}
export interface ExchangeRate{baseCurrency:Currency;quoteCurrency:Currency;rate:number;source:string;observedAt:string}
export interface ScenarioInput{todayRevenueCents:number;todayApprovedSales:number;averageTicketCents:number;approvalRate:number;refundRate:number;chargebackRate:number;dailyGrowthRate:number;weekdayFactors:number[];hourlyDistribution:number[];seed:number;currency:Currency}
export interface FinancialMetrics{approvedRevenueCents:number;approvedSales:number;attemptedSales:number;averageTicketCents:number;approvalRate:number;refunds:number;chargebacks:number;feesCents:number;growthRate:number}
export interface FinancialPoint{label:string;revenueCents:number;sales:number;occurredAt:string}

const zone='America/Sao_Paulo'
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value))
const nonnegative=(value:number)=>Math.max(0,Math.round(Number.isFinite(value)?value:0))
const dateKey=(date:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date)
const zonedHour=(date:Date)=>Number(new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'2-digit',hourCycle:'h23'}).format(date))
const dayLabel=(date:Date)=>new Intl.DateTimeFormat('pt-BR',{timeZone:zone,day:'2-digit',month:'2-digit'}).format(date)

export function normalizeFinancialMetrics(input:ScenarioInput):ScenarioInput{
 const sales=nonnegative(input.todayApprovedSales)
 const revenue=nonnegative(input.todayRevenueCents)
 const ticket=sales?Math.round(revenue/sales):nonnegative(input.averageTicketCents)
 const weekdays=Array.from({length:7},(_,index)=>clamp(Number(input.weekdayFactors[index]??1),0,5))
 const hours=Array.from({length:24},(_,index)=>clamp(Number(input.hourlyDistribution[index]??0),0,1))
 const hourTotal=hours.reduce((sum,value)=>sum+value,0)
 return{...input,todayRevenueCents:revenue,todayApprovedSales:sales,averageTicketCents:ticket,approvalRate:clamp(input.approvalRate,0,1),refundRate:clamp(input.refundRate,0,1),chargebackRate:clamp(input.chargebackRate,0,1),dailyGrowthRate:clamp(input.dailyGrowthRate,-1,10),weekdayFactors:weekdays,hourlyDistribution:hourTotal?hours.map(value=>value/hourTotal):Array(24).fill(1/24),seed:Math.trunc(input.seed)||1}
}

export function deriveScenarioMetrics(input:ScenarioInput):FinancialMetrics{
 const value=normalizeFinancialMetrics(input)
 const refunds=Math.round(value.todayApprovedSales*value.refundRate)
 const chargebacks=Math.round(value.todayApprovedSales*value.chargebackRate)
 const approvedSales=Math.max(0,value.todayApprovedSales-refunds-chargebacks)
 const approvedRevenueCents=approvedSales*value.averageTicketCents
 const attemptedSales=value.approvalRate?Math.ceil(value.todayApprovedSales/value.approvalRate):value.todayApprovedSales
 return{approvedRevenueCents,approvedSales,attemptedSales,averageTicketCents:approvedSales?Math.round(approvedRevenueCents/approvedSales):0,approvalRate:attemptedSales?value.todayApprovedSales/attemptedSales:0,refunds,chargebacks,feesCents:0,growthRate:value.dailyGrowthRate}
}

export function periodBounds(period:PeriodFilter,now=new Date()){
 const today=dateKey(now)
 const endKey=period.preset==='custom'&&period.to?period.to:today
 const end=new Date(`${endKey}T23:59:59.999-03:00`)
 const start=new Date(`${endKey}T00:00:00-03:00`)
 if(period.preset==='7d')start.setDate(start.getDate()-6)
 else if(period.preset==='30d')start.setDate(start.getDate()-29)
 else if(period.preset==='custom'&&period.from)start.setTime(new Date(`${period.from}T00:00:00-03:00`).getTime())
 return{start,end}
}

export function previousPeriodBounds(period:PeriodFilter,now=new Date()){
 const current=periodBounds(period,now),duration=current.end.getTime()-current.start.getTime()+1
 return{start:new Date(current.start.getTime()-duration),end:new Date(current.start.getTime()-1)}
}

export function periodTitle(period:PeriodFilter){
 if(period.preset==='today')return'Faturamento de hoje'
 if(period.preset==='7d')return'Faturamento dos últimos 7 dias'
 if(period.preset==='30d')return'Faturamento dos últimos 30 dias'
 return'Faturamento do período selecionado'
}

export function normalizeTransactions(rows:FinancialTransaction[]){
 const seen=new Set<string>()
 return rows.filter(row=>{if(seen.has(row.transactionId))return false;seen.add(row.transactionId);return true})
}

export function metricsFromTransactions(rows:FinancialTransaction[]):FinancialMetrics{
 const transactions=normalizeTransactions(rows),approved=transactions.filter(row=>row.status==='approved')
 const reversedIds=new Set(transactions.filter(row=>row.status==='refunded'||row.status==='chargeback').map(row=>row.transactionId))
 const eligible=approved.filter(row=>!reversedIds.has(row.transactionId))
 const approvedRevenueCents=eligible.reduce((sum,row)=>sum+row.amountCents,0)
 const approvedSales=eligible.length,attemptedSales=transactions.filter(row=>row.status!=='refunded'&&row.status!=='chargeback').length
 return{approvedRevenueCents,approvedSales,attemptedSales,averageTicketCents:approvedSales?Math.round(approvedRevenueCents/approvedSales):0,approvalRate:attemptedSales?approved.length/attemptedSales:0,refunds:transactions.filter(row=>row.status==='refunded').length,chargebacks:transactions.filter(row=>row.status==='chargeback').length,feesCents:eligible.reduce((sum,row)=>sum+row.feeCents,0),growthRate:0}
}

export function seriesFromTransactions(rows:FinancialTransaction[],period:PeriodFilter,now=new Date()):FinancialPoint[]{
 const {start,end}=periodBounds(period,now),durationDays=Math.floor((end.getTime()-start.getTime())/86400000)+1
 const hourly=period.preset==='today'||(period.preset==='custom'&&durationDays<=1)
 const buckets=new Map<string,FinancialPoint>()
 if(hourly)for(let hour=0;hour<24;hour++)buckets.set(String(hour),{label:`${String(hour).padStart(2,'0')}h`,revenueCents:0,sales:0,occurredAt:new Date(start.getTime()+hour*3600000).toISOString()})
 else for(let cursor=new Date(start),index=0;cursor<=end;cursor.setDate(cursor.getDate()+1),index++){const copy=new Date(cursor);buckets.set(dateKey(copy),{label:dayLabel(copy),revenueCents:0,sales:0,occurredAt:copy.toISOString()})}
 for(const row of normalizeTransactions(rows).filter(item=>item.status==='approved')){
  const date=new Date(row.occurredAt);if(date<start||date>end)continue
  const key=hourly?String(zonedHour(date)):dateKey(date),point=buckets.get(key)
  if(point){point.revenueCents+=row.amountCents;point.sales++}
 }
 return aggregateLongPeriod([...buckets.values()],durationDays)
}

export function generatePeriodSeries(input:ScenarioInput,period:PeriodFilter,now=new Date()):FinancialPoint[]{
 const scenario=normalizeFinancialMetrics(input),{start,end}=periodBounds(period,now),durationDays=Math.floor((end.getTime()-start.getTime())/86400000)+1
 if(period.preset==='today'||durationDays<=1){
  const total=deriveScenarioMetrics(scenario).approvedRevenueCents
  let assigned=0
  return scenario.hourlyDistribution.map((factor,hour)=>{const revenueCents=hour===23?total-assigned:Math.round(total*factor);assigned+=revenueCents;return{label:`${String(hour).padStart(2,'0')}h`,revenueCents,sales:Math.round(revenueCents/Math.max(1,scenario.averageTicketCents)),occurredAt:new Date(start.getTime()+hour*3600000).toISOString()}})
 }
 const weights=Array.from({length:durationDays},(_,index)=>{const date=new Date(start);date.setDate(date.getDate()+index);const distance=durationDays-1-index;return scenario.weekdayFactors[date.getDay()]*Math.pow(1+scenario.dailyGrowthRate,-distance)})
 const baseTotal=deriveScenarioMetrics(scenario).approvedRevenueCents*weights.reduce((sum,value)=>sum+value,0)/Math.max(.0001,scenario.weekdayFactors[new Date(end).getDay()])
 let assigned=0
 const daily=weights.map((weight,index)=>{const date=new Date(start);date.setDate(date.getDate()+index);const revenueCents=index===weights.length-1?Math.round(baseTotal)-assigned:Math.round(baseTotal*weight/weights.reduce((sum,value)=>sum+value,0));assigned+=revenueCents;return{label:dayLabel(date),revenueCents,sales:Math.round(revenueCents/Math.max(1,scenario.averageTicketCents)),occurredAt:date.toISOString()}})
 return aggregateLongPeriod(daily,durationDays)
}

function aggregateLongPeriod(points:FinancialPoint[],durationDays:number){
 if(durationDays<=31)return points
 const monthly=durationDays>120,groups=new Map<string,FinancialPoint>()
 for(const point of points){const date=new Date(point.occurredAt),key=monthly?`${date.getFullYear()}-${date.getMonth()}`:`week-${Math.floor((date.getTime()-new Date(points[0].occurredAt).getTime())/(7*86400000))}`,label=monthly?new Intl.DateTimeFormat('pt-BR',{month:'short',year:'2-digit',timeZone:zone}).format(date):`Semana ${Number(key.split('-')[1])+1}`,current=groups.get(key)??{label,revenueCents:0,sales:0,occurredAt:point.occurredAt};current.revenueCents+=point.revenueCents;current.sales+=point.sales;groups.set(key,current)}
 return[...groups.values()]
}

export function generateSalesTimeline(input:ScenarioInput,period:PeriodFilter,now=new Date()){
 return generatePeriodSeries(input,period,now).flatMap((point,index)=>Array.from({length:point.sales},(_,sale)=>({id:`scenario-${input.seed}-${index}-${sale}`,occurredAt:point.occurredAt,amountCents:input.averageTicketCents,scenario:true as const})))
}

export function convertCents(amountCents:number,source:Currency,target:Currency,rates:ExchangeRate[]){
 if(source===target)return{amountCents,converted:false as const,rate:1,observedAt:null,source:'original'}
 const rate=rates.find(item=>item.baseCurrency===source&&item.quoteCurrency===target)
 if(rate)return{amountCents:Math.round(amountCents*rate.rate),converted:true as const,rate:rate.rate,observedAt:rate.observedAt,source:rate.source}
 const first=rates.find(item=>item.baseCurrency===source&&item.quoteCurrency==='BRL'),second=rates.find(item=>item.baseCurrency==='BRL'&&item.quoteCurrency===target)
 if(!first||!second)return null
 const combined=first.rate*second.rate,observedAt=new Date(Math.min(new Date(first.observedAt).getTime(),new Date(second.observedAt).getTime())).toISOString()
 return{amountCents:Math.round(amountCents*combined),converted:true as const,rate:combined,observedAt,source:`${first.source} + ${second.source}`}
}

export function maskBuyerName(name:string|null){
 if(!name?.trim())return'Comprador'
 const parts=name.trim().split(/\s+/)
 return parts.length===1?parts[0]:`${parts[0]} ${parts.at(-1)?.charAt(0).toUpperCase()}.`
}
