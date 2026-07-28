import type { FinancialTransaction,TransactionStatus } from './dashboardFinance'

export type SalesRegion='América do Norte'|'Europa'|'América do Sul'|'Ásia'|'África'|'Oceania'
export type SalesCountry={
 id:string
 name:string
 flag:string
 coordinates:[number,number]
 region:SalesRegion
}
export type GlobalSaleEvent={
 transaction:FinancialTransaction
 country:SalesCountry
 activity:string
 statusLabel:string
 occurredAt:string
}

export const salesCountries:SalesCountry[]=[
 {id:'840',name:'Estados Unidos',flag:'🇺🇸',coordinates:[-98.5,39.8],region:'América do Norte'},
 {id:'840',name:'Estados Unidos',flag:'🇺🇸',coordinates:[-77.1,38.9],region:'América do Norte'},
 {id:'276',name:'Alemanha',flag:'🇩🇪',coordinates:[10.4,51.1],region:'Europa'},
 {id:'826',name:'Reino Unido',flag:'🇬🇧',coordinates:[-2.6,54.7],region:'Europa'},
 {id:'250',name:'França',flag:'🇫🇷',coordinates:[2.2,46.2],region:'Europa'},
 {id:'620',name:'Portugal',flag:'🇵🇹',coordinates:[-8.2,39.6],region:'Europa'},
 {id:'724',name:'Espanha',flag:'🇪🇸',coordinates:[-3.7,40.4],region:'Europa'},
 {id:'380',name:'Itália',flag:'🇮🇹',coordinates:[12.6,42.7],region:'Europa'},
 {id:'528',name:'Países Baixos',flag:'🇳🇱',coordinates:[5.3,52.1],region:'Europa'},
 {id:'056',name:'Bélgica',flag:'🇧🇪',coordinates:[4.6,50.6],region:'Europa'},
 {id:'372',name:'Irlanda',flag:'🇮🇪',coordinates:[-8,53.2],region:'Europa'},
 {id:'756',name:'Suíça',flag:'🇨🇭',coordinates:[8.2,46.8],region:'Europa'},
 {id:'124',name:'Canadá',flag:'🇨🇦',coordinates:[-106,56.1],region:'América do Norte'},
 {id:'076',name:'Brasil',flag:'🇧🇷',coordinates:[-51.9,-14.2],region:'América do Sul'},
 {id:'484',name:'México',flag:'🇲🇽',coordinates:[-102.5,23.6],region:'América do Norte'},
 {id:'392',name:'Japão',flag:'🇯🇵',coordinates:[138.3,36.2],region:'Ásia'},
 {id:'702',name:'Singapura',flag:'🇸🇬',coordinates:[103.8,1.35],region:'Ásia'},
 {id:'710',name:'África do Sul',flag:'🇿🇦',coordinates:[24,-29],region:'África'},
 {id:'036',name:'Austrália',flag:'🇦🇺',coordinates:[134.5,-25.7],region:'Oceania'}
]

const activities:Record<TransactionStatus,string[]>={
 approved:['Venda confirmada','Pagamento aprovado','Nova compra concluída','Transação processada'],
 pending:['Pagamento em processamento','Nova compra recebida'],
 declined:['Pagamento não aprovado'],
 refunded:['Reembolso processado'],
 chargeback:['Contestação registrada']
}

export function stableHash(value:string){
 let hash=2166136261
 for(const char of value){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}
 return hash>>>0
}

export function countryForTransaction(transaction:FinancialTransaction){
 const countryCode=(transaction as FinancialTransaction&{countryCode?:string}).countryCode
 if(countryCode){
  const byCode:Record<string,string>={BR:'076',US:'840',CA:'124',PT:'620',GB:'826',FR:'250',DE:'276',ES:'724',IT:'380',NL:'528',IE:'372',CH:'756'}
  const match=salesCountries.find(country=>country.id===byCode[countryCode])
  if(match)return match
 }
 return salesCountries[stableHash(transaction.transactionId)%salesCountries.length]
}

export function globalEventFromTransaction(transaction:FinancialTransaction):GlobalSaleEvent{
 const pool=activities[transaction.status]
 return{transaction,country:countryForTransaction(transaction),activity:pool[stableHash(`${transaction.transactionId}:activity`)%pool.length],statusLabel:transaction.status==='approved'?'Confirmada':transaction.status==='pending'?'Processando':transaction.status==='declined'?'Recusada':transaction.status==='refunded'?'Reembolsada':'Contestada',occurredAt:transaction.occurredAt}
}

export function regionTotals(events:GlobalSaleEvent[]){
 const regions:SalesRegion[]=['América do Norte','Europa','América do Sul','Ásia','África','Oceania']
 return regions.map(region=>({region,total:events.filter(event=>event.country.region===region).length}))
}

export function relativeSaleTime(value:string,now=Date.now()){
 const seconds=Math.max(0,Math.floor((now-new Date(value).getTime())/1000))
 if(seconds<3)return'agora'
 if(seconds<60)return`há ${seconds}s`
 const minutes=Math.floor(seconds/60)
 if(minutes<60)return`há ${minutes}min`
 const hours=Math.floor(minutes/60)
 return`há ${hours}h`
}
