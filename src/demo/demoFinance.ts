import type { FinancialTransaction } from '../lib/dashboardFinance'
import type { StripeConnectFinance,StripePayout } from '../services/stripeConnectService'
import { convertDemoCents } from './demoSimulationEngine'

const DAY=86_400_000
const net=(item:FinancialTransaction)=>convertDemoCents(Math.max(0,item.netAmountCents??item.amountCents-item.feeCents),item.currency,'BRL')
const dayKey=(date:Date)=>date.toISOString().slice(0,10)

// Saldo, repasses e taxa da operação Demo, calculados das próprias vendas aprovadas da sessão:
// vendas dos últimos 2 dias ficam a receber; as anteriores viram repasses diários na conta.
export function demoFinance(ledger:FinancialTransaction[],now=new Date()):StripeConnectFinance{
 const approved=ledger.filter(item=>item.status==='approved')
 const cutoff=now.getTime()-2*DAY
 const pendingCents=approved.filter(item=>new Date(item.occurredAt).getTime()>=cutoff).reduce((sum,item)=>sum+net(item),0)
 const byDay=new Map<string,number>()
 for(const item of approved){const at=new Date(item.occurredAt);if(at.getTime()<cutoff)byDay.set(dayKey(at),(byDay.get(dayKey(at))||0)+net(item))}
 const days=[...byDay.entries()].sort(([a],[b])=>b.localeCompare(a))
 // O repasse mais recente ainda está a caminho do banco; o saldo disponível é o que ainda não saiu.
 const payouts:StripePayout[]=days.slice(0,30).map(([day,amountCents],index)=>{
  const created=new Date(`${day}T12:00:00Z`).getTime()+2*DAY
  return{id:`po_${day.replace(/-/g,'')}`,amountCents,currency:'brl',status:index===0?'in_transit':'paid',automatic:true,createdAt:new Date(created).toISOString(),arrivalDate:new Date(created+DAY).toISOString(),failureMessage:null,destination:{bankName:'Itaú Unibanco',last4:'4821'}}
 })
 const gross=approved.reduce((sum,item)=>sum+convertDemoCents(item.amountCents,item.currency,'BRL'),0),fees=approved.reduce((sum,item)=>sum+convertDemoCents(item.feeCents,item.currency,'BRL'),0)
 const availableCents=days.length?Math.round(days[0][1]*.35):0
 return{
  mode:'live',connected:true,payoutsEnabled:true,
  balance:{available:[{amountCents:availableCents,currency:'brl'}],pending:[{amountCents:pendingCents,currency:'brl'}]},
  schedule:{interval:'daily',delayDays:2,weeklyAnchor:null,monthlyAnchor:null},
  payouts,platformFeeBps:gross?Math.round(fees/gross*10000):null,methods:{card:true,pix:true,boleto:true}
 }
}
