import { notifyConfirmedFinancialEvent } from '../push/financial-events.js'

const supportedStatuses=new Set(['approved','pending','declined','refunded','chargeback'])
const supportedEvents=new Set([
 'payment_created','payment_pending','payment_approved','payment_declined',
 'payment_refunded','payment_chargeback','pix_created','pix_paid',
 'card_approved','card_declined','boleto_created','boleto_paid',
 'subscription_approved','subscription_renewed'
])
const text=(value,max=180)=>typeof value==='string'?value.trim().slice(0,max):''
const integer=value=>Number.isSafeInteger(Number(value))?Number(value):NaN

export function validatePaymentEvent(input){
 const value=input&&typeof input==='object'?input:{}
 const event={
  provider:text(value.provider,60),eventId:text(value.eventId),externalTransactionId:text(value.externalTransactionId),
  eventType:text(value.eventType,60),status:text(value.status,30),productId:text(value.productId,40),
  sellerId:text(value.sellerId,40),currency:text(value.currency,3).toUpperCase(),
  paymentMethod:text(value.paymentMethod,60),occurredAt:text(value.occurredAt,40),
  amounts:{
   grossCents:integer(value.amounts?.grossCents),discountCents:integer(value.amounts?.discountCents??0),
   finalCents:integer(value.amounts?.finalCents),feeCents:integer(value.amounts?.feeCents??0),
   commissionCents:integer(value.amounts?.commissionCents??0)
  },
  customer:{displayName:text(value.customer?.displayName,120)},
  rawMetadata:value.rawMetadata&&typeof value.rawMetadata==='object'?value.rawMetadata:{}
 }
 if(!event.provider||!event.eventId||!event.externalTransactionId||!event.productId||!event.sellerId
  ||!supportedEvents.has(event.eventType)||!supportedStatuses.has(event.status)
  ||!['BRL','USD','EUR'].includes(event.currency)||!event.occurredAt
  ||Object.values(event.amounts).some(amount=>!Number.isSafeInteger(amount)||amount<0)
  ||event.amounts.discountCents>event.amounts.grossCents
  ||event.amounts.finalCents!==event.amounts.grossCents-event.amounts.discountCents
  ||event.amounts.feeCents>event.amounts.finalCents){
  throw Object.assign(new Error('INVALID_PAYMENT_EVENT'),{code:'INVALID_PAYMENT_EVENT'})
 }
 return event
}

export async function processPaymentEvent({client,input,pushClient}){
 const event=validatePaymentEvent(input)
 const {data,error}=await client.rpc('process_payment_event',{input:event})
 if(error)throw Object.assign(new Error(error.message||'PAYMENT_PERSISTENCE_FAILED'),{code:error.code||'PAYMENT_PERSISTENCE_FAILED'})
 if(data?.duplicate||!data?.outboxEventType)return{...data,push:null}
 let push
 try{
  push=await notifyConfirmedFinancialEvent({
   client,userId:event.sellerId,eventId:`${event.eventId}:${data.outboxEventType}`,
   type:data.outboxEventType,currency:event.currency,
   commissionMinor:event.amounts.commissionCents,amountMinor:event.amounts.finalCents,
   metadata:{transactionId:data.publicTransactionId,productId:event.productId,type:data.outboxEventType,
    route:`/app/transacoes/${data.publicTransactionId}`,currency:event.currency,productName:data.productName},
   pushClient
  })
  await client.from('financial_event_outbox').update({
   status:push.success?'processed':'failed',attempts:1,last_error:push.success?null:push.code,
   processed_at:push.success?new Date().toISOString():null
  }).eq('event_id',`${event.eventId}:${data.outboxEventType}`)
 }catch(error){
  push={success:false,code:error?.code||'PUSH_DELIVERY_FAILED'}
  await client.from('financial_event_outbox').update({
   status:'failed',attempts:1,last_error:String(push.code).slice(0,180)
  }).eq('event_id',`${event.eventId}:${data.outboxEventType}`)
 }
 return{...data,push}
}
