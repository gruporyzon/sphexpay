import {z} from 'zod'
import {ConnectError,configuredAppUrl,findConnection,retrieveAndSync} from './connect.js'
import {getStripe,getStripeMode} from './client.js'

const inputSchema=z.object({checkoutId:z.uuid(),requestKey:z.uuid(),buyer:z.object({email:z.email().max(254),name:z.string().trim().min(2).max(120)}).strict()}).strict()
const unavailable=()=>new ConnectError('CHECKOUT_UNAVAILABLE',409,'Esta oferta não está disponível para pagamento.')
export function validateCheckoutId(value){
 if(!z.uuid().safeParse(value).success)throw new ConnectError('INVALID_CHECKOUT_INPUT',400,'Informe um checkout válido.')
 return value
}
export function feeConfiguration(amount){
 const raw=process.env.STRIPE_PLATFORM_FEE_BPS
 if(!raw||!/^\d+$/.test(raw)||Number(raw)>10000)throw new ConnectError('FEE_NOT_CONFIGURED',503,'A regra de taxa de pagamentos ainda não foi configurada.')
 return{fee:Math.floor(amount*Number(raw)/10000),rule:`bps:${Number(raw)}`}
}
export function validateCheckoutInput(input){
 const result=inputSchema.safeParse(input)
 if(!result.success)throw new ConnectError('INVALID_CHECKOUT_INPUT',400,'Informe checkout e dados do comprador válidos. Valores e contas são definidos pelo servidor.')
 return result.data
}
const one=async query=>{const {data,error}=await query.maybeSingle();if(error)throw new ConnectError('PAYMENT_STORAGE_ERROR',503,'Não foi possível consultar o pagamento.');return data}
export async function loadOffer(database,checkoutId){
 const c=await one(database.from('product_checkouts').select('*').eq('id',checkoutId).eq('status','published').is('deleted_at',null))
 if(!c?.published_version_id)throw unavailable()
 const v=await one(database.from('checkout_versions').select('offer_id').eq('id',c.published_version_id).eq('checkout_id',c.id).eq('seller_id',c.seller_id))
 if(!v)throw unavailable()
 const p=await one(database.from('products').select('id,name,seller_id,currency').eq('id',c.product_id).eq('seller_id',c.seller_id).eq('status','active').eq('active',true).is('deleted_at',null))
 const o=await one(database.from('product_offers').select('*').eq('id',v.offer_id).eq('product_id',c.product_id).eq('seller_id',c.seller_id).eq('status','active').is('deleted_at',null))
 const settings=await one(database.from('product_payment_settings').select('enabled_methods').eq('product_id',c.product_id).eq('seller_id',c.seller_id))
 if(!settings?.enabled_methods?.includes('card'))throw unavailable()
 if(!p||!o||o.billing_type!=='one_time'||o.installments!==1||o.setup_fee_cents||!Number.isSafeInteger(o.price_cents)||o.price_cents<=0||o.price_cents>99999999||!['BRL','USD','EUR'].includes(o.currency)||o.currency!==p.currency)throw unavailable()
 return{c,p,o}
}
export async function createCheckout(database,input,stripe=getStripe()){
 const value=validateCheckoutInput(input)
 const {c,p,o}=await loadOffer(database,value.checkoutId)
 const connection=await findConnection(database,c.seller_id)
 if(!connection)throw unavailable()
 const current=await retrieveAndSync(database,c.seller_id,connection,stripe)
 if(!current.stripe_charges_enabled||!current.stripe_payouts_enabled||current.stripe_capabilities?.card_payments!=='active')throw unavailable()
 // Live charging is a deliberate, separate release decision.
 if(getStripeMode()==='live'&&process.env.STRIPE_LIVE_PAYMENTS_ENABLED!=='true')throw new ConnectError('LIVE_PAYMENTS_DISABLED',503,'Pagamentos de produção ainda não foram habilitados.')
 const {fee,rule}=feeConfiguration(o.price_cents)
 const snapshot={request_key:value.requestKey,checkout_origin:configuredAppUrl(),checkout_id:c.id,product_id:p.id,seller_id:c.seller_id,stripe_account_id:connection.stripe_account_id,offer_id:o.id,product_name:p.name,amount_cents:o.price_cents,currency:o.currency,fee_cents:fee,fee_rule:rule,buyer_email:value.buyer.email,buyer_name:value.buyer.name}
 const {error}=await database.from('stripe_checkout_orders').upsert(snapshot,{onConflict:'request_key',ignoreDuplicates:true})
 if(error)throw new ConnectError('PAYMENT_STORAGE_ERROR',503,'Não foi possível reservar o pagamento.')
 const order=await one(database.from('stripe_checkout_orders').select('*').eq('request_key',value.requestKey))
 if(!order||order.checkout_id!==c.id||order.buyer_email!==value.buyer.email||order.buyer_name!==value.buyer.name||order.stripe_account_id!==connection.stripe_account_id)throw new ConnectError('IDEMPOTENCY_CONFLICT',409,'Esta tentativa pertence a outro pedido.')
 if(order.session_id){const session=await stripe.checkout.sessions.retrieve(order.session_id,{},{stripeAccount:order.stripe_account_id});if(session.status!=='open'||!session.url)throw new ConnectError('CHECKOUT_CLOSED',409,'Este pagamento já foi concluído ou expirou.');return{url:session.url}}
 if(!order.checkout_origin||!Number.isFinite(new Date(order.created_at).getTime())||Date.now()-new Date(order.created_at).getTime()>23*3600000)throw new ConnectError('PAYMENT_RECONCILIATION_REQUIRED',409,'Esta tentativa precisa ser reconciliada antes de continuar.')
 const origin=order.checkout_origin,metadata={sphex_order_id:order.id,sphex_product_id:order.product_id,sphex_seller_id:order.seller_id}
 const session=await stripe.checkout.sessions.create({mode:'payment',payment_method_types:['card'],customer_email:order.buyer_email,client_reference_id:order.id,metadata,
  line_items:[{quantity:1,price_data:{currency:order.currency.toLowerCase(),unit_amount:order.amount_cents,product_data:{name:order.product_name}}}],
  payment_intent_data:{metadata,...(order.fee_cents?{application_fee_amount:order.fee_cents}:{})},
  success_url:`${origin}/pay/${order.checkout_id}?result=returned`,cancel_url:`${origin}/pay/${order.checkout_id}?result=cancelled`
 },{stripeAccount:order.stripe_account_id,idempotencyKey:`sphex-checkout-${order.id}`})
 const saved=await database.from('stripe_checkout_orders').update({session_id:session.id,updated_at:new Date().toISOString()}).eq('id',order.id)
 if(saved.error)throw new ConnectError('PAYMENT_STORAGE_ERROR',503,'Não foi possível concluir a reserva. Tente novamente.')
 return{url:session.url}
}

