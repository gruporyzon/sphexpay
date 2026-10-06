import {loadStripe} from '@stripe/stripe-js/pure'
import type {Stripe} from '@stripe/stripe-js'
import type {CheckoutBuyer} from './CheckoutExperience'

export type Session={clientSecret:string;sessionId:string;accountId:string;publishableKey:string;amountCents:number;currency:string;completed?:boolean}

const stripeClients=new Map<string,Promise<Stripe|null>>()
const inFlight=new Map<string,Promise<Session>>()
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i
function stored(key:string){try{return JSON.parse(sessionStorage.getItem(key)||'null')}catch{return null}}
function remember(key:string,value:unknown){try{sessionStorage.setItem(key,JSON.stringify(value))}catch{/* Retries still share a request while the page remains open. */}}
const memoryAttempts=new Map<string,{signature:string;key:string}>()
export async function reserveInlineCheckout(checkoutId:string,buyer:CheckoutBuyer,mode:string):Promise<Session>{
 const storageKey=`stripe-elements-attempt:${mode}:${checkoutId}`
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(buyer)))
 const signature=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')
 let attempt=memoryAttempts.get(storageKey)||stored(storageKey)
 if(attempt?.signature!==signature||!uuid.test(String(attempt?.key)))attempt={signature,key:crypto.randomUUID()}
 memoryAttempts.set(storageKey,attempt);remember(storageKey,attempt)
 const current=inFlight.get(attempt.key);if(current)return current
 const promise=(async()=>{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000)
  try{
   const response=await fetch('/api/stripe/checkout',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({checkoutId,requestKey:attempt.key,uiMode:'elements',buyer})})
   const data=await response.json()
   if(!response.ok){if(data.code==='CHECKOUT_CLOSED'){memoryAttempts.delete(storageKey);remember(storageKey,null)}throw new Error(data.message||'Não foi possível preparar o pagamento. Tente novamente.')}
   if(typeof data.sessionId!=='string'||!data.sessionId.startsWith('cs_'))throw new Error('A sessão de pagamento não pôde ser validada.')
   if(data.completed===true)return data as Session
   if(typeof data.clientSecret!=='string'||!data.clientSecret.startsWith('cs_')||!data.clientSecret.includes('_secret_')||typeof data.accountId!=='string'||!/^acct_[a-zA-Z\d]+$/.test(data.accountId)||typeof data.publishableKey!=='string'||!data.publishableKey.startsWith(`pk_${mode}_`))throw new Error('O formulário seguro de pagamento não pôde ser validado.')
   return data as Session
  }catch(error){if(error instanceof DOMException&&error.name==='AbortError')throw new Error('A preparação demorou mais que o esperado. Tente novamente com segurança.');throw error}
  finally{clearTimeout(timeout)}
 })()
 inFlight.set(attempt.key,promise);void promise.then(()=>inFlight.delete(attempt.key),()=>inFlight.delete(attempt.key));return promise
}
export function clearInlineCheckoutAttempt(checkoutId:string,mode:string){const key=`stripe-elements-attempt:${mode}:${checkoutId}`;memoryAttempts.delete(key);remember(key,null)}
export function paymentClient(session:Session){
 const key=`${session.publishableKey}:${session.accountId}`
 let client=stripeClients.get(key);if(!client){client=loadStripe(session.publishableKey,{stripeAccount:session.accountId,locale:'pt-BR'});stripeClients.set(key,client);void client.catch(()=>stripeClients.delete(key))}
 return client
}
