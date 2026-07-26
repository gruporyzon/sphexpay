import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Currency,ExchangeRate,FinancialTransaction,ScenarioInput } from '../lib/dashboardFinance'

const transactionFromRow=(row:Record<string,unknown>):FinancialTransaction=>({
 transactionId:String(row.transaction_id),buyerName:typeof row.buyer_name==='string'?row.buyer_name:null,productName:String(row.product_name||'Produto'),
 paymentMethod:String(row.payment_method||'Pagamento'),status:row.status as FinancialTransaction['status'],amountCents:Number(row.amount_cents||0),
 feeCents:Number(row.fee_cents||0),currency:row.currency as Currency,occurredAt:String(row.occurred_at)
})

const scenarioFromRow=(row:Record<string,unknown>):ScenarioInput=>({
 todayRevenueCents:Number(row.today_revenue_cents),todayApprovedSales:Number(row.today_approved_sales),averageTicketCents:Number(row.average_ticket_cents),
 approvalRate:Number(row.approval_rate),refundRate:Number(row.refund_rate),chargebackRate:Number(row.chargeback_rate),dailyGrowthRate:Number(row.daily_growth_rate),
 weekdayFactors:Array.isArray(row.weekday_factors)?row.weekday_factors.map(Number):[],hourlyDistribution:Array.isArray(row.hourly_distribution)?row.hourly_distribution.map(Number):[],
 seed:Number(row.seed),currency:row.currency as Currency
})

export const dashboardService={
 async loadTransactions(userId:string,start:Date,end:Date){
  if(!supabase)return[] as FinancialTransaction[]
  const {data,error}=await supabase.from('payment_transactions').select('transaction_id,buyer_name,product_name,payment_method,status,amount_cents,fee_cents,currency,occurred_at').eq('user_id',userId).gte('occurred_at',start.toISOString()).lte('occurred_at',end.toISOString()).order('occurred_at',{ascending:false}).limit(2000)
  if(error)throw new Error('DASHBOARD_TRANSACTIONS_UNAVAILABLE')
  return(data||[]).map(row=>transactionFromRow(row as Record<string,unknown>))
 },
 subscribe(userId:string,onTransaction:(transaction:FinancialTransaction)=>void,onStatus:(status:'live'|'reconnecting'|'unavailable')=>void):RealtimeChannel|null{
  if(!supabase){onStatus('unavailable');return null}
  return supabase.channel(`dashboard-transactions:${userId}`)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'payment_transactions',filter:`user_id=eq.${userId}`},payload=>onTransaction(transactionFromRow(payload.new as Record<string,unknown>)))
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'payment_transactions',filter:`user_id=eq.${userId}`},payload=>onTransaction(transactionFromRow(payload.new as Record<string,unknown>)))
   .subscribe(status=>onStatus(status==='SUBSCRIBED'?'live':status==='CHANNEL_ERROR'||status==='TIMED_OUT'?'reconnecting':'unavailable'))
 },
 async loadRates(){
  if(!supabase)return[] as ExchangeRate[]
  const {data,error}=await supabase.from('exchange_rates').select('base_currency,quote_currency,rate,source,observed_at')
  if(error)throw new Error('EXCHANGE_RATES_UNAVAILABLE')
  return(data||[]).map(row=>({baseCurrency:row.base_currency as Currency,quoteCurrency:row.quote_currency as Currency,rate:Number(row.rate),source:String(row.source),observedAt:String(row.observed_at)}))
 },
 async loadScenario(userId:string){
  if(!supabase)return null
  const {data,error}=await supabase.from('dashboard_scenarios').select('*').eq('owner_id',userId).eq('name','Planejamento').maybeSingle()
  if(error)throw new Error('SCENARIO_UNAVAILABLE')
  return data?scenarioFromRow(data as Record<string,unknown>):null
 },
 async saveScenario(userId:string,input:ScenarioInput){
  if(!supabase)throw new Error('SCENARIO_UNAVAILABLE')
  const row={owner_id:userId,name:'Planejamento',currency:input.currency,today_revenue_cents:input.todayRevenueCents,today_approved_sales:input.todayApprovedSales,average_ticket_cents:input.averageTicketCents,approval_rate:input.approvalRate,refund_rate:input.refundRate,chargeback_rate:input.chargebackRate,daily_growth_rate:input.dailyGrowthRate,weekday_factors:input.weekdayFactors,hourly_distribution:input.hourlyDistribution,seed:input.seed,updated_at:new Date().toISOString()}
  const {error}=await supabase.from('dashboard_scenarios').upsert(row,{onConflict:'owner_id,name'})
  if(error)throw new Error('SCENARIO_SAVE_FORBIDDEN')
 }
}