export async function configureProductPayments(database,user,input,stripe){
 const parsed=z.object({productId:z.uuid(),enabled:z.boolean()}).strict().safeParse(input)
 if(!parsed.success)throw new ConnectError('INVALID_PAYMENT_SETTINGS',400,'Configuração de pagamento inválida.')
 const {productId,enabled}=parsed.data
 const product=await one(database.from('products').select('id').eq('id',productId).eq('seller_id',user.id).is('deleted_at',null))
 if(!product)throw new ConnectError('PRODUCT_NOT_FOUND',404,'Produto não encontrado.')
 let current
 if(enabled){
  const connection=await findConnection(database,user.id)
  if(!connection)throw unavailable()
  current=await retrieveAndSync(database,user.id,connection,stripe||getStripe())
  if(!current.stripe_charges_enabled||!current.stripe_payouts_enabled||current.stripe_capabilities?.card_payments!=='active')throw unavailable()
 }
 const existing=await one(database.from('product_payment_settings').select('enabled_methods,capabilities').eq('product_id',productId).eq('seller_id',user.id))
 const methods=[...new Set([...(existing?.enabled_methods||[]).filter(method=>method!=='card'),...(enabled?['card']:[])])]
 const {error}=await database.from('product_payment_settings').upsert({product_id:productId,seller_id:user.id,enabled_methods:methods,capabilities:{...existing?.capabilities,...(current?{stripe:current.stripe_capabilities}:{})},updated_at:new Date().toISOString()},{onConflict:'product_id'})
 if(error)throw new ConnectError('PAYMENT_STORAGE_ERROR',503,'Não foi possível salvar os métodos de pagamento.')
 return{enabled}
}
