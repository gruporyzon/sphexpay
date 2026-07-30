import type { Currency,TransactionStatus } from '../lib/dashboardFinance'
import type { DemoConfig,DemoCountryCode,DemoPaymentMethod,DemoProduct,DemoSession,DemoTransaction,DemoWeightedOption } from './types'

const DAY=86_400_000
const naturalPrices=[2990,4700,6700,9700,14700,19700,29700,49700,99700]
const customers=[
 ['Mariana Alves','BR','São Paulo'],['Lucas Ribeiro','BR','Belo Horizonte'],['Ana Carvalho','PT','Lisboa'],
 ['Rafael Martins','BR','Curitiba'],['Camila Souza','BR','Recife'],['Sofia Martin','FR','Paris'],
 ['Daniel Wilson','US','Austin'],['Elena García','ES','Madri'],['Noah Smith','GB','Londres'],['Laura Moretti','IT','Milão'],
 ['Emma Fischer','DE','Berlim'],['Liam Murphy','IE','Dublin'],['Olivia Meier','CH','Zurique'],['Mia de Vries','NL','Amsterdã']
] as const
export const demoCountries:Record<DemoCountryCode,{name:string;city:string}>={
 BR:{name:'Brasil',city:'São Paulo'},US:{name:'Estados Unidos',city:'Nova York'},CA:{name:'Canadá',city:'Toronto'},
 PT:{name:'Portugal',city:'Lisboa'},GB:{name:'Reino Unido',city:'Londres'},FR:{name:'França',city:'Paris'},
 DE:{name:'Alemanha',city:'Berlim'},ES:{name:'Espanha',city:'Madri'},IT:{name:'Itália',city:'Milão'},
 NL:{name:'Países Baixos',city:'Amsterdã'},IE:{name:'Irlanda',city:'Dublin'},CH:{name:'Suíça',city:'Zurique'}
}
export const demoExchangeRates={BRL:1,USD:0.19,EUR:0.17} as const
export const fallbackDemoProducts:DemoProduct[]=[
 {id:'demo-product-start',name:'Curso Sphex Start',priceCents:9700,currency:'BRL',active:true,fallback:true},
 {id:'demo-product-escala',name:'Mentoria Escala',priceCents:49700,currency:'BRL',active:true,fallback:true},
 {id:'demo-product-premium',name:'Comunidade Premium',priceCents:19700,currency:'BRL',active:true,fallback:true},
 {id:'demo-product-performance',name:'Plano Performance',priceCents:29700,currency:'BRL',active:true,fallback:true}
]

