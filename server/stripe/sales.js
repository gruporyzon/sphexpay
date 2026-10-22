import {z} from 'zod'
import {ConnectError,assertConnectionMode,findConnection} from './connect.js'
import {getStripe,getStripeMode} from './client.js'

// Ações do vendedor sobre as próprias vendas: reembolso pela Stripe e lista de contestações.
// A venda é sempre carregada pelo dono (user_id) e conferida contra a conta conectada dele;
// o status da venda só muda quando o webhook assinado da Stripe confirma o reembolso.
// Prazos da Stripe para pedir reembolso: Pix 90 dias, boleto 30 dias, cartão 180 dias.
export const REFUND_WINDOW_DAYS={pix:90,boleto:30,card:180}
const refundSchema=z.object({transactionId:z.string().min(8).max(300),reason:z.enum(['requested_by_customer','duplicate','fraudulent']).optional()}).strict()
const iso=seconds=>Number.isFinite(seconds)?new Date(seconds*1000).toISOString():null
const id=value=>typeof value==='string'?value:value?.id

// Quem ativou a verificação em duas etapas precisa estar com a sessão verificada (aal2) para
// mover dinheiro. O token já foi validado por authenticate(); aqui só lemos a declaração aal.
export function requireStepUp(user,token){
 const verified=(user?.factors||[]).some(factor=>factor?.status==='verified')
 if(!verified)return
 let aal=''
 try{aal=JSON.parse(Buffer.from(String(token).split('.')[1]||'','base64url').toString('utf8')).aal}catch{/* token sem payload legível */}
 if(aal!=='aal2')throw new ConnectError('MFA_REQUIRED',403,'Confirme a verificação em duas etapas para reembolsar vendas.')
}

async function ownedConnection(database,user){
 const connection=await findConnection(database,user.id)
 if(!connection)throw new ConnectError('CONNECT_ACCOUNT_REQUIRED',409,'Ative os pagamentos para gerenciar suas vendas.')
 assertConnectionMode(connection)
 if(connection.user_id!==user.id)throw new ConnectError('CONNECT_OWNERSHIP_MISMATCH',403,'Conta de pagamentos incompatível com o usuário.')
 return connection
}
const stripeFailure=error=>{
 if(error instanceof ConnectError)return error
 if(error?.code==='charge_already_refunded')return new ConnectError('ALREADY_REFUNDED',409,'Esta venda já foi reembolsada.')
 if(error?.code==='charge_disputed')return new ConnectError('SALE_DISPUTED',409,'Esta venda está em contestação e não pode ser reembolsada pelo painel.')
 const temporary=['StripeConnectionError','StripeRateLimitError','StripeAPIError'].includes(error?.type)||error?.statusCode===429||error?.statusCode>=500
 if(temporary)return new ConnectError('STRIPE_ACCOUNT_UNAVAILABLE',503,'A Stripe não respondeu agora. Tente novamente em instantes.')
 return new ConnectError('REFUND_REJECTED',422,typeof error?.message==='string'&&error?.type==='StripeInvalidRequestError'?`A Stripe recusou o reembolso: ${error.message}`:'Não foi possível solicitar o reembolso.')
}

export function refundEligibility(transaction,now=Date.now()){
 if(!transaction||transaction.provider!=='stripe')return{ok:false,code:'SALE_NOT_FOUND',message:'Venda não encontrada.'}
 if(transaction.status==='refunded')return{ok:false,code:'ALREADY_REFUNDED',message:'Esta venda já foi reembolsada.'}
 if(transaction.status==='chargeback')return{ok:false,code:'SALE_DISPUTED',message:'Esta venda está em contestação e não pode ser reembolsada pelo painel.'}
 if(transaction.status!=='approved')return{ok:false,code:'SALE_NOT_PAID',message:'Só vendas aprovadas podem ser reembolsadas.'}
 const method=transaction.payment_method in REFUND_WINDOW_DAYS?transaction.payment_method:'card'
 const paidAt=new Date(transaction.approved_at||transaction.occurred_at).getTime()
 if(Number.isFinite(paidAt)&&now-paidAt>REFUND_WINDOW_DAYS[method]*86400000)return{ok:false,code:'REFUND_WINDOW_EXPIRED',message:`O prazo da Stripe para reembolsar ${method==='pix'?'Pix':method==='boleto'?'boleto':'cartão'} (${REFUND_WINDOW_DAYS[method]} dias) já passou.`}
 return{ok:true}
}

