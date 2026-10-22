import {ConnectError,assertConnectionMode,findConnection} from './connect.js'
import {getStripe,getStripeMode} from './client.js'

// Saldo, agenda de repasses e repasses da conta Stripe conectada do vendedor.
// Somente leitura: os repasses são automáticos e feitos pela Stripe para a conta
// bancária cadastrada no onboarding. Nenhum dado bancário completo sai daqui.
const PAYOUT_STATUS=new Set(['paid','pending','in_transit','canceled','failed'])
const iso=seconds=>Number.isFinite(seconds)?new Date(seconds*1000).toISOString():null
const amounts=list=>(Array.isArray(list)?list:[]).map(item=>({amountCents:Number(item.amount)||0,currency:String(item.currency||'brl').toUpperCase()}))
const destination=value=>value&&typeof value==='object'?{bankName:typeof value.bank_name==='string'?value.bank_name:null,last4:typeof value.last4==='string'?value.last4:null}:null

export const safePayout=payout=>({
 id:String(payout.id),amountCents:Number(payout.amount)||0,currency:String(payout.currency||'brl').toUpperCase(),
 status:PAYOUT_STATUS.has(payout.status)?payout.status:'pending',automatic:Boolean(payout.automatic),
 createdAt:iso(payout.created),arrivalDate:iso(payout.arrival_date),
 failureMessage:payout.status==='failed'&&typeof payout.failure_message==='string'?payout.failure_message:null,
 destination:destination(payout.destination)
})

const scheduleOf=account=>{
 const schedule=account?.settings?.payouts?.schedule||{}
 return{interval:['manual','daily','weekly','monthly'].includes(schedule.interval)?schedule.interval:null,delayDays:Number.isFinite(schedule.delay_days)?schedule.delay_days:null,weeklyAnchor:typeof schedule.weekly_anchor==='string'?schedule.weekly_anchor:null,monthlyAnchor:Number.isFinite(schedule.monthly_anchor)?schedule.monthly_anchor:null}
}

// Taxa da plataforma por venda (pontos-base) e métodos ativos na conta, para "Minhas taxas".
export const platformFeeBps=()=>{const raw=process.env.STRIPE_PLATFORM_FEE_BPS;return raw&&/^\d+$/.test(raw)&&Number(raw)<=10000?Number(raw):null}
const methodsOf=capabilities=>({card:capabilities?.card_payments==='active',pix:capabilities?.pix_payments==='active',boleto:capabilities?.boleto_payments==='active'})

export async function loadConnectedFinance(database,user,stripe=getStripe()){
 const mode=getStripeMode(),connection=await findConnection(database,user.id)
 if(!connection)return{mode,connected:false,payoutsEnabled:false,balance:{available:[],pending:[]},schedule:null,payouts:[],platformFeeBps:platformFeeBps(),methods:methodsOf(null)}
 assertConnectionMode(connection)
 if(connection.user_id!==user.id)throw new ConnectError('CONNECT_OWNERSHIP_MISMATCH',403,'Conta de pagamentos incompatível com o usuário.')
 const options={stripeAccount:connection.stripe_account_id}
 try{
  const [account,balance,payouts]=await Promise.all([
   stripe.accounts.retrieve(connection.stripe_account_id),
   stripe.balance.retrieve({},options),
   stripe.payouts.list({limit:30,expand:['data.destination']},options)
  ])
  if(account.id!==connection.stripe_account_id||(account.metadata?.sphex_user_id&&account.metadata.sphex_user_id!==user.id))throw new ConnectError('CONNECT_OWNERSHIP_MISMATCH',403,'Conta de pagamentos incompatível com o usuário.')
  return{mode,connected:true,payoutsEnabled:Boolean(account.payouts_enabled),balance:{available:amounts(balance.available),pending:amounts(balance.pending)},schedule:scheduleOf(account),payouts:(payouts.data||[]).map(safePayout),platformFeeBps:platformFeeBps(),methods:methodsOf(account.capabilities)}
 }catch(error){
  if(error instanceof ConnectError)throw error
  const temporary=['StripeConnectionError','StripeRateLimitError','StripeAPIError'].includes(error?.type)||error?.statusCode===429||error?.statusCode>=500
  throw new ConnectError(temporary?'STRIPE_ACCOUNT_UNAVAILABLE':'STRIPE_FINANCE_ERROR',temporary?503:502,'Não foi possível consultar o saldo e os repasses agora.')
 }
}
