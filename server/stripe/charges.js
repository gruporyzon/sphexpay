import {z} from 'zod'
import {ConnectError,assertConnectionMode,findConnection,retrieveAndSync} from './connect.js'
import {getStripe,getStripeMode} from './client.js'
import {feeConfiguration} from './payments.js'

// Cobrança personalizada: fatura avulsa na conta Stripe conectada do vendedor, com o link de
// pagamento enviado por e-mail pela própria Stripe. Valor, taxa e conta vêm do servidor.
const chargeSchema=z.object({
 requestKey:z.uuid(),customerName:z.string().trim().min(2).max(120),customerEmail:z.email().max(254),
 description:z.string().trim().min(2).max(200),amountCents:z.number().int().min(50).max(99999999),
 methods:z.array(z.enum(['card','pix','boleto'])).min(1).max(3),dueDays:z.number().int().min(1).max(30)
}).strict()
const voidSchema=z.object({chargeId:z.uuid()}).strict()
const id=value=>typeof value==='string'?value:value?.id

// Mesmos limites da Stripe Brasil usados no checkout.
export function chargeMethodProblem(method,capabilities,amount){
 const caps=capabilities||{}
 if(method==='card')return caps.card_payments==='active'?null:'O cartão não está ativo na sua conta Stripe.'
 if(method==='pix'){if(caps.pix_payments!=='active')return'O Pix não está ativo na sua conta Stripe.';return amount>=50&&amount<=1500000?null:'Pix aceita de R$ 0,50 até R$ 15.000,00 por cobrança.'}
 if(caps.boleto_payments!=='active')return'O boleto não está ativo na sua conta Stripe.'
 return amount>=500&&amount<=4999999?null:'Boleto aceita de R$ 5,00 a R$ 49.999,99.'
}
const stripeFailure=error=>{
 if(error instanceof ConnectError)return error
 const temporary=['StripeConnectionError','StripeRateLimitError','StripeAPIError'].includes(error?.type)||error?.statusCode===429||error?.statusCode>=500
 if(temporary)return new ConnectError('STRIPE_ACCOUNT_UNAVAILABLE',503,'A Stripe não respondeu agora. Tente novamente em instantes.')
 return new ConnectError('CHARGE_REJECTED',422,error?.type==='StripeInvalidRequestError'&&typeof error.message==='string'?`A Stripe recusou a cobrança: ${error.message}`:'Não foi possível criar a cobrança.')
}
const one=async query=>{const {data,error}=await query.maybeSingle();if(error)throw new ConnectError('PAYMENT_STORAGE_ERROR',503,'Não foi possível consultar a cobrança.');return data}
export const safeCharge=row=>({id:row.id,customerName:row.customer_name,customerEmail:row.customer_email,description:row.description,amountCents:Number(row.amount_cents),currency:row.currency,methods:row.methods,status:row.status,dueDate:row.due_date,hostedUrl:row.hosted_url,createdAt:row.created_at,paidAt:row.paid_at,mode:row.stripe_mode})

