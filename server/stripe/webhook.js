import {getStripe,getStripeMode} from './client.js'
import {retrieveAndSync} from './connect.js'

const paymentEvents=new Set(['payment_intent.succeeded','payment_intent.payment_failed','charge.succeeded','charge.failed','charge.refunded','checkout.session.completed'])
const id=value=>typeof value==='string'?value:value?.id
export async function readRawBody(request){
 // Read the stream without accessing Vercel's parsed request.body getter.
 const chunks=[];let size=0
 for await(const chunk of request){const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=buffer.length;if(size>1024*1024)throw new Error('BODY_TOO_LARGE');chunks.push(buffer)}
 return Buffer.concat(chunks)
}
export function verifyStripeEvent(raw,signature,stripe=getStripe()){
 if(!process.env.STRIPE_WEBHOOK_SECRET)throw new Error('STRIPE_WEBHOOK_NOT_CONFIGURED')
 return stripe.webhooks.constructEvent(raw,signature,process.env.STRIPE_WEBHOOK_SECRET)
}
const one=async query=>{const {data,error}=await query.maybeSingle();if(error)throw new Error('STRIPE_STORAGE_FAILED');return data}
export async function processStripeEvent(database,event,stripe=getStripe()){
 if(typeof event.livemode!=='boolean'||event.livemode!==(getStripeMode()==='live'))return{ignored:true}
 const seen=await one(database.from('stripe_webhook_events').select('event_id').eq('event_id',event.id))
 if(seen)return{duplicate:true}
 if(event.type==='account.updated'){
  const accountId=event.data.object.id
  if(event.account&&event.account!==accountId)throw new Error('STRIPE_ACCOUNT_MISMATCH')
  const connection=await one(database.from('stripe_connected_accounts').select('*').eq('stripe_account_id',accountId).eq('stripe_mode',getStripeMode()))
  if(!connection)return{ignored:true}
  // Always fetch authoritative status; old snapshots must not undo onboarding.
  await retrieveAndSync(database,connection.user_id,connection,stripe)
  const {error}=await database.from('stripe_webhook_events').upsert({event_id:event.id,event_type:event.type,stripe_account_id:accountId},{onConflict:'event_id',ignoreDuplicates:true})
  if(error)throw new Error('STRIPE_STORAGE_FAILED')
  return{processed:true}
 }
 if(!paymentEvents.has(event.type))return{ignored:true}
 if(!event.account)return{ignored:true} // Direct charges require the connected account context.
 const object=event.data.object
 const intentId=event.type.startsWith('payment_intent.')?object.id:id(object.payment_intent)
 if(!intentId)return{ignored:true}
 const connection=await one(database.from('stripe_connected_accounts').select('*').eq('stripe_account_id',event.account).eq('stripe_mode',getStripeMode()))
 if(!connection)return{ignored:true}
 const intent=await stripe.paymentIntents.retrieve(intentId,{expand:['latest_charge']},{stripeAccount:event.account})
 const orderId=intent.metadata?.sphex_order_id
 if(!orderId)return{ignored:true} // Do not import unrelated merchant sales.
 const order=await one(database.from('stripe_checkout_orders').select('*').eq('id',orderId))
 if(!order)throw new Error('STRIPE_ORDER_MISSING')
 const charge=typeof intent.latest_charge==='object'?intent.latest_charge:null
 if(order.stripe_account_id!==event.account||order.seller_id!==intent.metadata.sphex_seller_id||order.product_id!==intent.metadata.sphex_product_id||order.amount_cents!==intent.amount||order.currency.toLowerCase()!==intent.currency||(intent.application_fee_amount||0)!==order.fee_cents||Boolean(intent.livemode)!==Boolean(event.livemode))throw new Error('STRIPE_PAYMENT_MISMATCH')
 // Metadata alone does not prove this intent was created by our Checkout.
 // A webhook racing the session write must retry without consuming the event.
 if(!order.session_id)throw new Error('STRIPE_SESSION_PENDING')
 const session=await stripe.checkout.sessions.retrieve(order.session_id,{},{stripeAccount:event.account})
 if(session.id!==order.session_id||session.mode!=='payment'||session.client_reference_id!==order.id||id(session.payment_intent)!==intent.id)throw new Error('STRIPE_SESSION_MISMATCH')
 let status=intent.status==='succeeded'?'approved':intent.status==='requires_payment_method'&&intent.last_payment_error?'declined':'pending'
 const refunded=charge?.amount_refunded||0
 if(refunded===order.amount_cents)status='refunded'
 const {data,error}=await database.rpc('apply_stripe_payment',{p_order_id:order.id,p_event_id:event.id,p_event_type:event.type,p_account:event.account,p_intent:intent.id,p_charge:id(intent.latest_charge)||null,p_status:status,p_refunded:refunded,p_occurred_at:new Date(event.created*1000).toISOString()})
 if(error)throw new Error('STRIPE_PERSISTENCE_FAILED')
 return data
}
export async function stripeWebhookHandler(request,response,databaseFactory,stripeFactory=getStripe){
 if(request.method!=='POST')return response.status(405).json({success:false,code:'METHOD_NOT_ALLOWED'})
 if(!process.env.STRIPE_WEBHOOK_SECRET)return response.status(503).json({success:false,code:'STRIPE_WEBHOOK_NOT_CONFIGURED'})
 let stripe
 try{stripe=stripeFactory()}catch{return response.status(503).json({success:false,code:'STRIPE_NOT_CONFIGURED'})}
 let event
 try{event=verifyStripeEvent(await readRawBody(request),request.headers['stripe-signature'],stripe)}catch{return response.status(400).json({success:false,code:'INVALID_STRIPE_SIGNATURE'})}
 try{return response.status(200).json({success:true,...await processStripeEvent(databaseFactory(),event,stripe)})}
 catch{console.error('[Stripe webhook] processing_failed');return response.status(500).json({success:false,code:'STRIPE_PROCESSING_FAILED'})}
}