const weighted=<T extends string>(ids:readonly T[],weights:number[]):DemoWeightedOption<T>[]=>ids.map((id,index)=>({id,enabled:weights[index]>0,weight:weights[index]}))
export const defaultModePushConfig=()=>({
 enabled:true,approved:true,methods:['Pix','Cartão de crédito','Boleto','Assinatura'] as DemoPaymentMethod[],
 destination:'all' as const,deviceIds:[],vary:true,frequency:'each' as const,maxPerSession:100,enabledAt:''
})
const baseConfig:DemoConfig={
 preset:'normal',initialSales:360,minFrequency:8,maxFrequency:18,frequencyUnit:'seconds',minAmountCents:4700,maxAmountCents:49700,targetTicketCents:19700,memoryLimit:1200,
 peakStartHour:19,peakEndHour:22,peakMultiplier:1.8,peakDurationMinutes:90,graphSpeed:1,awardMultiplier:1,approvalRate:82,declinedRate:8,pendingRate:7,refundRate:2,chargebackRate:1,
 methods:weighted(['Pix','Cartão de crédito','Boleto','Assinatura'] as const,[50,35,10,5]),
 currencies:weighted(['BRL','USD','EUR'] as const,[80,10,10]),
 countries:weighted(Object.keys(demoCountries) as DemoCountryCode[],[55,12,4,7,5,3,3,3,2,2,2,2]),
 useProductPrices:true,adaptive:true,sessionGoalCents:3_000_000,pushNotifications:defaultModePushConfig()
}
const config=(changes:Partial<DemoConfig>):DemoConfig=>({...baseConfig,...changes,methods:changes.methods??baseConfig.methods.map(item=>({...item})),currencies:changes.currencies??baseConfig.currencies.map(item=>({...item})),countries:changes.countries??baseConfig.countries.map(item=>({...item})),pushNotifications:{...baseConfig.pushNotifications,...changes.pushNotifications,methods:changes.pushNotifications?.methods??[...baseConfig.pushNotifications.methods],deviceIds:changes.pushNotifications?.deviceIds??[]}})
export const demoPresets:Record<Exclude<DemoConfig['preset'],'custom'>,DemoConfig>={
 light:config({preset:'light',initialSales:180,minFrequency:25,maxFrequency:55,minAmountCents:4700,maxAmountCents:29700,targetTicketCents:9700,peakMultiplier:1.25,graphSpeed:.7}),
 normal:config({preset:'normal'}),
 high:config({preset:'high',initialSales:650,minFrequency:5,maxFrequency:11,minAmountCents:6700,maxAmountCents:99700,targetTicketCents:29700,approvalRate:86,declinedRate:6,pendingRate:5,refundRate:2,chargebackRate:1,graphSpeed:1.5}),
 launch:config({preset:'launch',initialSales:480,minFrequency:6,maxFrequency:16,minAmountCents:9700,maxAmountCents:99700,targetTicketCents:29700,peakMultiplier:2.2,approvalRate:88,declinedRate:5,pendingRate:4,refundRate:2,chargebackRate:1,graphSpeed:1.7}),
 peak:config({preset:'peak',initialSales:800,minFrequency:5,maxFrequency:8,minAmountCents:9700,maxAmountCents:99700,targetTicketCents:49700,peakMultiplier:2.5,graphSpeed:2}),
 subscriptions:config({preset:'subscriptions',initialSales:320,minFrequency:12,maxFrequency:28,methods:weighted(['Pix','Cartão de crédito','Boleto','Assinatura'] as const,[15,25,5,55]),approvalRate:84,declinedRate:8,pendingRate:5,refundRate:2,chargebackRate:1}),
 international:config({preset:'international',initialSales:500,minFrequency:7,maxFrequency:16,currencies:weighted(['BRL','USD','EUR'] as const,[25,40,35]),countries:weighted(Object.keys(demoCountries) as DemoCountryCode[],[10,22,8,12,10,8,8,7,5,4,3,3]),targetTicketCents:29700,graphSpeed:1.3})
}
export const defaultDemoConfig=()=>structuredClone(demoPresets.normal)

export function validateDemoConfig(value:DemoConfig){
 const errors:string[]=[]
 if(!Number.isInteger(value.initialSales)||value.initialSales<30||value.initialSales>2000)errors.push('A quantidade inicial deve ficar entre 30 e 2.000.')
 if(!Number.isFinite(value.minFrequency)||!Number.isFinite(value.maxFrequency)||value.minFrequency<=0||value.minFrequency>value.maxFrequency)errors.push('A frequência mínima não pode superar a máxima.')
 if(!Number.isInteger(value.minAmountCents)||!Number.isInteger(value.maxAmountCents)||value.minAmountCents<100||value.minAmountCents>value.maxAmountCents)errors.push('O valor mínimo não pode superar o máximo.')
 if(value.memoryLimit<100||value.memoryLimit>2000)errors.push('O limite de memória deve ficar entre 100 e 2.000.')
 const check=(items:Array<{enabled:boolean;weight:number}>,label:string)=>{const total=items.filter(item=>item.enabled).reduce((sum,item)=>sum+item.weight,0);if(Math.abs(total-100)>.01)errors.push(`Os pesos de ${label} devem totalizar 100%.`)}
 check(value.methods,'pagamento');check(value.currencies,'moedas');check(value.countries,'países')
 const statusTotal=value.approvalRate+value.declinedRate+value.pendingRate+value.refundRate+value.chargebackRate
 if(Math.abs(statusTotal-100)>.01)errors.push('As taxas de status devem totalizar 100%.')
 return errors
}

