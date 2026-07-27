import { createHmac,timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { serviceRoleKey,supabaseUrl } from '../push/config.js'
import { processPaymentEvent } from './process-payment-event.js'

const clean=value=>typeof value==='string'?value.trim():''
const signatureFor=(secret,body)=>createHmac('sha256',secret).update(body).digest('hex')
const validSignature=(secret,body,provided)=>{
 const expected=Buffer.from(signatureFor(secret,body),'utf8'),received=Buffer.from(clean(provided).replace(/^sha256=/i,''),'utf8')
 return expected.length===received.length&&timingSafeEqual(expected,received)
}

export default async function handler(request,response){
 if(request.method!=='POST')return response.status(405).json({success:false,code:'METHOD_NOT_ALLOWED'})
 const secret=clean(process.env.PAYMENT_WEBHOOK_SECRET),url=supabaseUrl(),key=serviceRoleKey()
 if(!secret||!url||!key)return response.status(503).json({success:false,code:'PAYMENT_WEBHOOK_NOT_CONFIGURED'})
 const rawBody=typeof request.body==='string'?request.body:JSON.stringify(request.body||{})
 if(!validSignature(secret,rawBody,request.headers['x-sphexpay-signature'])){
  return response.status(401).json({success:false,code:'INVALID_WEBHOOK_SIGNATURE'})
 }
 let input
 try{input=typeof request.body==='string'?JSON.parse(request.body):request.body}
 catch{return response.status(400).json({success:false,code:'INVALID_PAYMENT_EVENT'})}
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
 try{
  const result=await processPaymentEvent({client,input})
  return response.status(200).json({success:true,duplicate:Boolean(result.duplicate),transactionId:result.publicTransactionId})
 }catch(error){
  const invalid=error?.code==='INVALID_PAYMENT_EVENT'||error?.code==='22023'
  return response.status(invalid?400:500).json({success:false,code:invalid?'INVALID_PAYMENT_EVENT':'PAYMENT_PROCESSING_FAILED'})
 }
}
