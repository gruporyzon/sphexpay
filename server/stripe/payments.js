import {z} from 'zod'
import {ConnectError,configuredAppUrl,findConnection,retrieveAndSync} from './connect.js'
import {getStripe,getStripeMode} from './client.js'

const UF=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const inputSchema=z.object({checkoutId:z.uuid(),requestKey:z.uuid(),uiMode:z.enum(['hosted','elements']).optional(),affiliateCode:z.string().regex(/^AFF-[A-Z0-9]{6,20}$/).optional(),couponCode:z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/).optional(),shipping:z.object({rateId:z.uuid(),address:z.object({postalCode:z.string().regex(/^\d{5}-?\d{3}$/),street:z.string().trim().min(2).max(120),number:z.string().trim().min(1).max(20),complement:z.string().trim().max(80).optional(),district:z.string().trim().min(2).max(80),city:z.string().trim().min(2).max(80),state:z.enum(UF)}).strict()}).strict().optional(),buyer:z.object({email:z.email().max(254),name:z.string().trim().min(2).max(120)}).strict()}).strict()
const one=async query=>{const {data,error}=await query.maybeSingle();if(error)throw new ConnectError('PAYMENT_STORAGE_ERROR',503,'Não foi possível consultar o pagamento.');return data}
const unavailable=()=>new ConnectError('CHECKOUT_UNAVAILABLE',409,'Esta oferta não está disponível para pagamento.')
export const PAYMENT_METHODS=['card','pix','boleto']
// Pix e boleto só em reais e dentro dos limites da Stripe Brasil (Pix: R$ 0,50 até ~US$ 3.000;
// boleto: R$ 5,00 a R$ 49.999,99). Cada método precisa estar ativo na conta conectada.
// Assinatura recorrente: cobrança automática só por cartão (Pix Automático não existe para
// empresas no Brasil; boleto exigiria fatura manual a cada ciclo).
export const RECURRING={month:{interval:'month',interval_count:1},quarter:{interval:'month',interval_count:3},semester:{interval:'month',interval_count:6},year:{interval:'year',interval_count:1}}
export function usableMethods(enabled,capabilities,offer){
 const on=new Set(offer.billing_type==='subscription'?(enabled||[]).filter(method=>method==='card'):enabled||[]),caps=capabilities||{},brl=offer.currency==='BRL',amount=offer.price_cents
 return PAYMENT_METHODS.filter(method=>on.has(method)&&(
  method==='card'?caps.card_payments==='active':
  method==='pix'?brl&&caps.pix_payments==='active'&&amount>=50&&amount<=1500000:
  brl&&caps.boleto_payments==='active'&&amount>=500&&amount<=4999999))
}
// Cobrança real (live) só para vendedor com verificação (KYC) aprovada.
async function kycApproved(database,sellerId){
 if(getStripeMode()!=='live')return true
 const profile=await one(database.from('kyc_profiles').select('status').eq('user_id',sellerId))
 return profile?.status==='approved'
}
const kycPending=()=>new ConnectError('SELLER_VERIFICATION_PENDING',409,'O vendedor ainda está concluindo a verificação da conta. Tente novamente mais tarde.')
export function validateCheckoutId(value){
 if(!z.uuid().safeParse(value).success)throw new ConnectError('INVALID_CHECKOUT_INPUT',400,'Informe um checkout válido.')
 return value
}
// Produto físico, venda única e vendedor com frete ativo: o comprador escolhe frete e informa o
// endereço. Sem frete cadastrado, o produto segue vendendo como antes (sem entrega).
export async function shippingRatesFor(database,product,offer){
 if(product.product_type!=='physical'||offer.billing_type!=='one_time')return[]
 const {data,error}=await database.from('shipping_rates').select('id,name,carrier,price_cents,min_order_cents,delivery_days_min,delivery_days_max').eq('seller_id',product.seller_id).eq('active',true).order('price_cents').limit(20)
 if(error)throw new ConnectError('PAYMENT_STORAGE_ERROR',503,'Não foi possível consultar as opções de entrega.')
 return(data||[]).filter(rate=>offer.price_cents>=Number(rate.min_order_cents||0))
}
const shippingInvalid=()=>new ConnectError('INVALID_SHIPPING',400,'Escolha uma opção de entrega e informe o endereço completo.')
// Cupom do produto: regras conferidas no servidor (status, datas, limites, oferta, assinatura,
// valor mínimo, métodos permitidos, limite por cliente e primeira compra). O desconto reduz o
// preço do produto; o uso só é contado quando o pagamento é aprovado (trigger no banco).
const COUPON_REASON={invalid:'Cupom inválido.',not_started:'Este cupom ainda não está valendo.',expired:'Este cupom expirou.',limit_reached:'Este cupom esgotou.',offer_not_allowed:'Este cupom não vale para esta oferta.',subscription_not_allowed:'Este cupom não vale para assinatura.',minimum_not_met:'O valor mínimo para este cupom não foi atingido.',payment_method_not_allowed:'Este cupom não vale para as formas de pagamento disponíveis.',customer_limit:'Você já usou este cupom o número máximo de vezes.',first_purchase_only:'Este cupom é só para a primeira compra.'}
const couponError=reason=>new ConnectError('COUPON_INVALID',409,COUPON_REASON[reason]||COUPON_REASON.invalid)
export async function applyCoupon(database,{sellerId,productId,offer,code,buyerEmail,methods}){
 if(!code)return null
 const coupon=await one(database.from('product_coupons').select('*').eq('product_id',productId).eq('seller_id',sellerId).eq('code',code.trim().toUpperCase()).eq('status','active').is('deleted_at',null))
 if(!coupon)throw couponError('invalid')
 const now=Date.now()
 if(coupon.starts_at&&now<new Date(coupon.starts_at).getTime())throw couponError('not_started')
 if(coupon.expires_at&&now>=new Date(coupon.expires_at).getTime())throw couponError('expired')
 if(coupon.total_limit&&coupon.uses_count>=coupon.total_limit)throw couponError('limit_reached')
 if(coupon.offer_ids?.length&&!coupon.offer_ids.includes(offer.id))throw couponError('offer_not_allowed')
 if(offer.billing_type==='subscription'&&coupon.allow_subscription===false)throw couponError('subscription_not_allowed')
 if(coupon.minimum_cents&&offer.price_cents<Number(coupon.minimum_cents))throw couponError('minimum_not_met')
 const allowed=coupon.allowed_methods?.length?methods.filter(method=>coupon.allowed_methods.includes(method)):methods
 if(!allowed.length)throw couponError('payment_method_not_allowed')
 if(buyerEmail&&(coupon.per_customer_limit||coupon.first_purchase_only)){
  const email=buyerEmail.trim().toLowerCase()
  if(coupon.per_customer_limit){const {count,error}=await database.from('stripe_checkout_orders').select('id',{count:'exact',head:true}).eq('coupon_id',coupon.id).eq('buyer_email',email).in('status',['approved','refunded']);if(error)throw new ConnectError('PAYMENT_STORAGE_ERROR',503,'Não foi possível validar o cupom.');if((count||0)>=coupon.per_customer_limit)throw couponError('customer_limit')}
  if(coupon.first_purchase_only){const {count,error}=await database.from('stripe_checkout_orders').select('id',{count:'exact',head:true}).eq('seller_id',sellerId).eq('buyer_email',email).in('status',['approved','refunded']);if(error)throw new ConnectError('PAYMENT_STORAGE_ERROR',503,'Não foi possível validar o cupom.');if((count||0)>0)throw couponError('first_purchase_only')}
 }
 const value=Number(coupon.discount_value)
 const discount=coupon.discount_type==='percentage'?Math.floor(offer.price_cents*Math.min(value,10000)/10000):Math.min(offer.price_cents,value)
 // A Stripe exige um valor mínimo por cobrança: o produto nunca fica abaixo de R$ 1,00 / US$ 1 / € 1.
 if(offer.price_cents-discount<100)throw couponError('invalid')
 return{couponId:coupon.id,code:coupon.code,discountCents:discount,methods:allowed}
}
export async function previewCoupon(database,checkoutId,code){
 if(typeof code!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(code))throw couponError('invalid')
 const {p,o,c,settings}=await loadOffer(database,checkoutId)
 const result=await applyCoupon(database,{sellerId:c.seller_id,productId:p.id,offer:o,code,methods:settings.enabled_methods.filter(method=>PAYMENT_METHODS.includes(method))})
 return{valid:true,code:result.code,discountCents:result.discountCents,finalCents:o.price_cents-result.discountCents}
}
// Afiliado do link (?ref=AFF-...): precisa estar ativo, ser do mesmo vendedor e ter o produto
// vinculado. Código inválido não bloqueia a compra, só não gera comissão. Autoindicação
// (mesmo e-mail do comprador) não gera comissão.
export async function resolveAffiliate(database,{sellerId,productId,code,buyerEmail,amountCents,currency}){
 if(!code)return null
 const affiliate=await one(database.from('affiliates').select('id,email,status').eq('merchant_id',sellerId).eq('public_id',code))
 if(!affiliate||affiliate.status!=='active')return null
 if(affiliate.email&&affiliate.email.trim().toLowerCase()===buyerEmail.trim().toLowerCase())return null
 const link=await one(database.from('affiliate_products').select('commission_type,commission_value,currency').eq('merchant_id',sellerId).eq('affiliate_id',affiliate.id).eq('product_id',productId))
 if(!link)return null
 const value=Number(link.commission_value)
 if(!Number.isFinite(value)||value<0)return null
 const cents=link.commission_type==='percentage'?Math.floor(amountCents*Math.min(value,100)/100):link.currency===currency?Math.trunc(value):null
 if(cents===null)return null
 return{affiliateId:affiliate.id,commissionCents:Math.min(cents,amountCents)}
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
export function checkoutPublishableKey(){
 const key=(process.env.VITE_STRIPE_PUBLISHABLE_KEY||process.env.STRIPE_PUBLISHABLE_KEY||'').trim()
 if(!key.startsWith(`pk_${getStripeMode()}_`))throw new ConnectError('STRIPE_PUBLIC_KEY_MISMATCH',503,'O formulário seguro de pagamento ainda precisa ser configurado pelo vendedor.')
 return key
}
function checkoutPresentation(session,order,publishableKey){
 if(session.status==='complete')return{completed:true,sessionId:session.id}
 if(session.status&&session.status!=='open')throw new ConnectError('CHECKOUT_CLOSED',409,'Esta tentativa expirou. Inicie uma nova tentativa de pagamento.')
 if((order.checkout_ui_mode||'hosted')==='elements'){
  if(session.ui_mode!=='elements'||!session.client_secret)throw new ConnectError('CHECKOUT_UI_MISMATCH',502,'Não foi possível abrir o formulário seguro. Tente novamente.')
  return{clientSecret:session.client_secret,sessionId:session.id,accountId:order.stripe_account_id,publishableKey,amountCents:order.amount_cents,currency:order.currency}
 }
 if(!session.url)throw new ConnectError('CHECKOUT_CLOSED',409,'Este pagamento já foi concluído ou expirou.')
 return{url:session.url}
}
export async function loadOffer(database,checkoutId){
 const c=await one(database.from('product_checkouts').select('*').eq('id',checkoutId).eq('status','published').is('deleted_at',null))
 if(!c?.published_version_id)throw unavailable()
 const v=await one(database.from('checkout_versions').select('offer_id').eq('id',c.published_version_id).eq('checkout_id',c.id).eq('seller_id',c.seller_id))
 if(!v)throw unavailable()
 const p=await one(database.from('products').select('id,name,seller_id,currency,product_type').eq('id',c.product_id).eq('seller_id',c.seller_id).eq('status','active').eq('active',true).is('deleted_at',null))
 const o=await one(database.from('product_offers').select('*').eq('id',v.offer_id).eq('product_id',c.product_id).eq('seller_id',c.seller_id).eq('status','active').is('deleted_at',null))
 const settings=await one(database.from('product_payment_settings').select('enabled_methods').eq('product_id',c.product_id).eq('seller_id',c.seller_id))
 if(!settings?.enabled_methods?.some(method=>PAYMENT_METHODS.includes(method)))throw unavailable()
 if(!p||!o||!['one_time','subscription'].includes(o.billing_type)||(o.billing_type==='subscription'&&!RECURRING[o.billing_interval])||o.installments!==1||o.setup_fee_cents||!Number.isSafeInteger(o.price_cents)||o.price_cents<=0||o.price_cents>99999999||!['BRL','USD','EUR'].includes(o.currency)||o.currency!==p.currency)throw unavailable()
 return{c,p,o,settings}
}
export async function checkoutPaymentAvailability(database,checkoutId,stripe){
 const {c,p,o,settings}=await loadOffer(database,checkoutId)
 let mode='',paymentAvailable=false,embeddedAvailable=false,methods=[],verified=true,shippingRates=[]
 try{shippingRates=await shippingRatesFor(database,p,o)}catch{/* Sem fretes: checkout sem entrega. */}
 let couponsEnabled=false
 try{const {count}=await database.from('product_coupons').select('id',{count:'exact',head:true}).eq('product_id',p.id).eq('status','active').is('deleted_at',null);couponsEnabled=(count||0)>0}catch{/* Sem cupons visíveis. */}
 try{
  mode=getStripeMode()
  feeConfiguration(o.price_cents)
  const account=await findConnection(database,c.seller_id)
  verified=await kycApproved(database,c.seller_id)
  const eligible=Boolean(verified&&account?.stripe_charges_enabled&&account?.stripe_payouts_enabled&&usableMethods(settings.enabled_methods,account?.stripe_capabilities,o).length&&(mode!=='live'||process.env.STRIPE_LIVE_PAYMENTS_ENABLED==='true'))
  if(eligible){
   const current=await retrieveAndSync(database,c.seller_id,account,stripe||getStripe())
   methods=usableMethods(settings.enabled_methods,current.stripe_capabilities,o)
   paymentAvailable=Boolean(current.stripe_charges_enabled&&current.stripe_payouts_enabled&&methods.length)
  }
  embeddedAvailable=paymentAvailable&&Boolean(checkoutPublishableKey())
 }catch{/* Presentation remains available when the processor isn't configured. */}
 return{productName:p.name,amountCents:o.price_cents,currency:o.currency,billingType:o.billing_type,billingInterval:o.billing_type==='subscription'?o.billing_interval:null,mode,paymentAvailable,embeddedAvailable,paymentMethods:paymentAvailable?methods:[],couponsEnabled,shippingRequired:shippingRates.length>0,shippingRates:shippingRates.map(rate=>({id:rate.id,name:rate.name,carrier:rate.carrier||null,priceCents:Number(rate.price_cents),deliveryDaysMin:rate.delivery_days_min,deliveryDaysMax:rate.delivery_days_max})),paymentMessage:embeddedAvailable?'':verified?'O vendedor ainda precisa habilitar o pagamento desta oferta.':'O vendedor ainda está concluindo a verificação da conta.'}
}
export async function createCheckout(database,input,stripe=getStripe()){
 const value=validateCheckoutInput(input)
 const {c,p,o,settings}=await loadOffer(database,value.checkoutId)
 const connection=await findConnection(database,c.seller_id)
 if(!connection)throw unavailable()
 if(!await kycApproved(database,c.seller_id))throw kycPending()
 const current=await retrieveAndSync(database,c.seller_id,connection,stripe)
 const methods=usableMethods(settings.enabled_methods,current.stripe_capabilities,o)
 if(!current.stripe_charges_enabled||!current.stripe_payouts_enabled||!methods.length)throw unavailable()
 // Live charging is a deliberate, separate release decision.
 if(getStripeMode()==='live'&&process.env.STRIPE_LIVE_PAYMENTS_ENABLED!=='true')throw new ConnectError('LIVE_PAYMENTS_DISABLED',503,'Pagamentos de produção ainda não foram habilitados.')
 const coupon=await applyCoupon(database,{sellerId:c.seller_id,productId:p.id,offer:o,code:value.couponCode,buyerEmail:value.buyer.email,methods})
 const chargeMethods=coupon?coupon.methods:methods,productCents=o.price_cents-(coupon?.discountCents||0)
 const rates=await shippingRatesFor(database,p,o)
 let shipping=null
 if(rates.length){
  const rate=rates.find(item=>item.id===value.shipping?.rateId)
  if(!rate||!value.shipping)throw shippingInvalid()
  const address=value.shipping.address
  shipping={rateId:rate.id,cents:Number(rate.price_cents),address:{recipient:value.buyer.name,postalCode:address.postalCode.replace(/\D/g,'').replace(/^(\d{5})(\d{3})$/,'$1-$2'),street:address.street,number:address.number,complement:address.complement||'',district:address.district,city:address.city,state:address.state,country:'BR'}}
 }
 const amount=productCents+(shipping?.cents||0)
 const {fee,rule}=feeConfiguration(amount)
 const uiMode=value.uiMode||'hosted',publishableKey=uiMode==='elements'?checkoutPublishableKey():undefined
 const affiliate=await resolveAffiliate(database,{sellerId:c.seller_id,productId:p.id,code:value.affiliateCode,buyerEmail:value.buyer.email,amountCents:productCents,currency:o.currency})
 const snapshot={...(coupon?{coupon_id:coupon.couponId,discount_cents:coupon.discountCents}:{}),...(affiliate?{affiliate_id:affiliate.affiliateId,affiliate_commission_cents:affiliate.commissionCents}:{}),request_key:value.requestKey,checkout_ui_mode:uiMode,checkout_origin:configuredAppUrl(),checkout_id:c.id,product_id:p.id,seller_id:c.seller_id,stripe_account_id:connection.stripe_account_id,offer_id:o.id,product_name:p.name,amount_cents:amount,currency:o.currency,fee_cents:fee,...(shipping?{shipping_rate_id:shipping.rateId,shipping_cents:shipping.cents,shipping_address:shipping.address,fulfillment_status:'pending'}:{}),fee_rule:rule,buyer_email:value.buyer.email,buyer_name:value.buyer.name,billing_type:o.billing_type,billing_interval:o.billing_type==='subscription'?o.billing_interval:null}
 const {error}=await database.from('stripe_checkout_orders').upsert(snapshot,{onConflict:'request_key',ignoreDuplicates:true})
 if(error)throw new ConnectError('PAYMENT_STORAGE_ERROR',503,'Não foi possível reservar o pagamento.')
 const order=await one(database.from('stripe_checkout_orders').select('*').eq('request_key',value.requestKey))
 if(!order||order.checkout_id!==c.id||order.buyer_email!==value.buyer.email||order.buyer_name!==value.buyer.name||order.stripe_account_id!==connection.stripe_account_id||(order.checkout_ui_mode||'hosted')!==uiMode||(order.billing_type||'one_time')!==o.billing_type||(order.shipping_rate_id||null)!==(shipping?.rateId||null)||(order.shipping_address?.postalCode||null)!==(shipping?.address.postalCode||null)||(order.shipping_address?.number||null)!==(shipping?.address.number||null)||(order.coupon_id||null)!==(coupon?.couponId||null))throw new ConnectError('IDEMPOTENCY_CONFLICT',409,'Esta tentativa pertence a outro pedido.')
 if(order.session_id){const session=await stripe.checkout.sessions.retrieve(order.session_id,{},{stripeAccount:order.stripe_account_id});return checkoutPresentation(session,order,publishableKey)}
 if(!order.checkout_origin||!Number.isFinite(new Date(order.created_at).getTime())||Date.now()-new Date(order.created_at).getTime()>23*3600000)throw new ConnectError('PAYMENT_RECONCILIATION_REQUIRED',409,'Esta tentativa precisa ser reconciliada antes de continuar.')
 const origin=order.checkout_origin,metadata={sphex_order_id:order.id,sphex_product_id:order.product_id,sphex_seller_id:order.seller_id}
 const returnUrls={...(uiMode==='elements'?{ui_mode:'elements',return_url:`${origin}/pay/${order.checkout_id}?result=returned&session_id={CHECKOUT_SESSION_ID}`}:{success_url:`${origin}/pay/${order.checkout_id}?result=returned&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/pay/${order.checkout_id}?result=cancelled`})}
 const session=order.billing_type==='subscription'
  ?await stripe.checkout.sessions.create({mode:'subscription',payment_method_types:['card'],customer_email:order.buyer_email,client_reference_id:order.id,metadata,
   line_items:[{quantity:1,price_data:{currency:order.currency.toLowerCase(),unit_amount:order.amount_cents,recurring:RECURRING[order.billing_interval],product_data:{name:order.product_name}}}],
   subscription_data:{metadata,...(order.fee_cents?{application_fee_percent:Number(order.fee_rule.slice(4))/100}:{})},
   ...returnUrls},{stripeAccount:order.stripe_account_id,idempotencyKey:`sphex-checkout-${order.id}`})
  :await stripe.checkout.sessions.create({mode:'payment',payment_method_types:chargeMethods,
  ...(chargeMethods.some(method=>method!=='card')?{payment_method_options:{...(chargeMethods.includes('pix')?{pix:{expires_after_seconds:1800}}:{}),...(chargeMethods.includes('boleto')?{boleto:{expires_after_days:3}}:{})}}:{}),customer_email:order.buyer_email,client_reference_id:order.id,metadata,
  line_items:[{quantity:1,price_data:{currency:order.currency.toLowerCase(),unit_amount:order.amount_cents-(order.shipping_cents||0),product_data:{name:order.discount_cents?`${order.product_name} (com cupom)`:order.product_name}}},...(order.shipping_cents?[{quantity:1,price_data:{currency:order.currency.toLowerCase(),unit_amount:order.shipping_cents,product_data:{name:'Frete'}}}]:[])],
  payment_intent_data:{metadata,receipt_email:order.buyer_email,...(order.shipping_address?{shipping:{name:order.shipping_address.recipient,address:{line1:`${order.shipping_address.street}, ${order.shipping_address.number}`,line2:[order.shipping_address.complement,order.shipping_address.district].filter(Boolean).join(' · ')||undefined,city:order.shipping_address.city,state:order.shipping_address.state,postal_code:order.shipping_address.postalCode,country:'BR'}}}:{}),...(order.fee_cents?{application_fee_amount:order.fee_cents}:{})},
  ...returnUrls
 },{stripeAccount:order.stripe_account_id,idempotencyKey:`sphex-checkout-${order.id}`})
 const saved=await database.from('stripe_checkout_orders').update({session_id:session.id,updated_at:new Date().toISOString()}).eq('id',order.id)
 if(saved.error)throw new ConnectError('PAYMENT_STORAGE_ERROR',503,'Não foi possível concluir a reserva. Tente novamente.')
 return checkoutPresentation(session,order,publishableKey)
}

// Read-only confirmation. A return URL alone is never proof of a payment.
export async function checkoutSessionStatus(database,checkoutId,sessionId,stripe=getStripe()){
 validateCheckoutId(checkoutId)
 if(typeof sessionId!=='string'||!/^cs_(?:test_|live_)?[a-zA-Z0-9]{12,240}$/.test(sessionId))throw new ConnectError('INVALID_CHECKOUT_SESSION',400,'Sessão de pagamento inválida.')
 const order=await one(database.from('stripe_checkout_orders').select('*').eq('checkout_id',checkoutId).eq('session_id',sessionId))
 if(!order)throw new ConnectError('CHECKOUT_SESSION_NOT_FOUND',404,'Esta sessão não pertence ao checkout.')
 const connection=await findConnection(database,order.seller_id)
 if(!connection||connection.stripe_account_id!==order.stripe_account_id)throw unavailable()
 const session=await stripe.checkout.sessions.retrieve(sessionId,{},{stripeAccount:order.stripe_account_id})
 if(session.id!==order.session_id||session.mode!==((order.billing_type||'one_time')==='subscription'?'subscription':'payment')||session.client_reference_id!==order.id||session.amount_total!==order.amount_cents||session.currency!==order.currency.toLowerCase()||Boolean(session.livemode)!==(getStripeMode()==='live'))throw new ConnectError('CHECKOUT_SESSION_MISMATCH',409,'Não foi possível verificar este pagamento.')
 return{status:order.status==='refunded'?'refunded':session.payment_status==='paid'&&session.status==='complete'?'paid':session.status==='expired'?'expired':'pending',recorded:order.status==='approved'||order.status==='refunded'}
}

export async function configureProductPayments(database,user,input,stripe){
 const parsed=z.object({productId:z.uuid(),enabled:z.boolean(),method:z.enum(PAYMENT_METHODS).optional()}).strict().safeParse(input)
 if(!parsed.success)throw new ConnectError('INVALID_PAYMENT_SETTINGS',400,'Configuração de pagamento inválida.')
 const {productId,enabled}=parsed.data,method=parsed.data.method||'card'
 const product=await one(database.from('products').select('id').eq('id',productId).eq('seller_id',user.id).is('deleted_at',null))
 if(!product)throw new ConnectError('PRODUCT_NOT_FOUND',404,'Produto não encontrado.')
 let current
 if(enabled){
  const connection=await findConnection(database,user.id)
  if(!connection)throw unavailable()
  current=await retrieveAndSync(database,user.id,connection,stripe||getStripe())
  if(!current.stripe_charges_enabled||!current.stripe_payouts_enabled||current.stripe_capabilities?.card_payments!=='active')throw unavailable()
  if(method!=='card'&&current.stripe_capabilities?.[`${method}_payments`]!=='active')throw new ConnectError('PAYMENT_METHOD_NOT_ACTIVE',409,`Ative o ${method==='pix'?'Pix':'boleto'} na sua conta Stripe (Configurações → Métodos de pagamento) e tente novamente.`)
 }
 const existing=await one(database.from('product_payment_settings').select('enabled_methods,capabilities').eq('product_id',productId).eq('seller_id',user.id))
 const methods=[...new Set([...(existing?.enabled_methods||[]).filter(item=>item!==method),...(enabled?[method]:[])])]
 const {error}=await database.from('product_payment_settings').upsert({product_id:productId,seller_id:user.id,enabled_methods:methods,capabilities:{...existing?.capabilities,...(current?{stripe:current.stripe_capabilities}:{})},updated_at:new Date().toISOString()},{onConflict:'product_id'})
 if(error)throw new ConnectError('PAYMENT_STORAGE_ERROR',503,'Não foi possível salvar os métodos de pagamento.')
 return{enabled,method,methods}
}