export async function refundSale(database,user,input,stripe=getStripe()){
 const parsed=refundSchema.safeParse(input)
 if(!parsed.success)throw new ConnectError('INVALID_REFUND_INPUT',400,'Informe a venda que deseja reembolsar.')
 const {transactionId,reason}=parsed.data
 const {data:transaction,error}=await database.from('payment_transactions').select('id,transaction_id,user_id,provider,status,payment_method,amount_cents,currency,occurred_at,approved_at,metadata').eq('transaction_id',transactionId).eq('user_id',user.id).maybeSingle()
 if(error)throw new ConnectError('PAYMENT_STORAGE_ERROR',503,'Não foi possível consultar a venda.')
 const eligibility=refundEligibility(transaction)
 if(!eligibility.ok)throw new ConnectError(eligibility.code,eligibility.code==='SALE_NOT_FOUND'?404:409,eligibility.message)
 const connection=await ownedConnection(database,user),intentId=transaction.metadata?.payment_intent_id
 if(!intentId||transaction.metadata?.stripe_account_id!==connection.stripe_account_id)throw new ConnectError('SALE_NOT_FOUND',404,'Venda não encontrada.')
 try{
  const intent=await stripe.paymentIntents.retrieve(intentId,{},{stripeAccount:connection.stripe_account_id})
  if(intent.id!==intentId||intent.status!=='succeeded'||Boolean(intent.livemode)!==(getStripeMode()==='live'))throw new ConnectError('SALE_NOT_PAID',409,'Esta venda não está paga na Stripe.')
  const refund=await stripe.refunds.create({payment_intent:intentId,reason:reason||'requested_by_customer',metadata:{sphex_seller_id:user.id,sphex_transaction_id:transaction.transaction_id}},{stripeAccount:connection.stripe_account_id,idempotencyKey:`sphex-refund-${transaction.id}`})
  return{refundId:refund.id,status:refund.status,amountCents:refund.amount,currency:String(refund.currency||transaction.currency).toUpperCase()}
 }catch(failure){throw stripeFailure(failure)}
}

const DISPUTE_STATUS=new Set(['warning_needs_response','warning_under_review','warning_closed','needs_response','under_review','won','lost','prevented'])
export const safeDispute=(dispute,sale)=>({
 id:String(dispute.id),amountCents:Number(dispute.amount)||0,currency:String(dispute.currency||'brl').toUpperCase(),
 status:DISPUTE_STATUS.has(dispute.status)?dispute.status:'under_review',reason:typeof dispute.reason==='string'?dispute.reason:'general',
 method:dispute.payment_method_details?.type==='pix'?'pix':'card',createdAt:iso(dispute.created),dueBy:iso(dispute.evidence_details?.due_by),
 transactionId:sale?.transaction_id||null,productName:sale?.product_name||null,customerName:sale?.customer_name||null
})

export async function listDisputes(database,user,stripe=getStripe()){
 const connection=await ownedConnection(database,user)
 let disputes
 try{disputes=await stripe.disputes.list({limit:50},{stripeAccount:connection.stripe_account_id})}catch(failure){throw stripeFailure(failure)}
 const rows=(disputes.data||[]).filter(item=>Boolean(item.livemode)===(getStripeMode()==='live'))
 const intents=[...new Set(rows.map(item=>id(item.payment_intent)).filter(Boolean))]
 let sales=[]
 if(intents.length){
  const {data,error}=await database.from('payment_transactions').select('transaction_id,product_name,customer_name,metadata').eq('user_id',user.id).eq('provider','stripe').in('metadata->>payment_intent_id',intents)
  if(error)throw new ConnectError('PAYMENT_STORAGE_ERROR',503,'Não foi possível consultar as vendas contestadas.')
  sales=(data||[]).filter(row=>row.metadata?.stripe_account_id===connection.stripe_account_id)
 }
 const byIntent=new Map(sales.map(row=>[row.metadata.payment_intent_id,row]))
 return{mode:getStripeMode(),disputes:rows.map(item=>safeDispute(item,byIntent.get(id(item.payment_intent))))}
}