export async function createCustomCharge(database,user,input,stripe=getStripe()){
 const parsed=chargeSchema.safeParse(input)
 if(!parsed.success)throw new ConnectError('INVALID_CHARGE_INPUT',400,'Revise os dados da cobrança: nome, e-mail, descrição, valor, métodos e vencimento.')
 const value=parsed.data,methods=[...new Set(value.methods)],mode=getStripeMode()
 const connection=await findConnection(database,user.id)
 if(!connection)throw new ConnectError('CONNECT_ACCOUNT_REQUIRED',409,'Ative os pagamentos para criar cobranças.')
 assertConnectionMode(connection)
 if(mode==='live'){
  const kyc=await one(database.from('kyc_profiles').select('status').eq('user_id',user.id))
  if(kyc?.status!=='approved')throw new ConnectError('SELLER_VERIFICATION_PENDING',409,'Conclua a verificação da conta para cobrar clientes.')
  if(process.env.STRIPE_LIVE_PAYMENTS_ENABLED!=='true')throw new ConnectError('LIVE_PAYMENTS_DISABLED',503,'Pagamentos de produção ainda não foram habilitados.')
 }
 const existing=await one(database.from('custom_charges').select('*').eq('id',value.requestKey))
 if(existing){
  if(existing.seller_id!==user.id)throw new ConnectError('IDEMPOTENCY_CONFLICT',409,'Esta tentativa pertence a outra cobrança.')
  if(existing.invoice_id&&existing.status!=='creating')return safeCharge(existing)
 }
 const current=await retrieveAndSync(database,user.id,connection,stripe)
 if(!current.stripe_charges_enabled)throw new ConnectError('CONNECT_ACCOUNT_REQUIRED',409,'Sua conta Stripe ainda não pode receber pagamentos.')
 for(const method of methods){const problem=chargeMethodProblem(method,current.stripe_capabilities,value.amountCents);if(problem)throw new ConnectError('PAYMENT_METHOD_NOT_ACTIVE',409,problem)}
 const {fee,rule}=feeConfiguration(value.amountCents)
 const due=new Date(Date.now()+value.dueDays*86400000).toISOString().slice(0,10)
 if(!existing){
  const {error}=await database.from('custom_charges').insert({id:value.requestKey,seller_id:user.id,stripe_account_id:connection.stripe_account_id,stripe_mode:mode,customer_name:value.customerName,customer_email:value.customerEmail,description:value.description,amount_cents:value.amountCents,currency:'BRL',methods,fee_cents:fee,fee_rule:rule,due_date:due})
  if(error)throw new ConnectError('PAYMENT_STORAGE_ERROR',503,'Não foi possível registrar a cobrança.')
 }
 const chargeId=value.requestKey,options=key=>({stripeAccount:connection.stripe_account_id,idempotencyKey:`sphex-charge-${key}-${chargeId}`}),metadata={sphex_charge_id:chargeId,sphex_seller_id:user.id}
 try{
  const customer=await stripe.customers.create({email:value.customerEmail,name:value.customerName,metadata},options('customer'))
  const invoice=await stripe.invoices.create({customer:customer.id,collection_method:'send_invoice',days_until_due:value.dueDays,currency:'brl',auto_advance:false,pending_invoice_items_behavior:'exclude',description:value.description,metadata,payment_settings:{payment_method_types:methods},...(fee?{application_fee_amount:fee}:{})},options('invoice'))
  const saved=await database.from('custom_charges').update({invoice_id:invoice.id,updated_at:new Date().toISOString()}).eq('id',chargeId).eq('seller_id',user.id)
  if(saved.error)throw new ConnectError('PAYMENT_STORAGE_ERROR',503,'Não foi possível registrar a cobrança.')
  await stripe.invoiceItems.create({customer:customer.id,invoice:invoice.id,amount:value.amountCents,currency:'brl',description:value.description,metadata},options('item'))
  const finalized=await stripe.invoices.finalizeInvoice(invoice.id,{auto_advance:false},options('finalize'))
  if(finalized.amount_due!==value.amountCents)throw new ConnectError('CHARGE_REJECTED',422,'O valor da fatura não confere. Tente novamente.')
  const sent=await stripe.invoices.sendInvoice(invoice.id,{},options('send'))
  const {data,error}=await database.from('custom_charges').update({hosted_url:sent.hosted_invoice_url||finalized.hosted_invoice_url||null,status:'open',updated_at:new Date().toISOString()}).eq('id',chargeId).eq('seller_id',user.id).select('*').single()
  if(error||!data)throw new ConnectError('PAYMENT_STORAGE_ERROR',503,'A cobrança foi enviada, mas não conseguimos atualizar a lista. Recarregue a página.')
  return safeCharge(data)
 }catch(failure){
  if(!(failure instanceof ConnectError&&failure.code==='PAYMENT_STORAGE_ERROR'))await database.from('custom_charges').update({status:'failed',updated_at:new Date().toISOString()}).eq('id',chargeId).eq('seller_id',user.id).eq('status','creating')
  throw stripeFailure(failure)
 }
}