export function seedFromSession(id:string){let value=2166136261;for(const char of id){value^=char.charCodeAt(0);value=Math.imul(value,16777619)}return value>>>0}
export function createSeededGenerator(seed:number){let state=seed>>>0;return()=>{state+=0x6D2B79F5;let value=state;value=Math.imul(value^value>>>15,value|1);value^=value+Math.imul(value^value>>>7,value|61);return((value^value>>>14)>>>0)/4294967296}}
const pick=<T>(items:readonly T[],random:()=>number)=>items[Math.min(items.length-1,Math.floor(random()*items.length))]
export function selectWeighted<T extends string>(items:DemoWeightedOption<T>[],random:()=>number):T{
 const active=items.filter(item=>item.enabled&&item.weight>0),total=active.reduce((sum,item)=>sum+item.weight,0),roll=random()*total
 let cursor=0
 for(const item of active){cursor+=item.weight;if(roll<=cursor)return item.id}
 return active.at(-1)?.id??items[0].id
}
const statusFor=(configValue:DemoConfig,method:DemoPaymentMethod,random:()=>number,history:boolean):TransactionStatus=>{
 if(!history&&(method==='Boleto'||random()<configValue.pendingRate/100))return'pending'
 const roll=random()*100
 if(roll<configValue.approvalRate)return history?'approved':'pending'
 if(roll<configValue.approvalRate+configValue.declinedRate)return'declined'
 if(roll<configValue.approvalRate+configValue.declinedRate+configValue.pendingRate)return'pending'
 if(roll<100-configValue.chargebackRate)return'refunded'
 return'chargeback'
}
const naturalAmount=(settings:DemoConfig,random:()=>number)=>{
 const candidates=naturalPrices.filter(value=>value>=settings.minAmountCents&&value<=settings.maxAmountCents)
 if(candidates.length&&random()<.8)return pick(candidates,random)
 const value=settings.minAmountCents+random()*(settings.maxAmountCents-settings.minAmountCents)
 return Math.max(100,Math.round(value/100)*100)
}
const hourFactor=(settings:DemoConfig,date:Date)=>{
 const hour=date.getHours()+date.getMinutes()/60,start=settings.peakStartHour,end=settings.peakEndHour
 const center=(start+end)/2,distance=Math.abs(hour-center),radius=Math.max(1,(end-start)/2)
 const peak=Math.max(0,1-distance/(radius+2))
 const daily=hour<6?.45:hour<11?.85:hour<14?1.05:hour<18?1.12:hour<23?1.2:.65
 return daily*(1+(settings.peakMultiplier-1)*peak)
}
function transaction(session:Pick<DemoSession,'sessionId'|'products'|'config'|'seed'>,random:()=>number,at:Date,index:number,history:boolean):DemoTransaction{
 const settings=session.config,method=selectWeighted(settings.methods,random),status=statusFor(settings,method,random,history),countryCode=selectWeighted(settings.countries,random)
 const customer=pick(customers.filter(item=>item[1]===countryCode),random)??pick(customers,random),country=demoCountries[countryCode]
 const currency=selectWeighted(settings.currencies,random),product=pick(session.products.length?session.products:fallbackDemoProducts,random)
 const reference=settings.useProductPrices&&product.currency===currency?product.priceCents:naturalAmount(settings,random)
 const amountCents=Math.max(settings.minAmountCents,Math.min(settings.maxAmountCents,reference)),discountCents=random()<.12?Math.round(amountCents*(random()<.7?.1:.15)):0,grossAmountCents=amountCents+discountCents
 const feeRate=method==='Pix'?.0099:method==='Boleto'?.0179:method==='Assinatura'?.0299:.0399,feeCents=status==='approved'?Math.round(amountCents*feeRate):0
 const createdAt=at.toISOString(),id=`demo-${session.sessionId.slice(-8)}-${at.getTime().toString(36)}-${index}`,customerId=`demo-customer-${seedFromSession(`${customer[0]}:${countryCode}`).toString(36)}`
 return{transactionId:id,demo:true,source:'mode',eventId:`event-${id}`,ownerId:undefined,productId:product.fallback?null:product.id,productName:product.name,productPriceCents:product.priceCents,buyerName:customer[0],customerId,customerDisplayName:customer[0],customerEmail:`cliente${String(seedFromSession(customerId)%1000).padStart(3,'0')}@example.com`,countryCode,countryName:country.name,cityName:customer[2]||country.city,paymentMethod:method,status,amountCents,grossAmountCents,discountCents,feeCents,netAmountCents:status==='approved'?amountCents-feeCents:0,commissionCents:status==='approved'?Math.round(amountCents*.6):0,currency,occurredAt:createdAt,createdAt,approvedAt:status==='approved'?createdAt:undefined,updatedAt:createdAt}
}
export function createHistory(session:Pick<DemoSession,'sessionId'|'seed'|'products'|'config'>,now=new Date()){
 const random=createSeededGenerator(session.seed),ledger:DemoTransaction[]=[],count=Math.max(30,Math.min(session.config.initialSales,session.config.memoryLimit))
 for(let index=0;index<count;index++){
  const day=index===0?30:Math.floor(random()*31),date=new Date(now.getTime()-day*DAY),hourRoll=random(),hour=hourRoll<.2?7+Math.floor(random()*4):hourRoll<.55?11+Math.floor(random()*6):17+Math.floor(random()*6)
  date.setHours(hour,Math.floor(random()*60),Math.floor(random()*60),0);if(date>now)date.setTime(now.getTime()-Math.floor(random()*3_600_000))
  ledger.push(transaction(session,random,date,index,true))
 }
 return ledger.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,session.config.memoryLimit)
}
export function generateNextEvent(session:DemoSession,now=new Date()){
 const eventSeed=session.seed^session.eventCount^Math.floor(now.getTime()/1000)
 return transaction(session,createSeededGenerator(eventSeed),now,session.eventCount,false)
}
export const createLiveTransaction=generateNextEvent
export function reconcileDemoLedger(ledger:DemoTransaction[],now=new Date(),settings:DemoConfig=defaultDemoConfig()){
 let approved:DemoTransaction|undefined
 const next=ledger.map(item=>{
  if(item.status!=='pending')return item
  const age=now.getTime()-new Date(item.createdAt).getTime(),delay=item.paymentMethod==='Pix'?3500:item.paymentMethod==='Boleto'?45_000:item.paymentMethod==='Assinatura'?12_000:8500
  if(age<delay)return item
  const random=createSeededGenerator(seedFromSession(item.transactionId)),status:TransactionStatus=random()*100<settings.approvalRate?'approved':random()*100<settings.declinedRate*2?'declined':'pending'
  if(status==='pending')return item
  const feeRate=item.paymentMethod==='Pix'?.0099:item.paymentMethod==='Boleto'?.0179:item.paymentMethod==='Assinatura'?.0299:.0399,feeCents=status==='approved'?Math.round(item.amountCents*feeRate):0
  const updated={...item,status,feeCents,netAmountCents:status==='approved'?item.amountCents-feeCents:0,commissionCents:status==='approved'?Math.round(item.amountCents*.6):0,approvedAt:status==='approved'?now.toISOString():undefined,updatedAt:now.toISOString()}
  if(status==='approved')approved=updated
  return updated
 })
 return{ledger:next,approved}
}
export function calculateDynamicInterval(session:Pick<DemoSession,'seed'|'eventCount'|'config'|'intensity'>,now=new Date()){
 const random=createSeededGenerator(session.seed^session.eventCount),settings=session.config,unit=settings.frequencyUnit==='minutes'?60_000:1000
 const base=(settings.minFrequency+random()*(settings.maxFrequency-settings.minFrequency))*unit
 const adaptive=settings.adaptive?(1+.12*Math.sin(session.eventCount/5)):1
 return Math.max(1000,Math.round(base/(hourFactor(settings,now)*Math.max(.25,session.intensity)*Math.max(.25,settings.graphSpeed)*adaptive)))
}
export const nextDemoDelay=(session:DemoSession)=>calculateDynamicInterval(session)
export function convertDemoCents(amount:number,source:Currency,target:Currency,rates:Record<Currency,number>=demoExchangeRates){
 if(source===target)return amount
 const brl=amount/rates[source]
 return Math.round(brl*rates[target])
}
