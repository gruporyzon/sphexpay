import type { Currency,TransactionStatus } from '../lib/dashboardFinance'
import type { DemoProduct,DemoSession,DemoTransaction } from './types'

const DAY=86_400_000
const names=['Mariana Alves','Lucas Ribeiro','Ana Carvalho','Rafael Martins','Camila Souza','Sofia Martin','Daniel Wilson','Elena García','Noah Smith','Laura Moretti']
const methods=['Pix','Cartão de crédito','Pix','Cartão de crédito','Boleto'] as const
export const demoExchangeRates={BRL:1,USD:0.19,EUR:0.17} as const
export const fallbackDemoProducts:DemoProduct[]=[
 {id:'demo-product-start',name:'Curso Sphex Start',priceCents:9700,currency:'BRL',active:true,fallback:true},
 {id:'demo-product-escala',name:'Mentoria Escala',priceCents:49700,currency:'BRL',active:true,fallback:true},
 {id:'demo-product-premium',name:'Comunidade Premium',priceCents:19700,currency:'BRL',active:true,fallback:true},
 {id:'demo-product-performance',name:'Plano Performance',priceCents:29700,currency:'BRL',active:true,fallback:true}
]

export function seedFromSession(id:string){
 let value=2166136261
 for(const char of id){value^=char.charCodeAt(0);value=Math.imul(value,16777619)}
 return value>>>0
}

export function createSeededGenerator(seed:number){
 let state=seed>>>0
 return()=>{state+=0x6D2B79F5;let value=state;value=Math.imul(value^value>>>15,value|1);value^=value+Math.imul(value^value>>>7,value|61);return((value^value>>>14)>>>0)/4294967296}
}

const pick=<T>(items:readonly T[],random:()=>number)=>items[Math.floor(random()*items.length)]
const statusFor=(method:string,random:()=>number,history:boolean):TransactionStatus=>{
 const roll=random()
 if(method==='Boleto'&&(!history||roll<.42))return'pending'
 if(roll<.035)return'declined'
 if(history&&roll>.992)return'chargeback'
 if(history&&roll>.978)return'refunded'
 return history?'approved':'pending'
}

function transaction(session:Pick<DemoSession,'sessionId'|'products'>,random:()=>number,at:Date,index:number,history:boolean):DemoTransaction{
 const product=pick(session.products.length?session.products:fallbackDemoProducts,random)
 const method=pick(methods,random),status=statusFor(method,random,history)
 const discountCents=random()<.14?Math.round(product.priceCents*(random()<.7?.1:.15)):0
 const grossAmountCents=product.priceCents,amountCents=Math.max(100,grossAmountCents-discountCents)
 const feeRate=method==='Pix'?.0099:method==='Boleto'?.0179:.0399
 const feeCents=status==='approved'?Math.round(amountCents*feeRate):0
 const customerIndex=Math.floor(random()*names.length),createdAt=at.toISOString()
 const id=`demo-${session.sessionId.slice(-8)}-${at.getTime().toString(36)}-${index}`
 return{transactionId:id,demo:true,eventId:`event-${id}`,ownerId:undefined,productId:product.fallback?null:product.id,productName:product.name,productPriceCents:product.priceCents,buyerName:names[customerIndex],customerDisplayName:names[customerIndex],customerEmail:`cliente${String(customerIndex+1).padStart(3,'0')}@example.com`,paymentMethod:method,status,amountCents,grossAmountCents,discountCents,feeCents,netAmountCents:status==='approved'?amountCents-feeCents:0,currency:product.currency,occurredAt:createdAt,createdAt,approvedAt:status==='approved'?new Date(at.getTime()+(method==='Pix'?3000:12000)).toISOString():undefined,updatedAt:createdAt}
}

export function createHistory(session:Pick<DemoSession,'sessionId'|'seed'|'products'>,now=new Date()){
 const random=createSeededGenerator(session.seed),ledger:DemoTransaction[]=[]
 for(let offset=30;offset>=0;offset--){
  const date=new Date(now.getTime()-offset*DAY),weekday=date.getDay(),base=weekday===0?4:weekday===6?7:9
  const count=base+Math.floor(random()*7)
  for(let index=0;index<count;index++){
   const peak=random()<.68,hour=peak?(random()<.52?9+Math.floor(random()*5):17+Math.floor(random()*5)):6+Math.floor(random()*17)
   date.setHours(hour,Math.floor(random()*60),Math.floor(random()*60),0)
   if(date>now)continue
   ledger.push(transaction(session,random,new Date(date),index,true))
  }
 }
 return ledger.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,600)
}

export function createLiveTransaction(session:DemoSession,now=new Date()){
 const eventSeed=session.seed^session.ledger.length^Math.floor(now.getTime()/1000)
 return transaction(session,createSeededGenerator(eventSeed),now,session.ledger.length,false)
}

export function reconcileDemoLedger(ledger:DemoTransaction[],now=new Date()){
 let approved:DemoTransaction|undefined
 const next=ledger.map(item=>{
  if(item.status!=='pending')return item
  const age=now.getTime()-new Date(item.createdAt).getTime()
  const delay=item.paymentMethod==='Pix'?3500:item.paymentMethod==='Boleto'?45_000:8500
  if(age<delay)return item
  const random=createSeededGenerator(seedFromSession(item.transactionId))
  const status:TransactionStatus=item.paymentMethod==='Boleto'&&random()<.55?'pending':random()<.075?'declined':'approved'
  if(status==='pending')return item
  const feeRate=item.paymentMethod==='Pix'?.0099:item.paymentMethod==='Boleto'?.0179:.0399
  const feeCents=status==='approved'?Math.round(item.amountCents*feeRate):0
  const updated={...item,status,feeCents,netAmountCents:status==='approved'?item.amountCents-feeCents:0,approvedAt:status==='approved'?now.toISOString():undefined,updatedAt:now.toISOString()}
  if(status==='approved')approved=updated
  return updated
 })
 return{ledger:next,approved}
}

export function nextDemoDelay(session:DemoSession){
 const random=createSeededGenerator(session.seed^session.ledger.length)
 const hour=new Date().getHours(),peak=(hour>=9&&hour<=13)||(hour>=17&&hour<=21)
 return Math.round((peak?4+random()*6:7+random()*7)*1000)
}

export function convertDemoCents(amount:number,source:Currency,target:Currency){
 if(source===target)return amount
 const brl=amount/demoExchangeRates[source]
 return Math.round(brl*demoExchangeRates[target])
}
