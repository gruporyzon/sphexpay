import type {FinancialTransaction} from '../../lib/dashboardFinance'
import type {StripeAmount,StripePayout,StripePayoutSchedule,StripePayoutStatus} from '../../services/stripeConnectService'

// Cálculos do Financeiro e dos Relatórios a partir de dados reais:
// vendas em payment_transactions (só vendas live) e saldo/repasses da Stripe.
export const PRIMARY_CURRENCY='BRL'
export const centsMoney=(cents:number,currency=PRIMARY_CURRENCY)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency}).format(cents/100)

const gross=(row:FinancialTransaction)=>row.grossAmountCents??row.amountCents
const net=(row:FinancialTransaction)=>row.netAmountCents??Math.max(0,row.amountCents-row.feeCents)
const sum=(rows:FinancialTransaction[],pick:(row:FinancialTransaction)=>number)=>rows.reduce((total,row)=>total+pick(row),0)

export type TransactionSummary={grossCents:number;feesCents:number;netCents:number;approvedCount:number;averageTicketCents:number;approvalRate:number;refundedCents:number;refundedCount:number;chargebackCents:number;chargebackCount:number;pendingCount:number;otherCurrencies:string[]}

export function summarizeTransactions(rows:FinancialTransaction[],currency=PRIMARY_CURRENCY):TransactionSummary{
 const list=rows.filter(row=>row.currency===currency),approved=list.filter(row=>row.status==='approved')
 const refunded=list.filter(row=>row.status==='refunded'),chargebacks=list.filter(row=>row.status==='chargeback')
 // Reembolsos e contestações foram aprovados antes; entram no denominador da aprovação.
 const decided=list.filter(row=>row.status!=='pending').length,everApproved=approved.length+refunded.length+chargebacks.length
 const grossCents=sum(approved,gross)
 return{
  grossCents,feesCents:sum(approved,row=>row.feeCents),netCents:sum(approved,net),approvedCount:approved.length,
  averageTicketCents:approved.length?Math.round(grossCents/approved.length):0,approvalRate:decided?everApproved/decided*100:0,
  refundedCents:sum(refunded,gross),refundedCount:refunded.length,chargebackCents:sum(chargebacks,gross),chargebackCount:chargebacks.length,
  pendingCount:list.filter(row=>row.status==='pending').length,
  otherCurrencies:[...new Set(rows.map(row=>row.currency).filter(value=>value!==currency))]
 }
}

export const balanceFor=(list:StripeAmount[]|undefined,currency=PRIMARY_CURRENCY)=>(list||[]).filter(item=>item.currency===currency).reduce((total,item)=>total+item.amountCents,0)

export const PAYOUT_STATUS_LABEL:Record<StripePayoutStatus,string>={paid:'Concluído',in_transit:'Em trânsito',pending:'Pendente',failed:'Falhou',canceled:'Cancelado'}
const WEEKDAY:Record<string,string>={monday:'segunda-feira',tuesday:'terça-feira',wednesday:'quarta-feira',thursday:'quinta-feira',friday:'sexta-feira',saturday:'sábado',sunday:'domingo'}

export function scheduleLabel(schedule:StripePayoutSchedule|null){
 if(!schedule?.interval)return'Agenda não informada'
 if(schedule.interval==='daily')return'Diário'
 if(schedule.interval==='weekly')return schedule.weeklyAnchor&&WEEKDAY[schedule.weeklyAnchor]?`Semanal, toda ${WEEKDAY[schedule.weeklyAnchor]}`:'Semanal'
 if(schedule.interval==='monthly')return schedule.monthlyAnchor?`Mensal, todo dia ${schedule.monthlyAnchor}`:'Mensal'
 return'Manual'
}

export type LedgerRow={id:string;date:string;description:string;type:'Entrada'|'Saída'|'Estorno'|'Contestação';status:string;amountCents:number;currency:string;affectsBalance:boolean}