export async function voidCustomCharge(database,user,input,stripe=getStripe()){
 const parsed=voidSchema.safeParse(input)
 if(!parsed.success)throw new ConnectError('INVALID_CHARGE_INPUT',400,'Informe a cobrança.')
 const charge=await one(database.from('custom_charges').select('*').eq('id',parsed.data.chargeId).eq('seller_id',user.id))
 if(!charge||!charge.invoice_id)throw new ConnectError('CHARGE_NOT_FOUND',404,'Cobrança não encontrada.')
 if(charge.status!=='open')throw new ConnectError('CHARGE_NOT_OPEN',409,'Só cobranças em aberto podem ser canceladas.')
 const connection=await findConnection(database,user.id)
 if(!connection||connection.stripe_account_id!==charge.stripe_account_id)throw new ConnectError('CHARGE_NOT_FOUND',404,'Cobrança não encontrada.')
 try{await stripe.invoices.voidInvoice(charge.invoice_id,{},{stripeAccount:charge.stripe_account_id})}catch(failure){throw stripeFailure(failure)}
 const {data,error}=await database.from('custom_charges').update({status:'void',updated_at:new Date().toISOString()}).eq('id',charge.id).eq('seller_id',user.id).eq('status','open').select('*').single()
 if(error||!data)return safeCharge({...charge,status:'void'})
 return safeCharge(data)
}

const METHODS=new Set(['card','pix','boleto'])
// Webhook: estado atual da fatura e do pagamento na Stripe, nunca só o snapshot do evento.
export async function processCustomChargeEvent(database,event,stripe){
 if(!event.account)return{ignored:true}
 const invoice=await stripe.invoices.retrieve(event.data.object.id,{expand:['payments']},{stripeAccount:event.account})
 const chargeId=invoice.metadata?.sphex_charge_id
 const {data:charge,error}=await database.from('custom_charges').select('*').eq('id',chargeId).maybeSingle()
 if(error)throw new Error('STRIPE_STORAGE_FAILED')
 if(!charge)return{ignored:true}
 if(charge.stripe_account_id!==event.account||charge.invoice_id!==invoice.id||charge.seller_id!==invoice.metadata?.sphex_seller_id||invoice.currency!=='brl'||Boolean(invoice.livemode)!==Boolean(event.livemode))throw new Error('STRIPE_PAYMENT_MISMATCH')
 let status=invoice.status==='paid'?'paid':invoice.status==='void'||invoice.status==='uncollectible'?'void':'open',intent=null,method='card'
 if(status==='paid'){
  const intentId=id((invoice.payments?.data||[]).find(item=>item.payment?.type==='payment_intent')?.payment?.payment_intent)
  if(!intentId)return{ignored:true}
  intent=await stripe.paymentIntents.retrieve(intentId,{expand:['latest_charge']},{stripeAccount:event.account})
  if(intent.status!=='succeeded')status='open'
  const type=intent.latest_charge?.payment_method_details?.type
  method=METHODS.has(type)?type:'card'
 }
 const {data,error:rpcError}=await database.rpc('apply_custom_charge_invoice',{p_charge_id:charge.id,p_event_id:event.id,p_event_type:event.type,p_account:event.account,p_invoice:invoice.id,p_intent:intent?.id||null,p_charge:id(intent?.latest_charge)||null,p_status:status,p_amount:status==='paid'?invoice.amount_paid:invoice.amount_due,p_fee:intent?.application_fee_amount||0,p_method:method,p_occurred_at:new Date(event.created*1000).toISOString()})
 if(rpcError)throw new Error('STRIPE_PERSISTENCE_FAILED')
 return data
}