export function buildLedger(transactions:FinancialTransaction[],payouts:StripePayout[],bounds:{start:Date;end:Date}):LedgerRow[]{
 const rows:LedgerRow[]=[]
 for(const row of transactions){
  if(row.status==='approved')rows.push({id:row.transactionId,date:row.occurredAt,description:`Venda · ${row.productName}`,type:'Entrada',status:'Aprovado',amountCents:net(row),currency:row.currency,affectsBalance:true})
  if(row.status==='refunded')rows.push({id:row.transactionId,date:row.updatedAt||row.occurredAt,description:`Venda reembolsada · ${row.productName}`,type:'Estorno',status:'Reembolsado',amountCents:gross(row),currency:row.currency,affectsBalance:false})
  if(row.status==='chargeback')rows.push({id:row.transactionId,date:row.updatedAt||row.occurredAt,description:`Contestação · ${row.productName}`,type:'Contestação',status:'Contestado',amountCents:gross(row),currency:row.currency,affectsBalance:false})
 }
 for(const payout of payouts){
  const date=payout.arrivalDate||payout.createdAt
  if(!date)continue
  const when=new Date(date)
  if(when<bounds.start||when>bounds.end)continue
  const last4=payout.destination?.last4
  rows.push({id:payout.id,date,description:last4?`Repasse para a conta final ${last4}`:'Repasse para a conta bancária',type:'Saída',status:PAYOUT_STATUS_LABEL[payout.status],amountCents:-payout.amountCents,currency:payout.currency,affectsBalance:payout.status!=='failed'&&payout.status!=='canceled'})
 }
 return rows.sort((a,b)=>b.date.localeCompare(a.date))
}

export const ledgerCsv=(rows:LedgerRow[])=>rows.map(row=>({data:new Date(row.date).toLocaleString('pt-BR'),descricao:row.description,tipo:row.type,status:row.status,moeda:row.currency,valor:(row.amountCents/100).toFixed(2),conta_no_saldo:row.affectsBalance?'sim':'não',referencia:row.id}))

export type RevenuePoint={label:string;revenueCents:number;sales:number}

export function revenueSeries(transactions:FinancialTransaction[],bounds:{start:Date;end:Date},currency=PRIMARY_CURRENCY):RevenuePoint[]{
 const approved=transactions.filter(row=>row.currency===currency&&row.status==='approved')
 const span=bounds.end.getTime()-bounds.start.getTime(),hourly=span<=36*60*60*1000
 const points:RevenuePoint[]=[],index=new Map<string,RevenuePoint>()
 const keyOf=(date:Date)=>hourly?`${date.toDateString()} ${date.getHours()}`:date.toDateString()
 const cursor=new Date(bounds.start)
 while(cursor<=bounds.end&&points.length<400){
  const point={label:hourly?`${String(cursor.getHours()).padStart(2,'0')}h`:cursor.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),revenueCents:0,sales:0}
  points.push(point);index.set(keyOf(cursor),point)
  if(hourly)cursor.setHours(cursor.getHours()+1);else cursor.setDate(cursor.getDate()+1)
 }
 for(const row of approved){const point=index.get(keyOf(new Date(row.occurredAt)));if(point){point.revenueCents+=gross(row);point.sales++}}
 return points
}

export type Breakdown={label:string;revenueCents:number;sales:number;share:number}

export function breakdownBy(transactions:FinancialTransaction[],pick:(row:FinancialTransaction)=>string,currency=PRIMARY_CURRENCY):Breakdown[]{
 const approved=transactions.filter(row=>row.currency===currency&&row.status==='approved'),total=sum(approved,gross)
 const groups=new Map<string,Breakdown>()
 for(const row of approved){const label=pick(row)||'Outros',current=groups.get(label)??{label,revenueCents:0,sales:0,share:0};current.revenueCents+=gross(row);current.sales++;groups.set(label,current)}
 return[...groups.values()].map(item=>({...item,share:total?item.revenueCents/total*100:0})).sort((a,b)=>b.revenueCents-a.revenueCents)
}

const METHOD_LABEL:Record<string,string>={card:'Cartão',credit_card:'Cartão',pix:'Pix',boleto:'Boleto'}
export const methodLabel=(value:string)=>METHOD_LABEL[value.toLowerCase()]??value
