import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
// @ts-expect-error Backend JavaScript stays outside the frontend bundle.
import {listDisputes,refundEligibility,refundSale,requireStepUp} from '../../server/stripe/sales.js'
// @ts-expect-error Backend JavaScript stays outside the frontend bundle.
import {processStripeEvent} from '../../server/stripe/webhook.js'

const user={id:'seller',factors:[]}
const sale=(patch:Record<string,unknown>={})=>({id:'tx-1',transaction_id:'stripe:acct_seller:pi_sale',user_id:'seller',provider:'stripe',status:'approved',payment_method:'card',amount_cents:10000,currency:'BRL',occurred_at:new Date().toISOString(),approved_at:new Date().toISOString(),metadata:{payment_intent_id:'pi_sale',stripe_account_id:'acct_seller'},...patch})
function fixture(transaction:any=sale()){
 const filters:Record<string,unknown>={}
 const database:any={rpc:vi.fn(async()=>({data:{duplicate:false},error:null})),from:vi.fn((table:string)=>{
  const q:any={select:()=>q,eq:(key:string,value:unknown)=>{filters[`${table}.${key}`]=value;return q},in:()=>q,
   maybeSingle:async()=>table==='stripe_connected_accounts'?{data:{stripe_mode:'test',user_id:'seller',stripe_account_id:'acct_seller'},error:null}:table==='stripe_webhook_events'?{data:null,error:null}:{data:filters['payment_transactions.user_id']===transaction?.user_id?transaction:null,error:null},
   then:(resolve:any)=>Promise.resolve({data:[transaction],error:null}).then(resolve)}
  return q
 })}
 const stripe:any={
  paymentIntents:{retrieve:vi.fn(async()=>({id:'pi_sale',status:'succeeded',livemode:false}))},
  refunds:{create:vi.fn(async()=>({id:'re_1',status:'succeeded',amount:10000,currency:'brl'}))},
  disputes:{list:vi.fn(async()=>({data:[{id:'dp_1',amount:10000,currency:'brl',status:'needs_response',reason:'fraudulent',livemode:false,created:1788540000,payment_intent:'pi_sale',evidence_details:{due_by:1789540000},payment_method_details:{type:'card'}},{id:'dp_live',livemode:true,status:'won',payment_intent:'pi_x'}]})),retrieve:vi.fn(async()=>({id:'dp_1',status:'lost',reason:'fraudulent',amount:10000,livemode:false,payment_intent:'pi_sale',evidence_details:{due_by:null}}))}
 }
 return{database,stripe}
}
describe('reembolso e contestações pelo painel',()=>{
 beforeEach(()=>{vi.stubEnv('STRIPE_SECRET_KEY','sk_test_fixture')})
 afterEach(()=>vi.unstubAllEnvs())
 it('reembolsa a venda aprovada do próprio vendedor na conta conectada dele',async()=>{
  const {database,stripe}=fixture()
  expect(await refundSale(database,user,{transactionId:'stripe:acct_seller:pi_sale'},stripe)).toEqual({refundId:'re_1',status:'succeeded',amountCents:10000,currency:'BRL'})
  expect(stripe.refunds.create).toHaveBeenCalledWith(expect.objectContaining({payment_intent:'pi_sale',reason:'requested_by_customer'}),{stripeAccount:'acct_seller',idempotencyKey:'sphex-refund-tx-1'})
 })
 it('não reembolsa venda de outro vendedor, já reembolsada, contestada ou de outra conta',async()=>{
  await expect(refundSale(fixture(sale({user_id:'outro'})).database,user,{transactionId:'stripe:x:y'},fixture().stripe)).rejects.toMatchObject({code:'SALE_NOT_FOUND'})
  await expect(refundSale(fixture(sale({status:'refunded'})).database,user,{transactionId:'stripe:x:y'})).rejects.toMatchObject({code:'ALREADY_REFUNDED'})
  await expect(refundSale(fixture(sale({status:'chargeback'})).database,user,{transactionId:'stripe:x:y'})).rejects.toMatchObject({code:'SALE_DISPUTED'})
  const other=fixture(sale({metadata:{payment_intent_id:'pi_sale',stripe_account_id:'acct_outro'}}))
  await expect(refundSale(other.database,user,{transactionId:'stripe:x:y'},other.stripe)).rejects.toMatchObject({code:'SALE_NOT_FOUND'})
  expect(other.stripe.refunds.create).not.toHaveBeenCalled()
  await expect(refundSale(fixture().database,user,{transactionId:1})).rejects.toMatchObject({code:'INVALID_REFUND_INPUT'})
 })
 it('respeita o prazo da Stripe de cada método',()=>{
  const old=(days:number)=>new Date(Date.now()-days*86400000).toISOString()
  expect(refundEligibility(sale({payment_method:'boleto',approved_at:old(31)}))).toMatchObject({ok:false,code:'REFUND_WINDOW_EXPIRED'})
  expect(refundEligibility(sale({payment_method:'pix',approved_at:old(60)}))).toEqual({ok:true})
  expect(refundEligibility(sale({payment_method:'pix',approved_at:old(91)}))).toMatchObject({ok:false})
  expect(refundEligibility(sale({status:'pending'}))).toMatchObject({code:'SALE_NOT_PAID'})
 })
 it('exige sessão verificada em duas etapas de quem ativou o segundo fator',()=>{
  const token=(aal:string)=>`h.${Buffer.from(JSON.stringify({aal})).toString('base64url')}.s`
  expect(()=>requireStepUp({factors:[]},token('aal1'))).not.toThrow()
  expect(()=>requireStepUp({factors:[{status:'verified'}]},token('aal1'))).toThrow(/duas etapas/)
  expect(()=>requireStepUp({factors:[{status:'verified'}]},token('aal2'))).not.toThrow()
 })
 it('lista contestações do modo atual com a venda correspondente',async()=>{
  const {database,stripe}=fixture(sale({product_name:'Curso',customer_name:'Ana'}))
  const result=await listDisputes(database,user,stripe)
  expect(result.disputes).toHaveLength(1)
  expect(result.disputes[0]).toMatchObject({id:'dp_1',status:'needs_response',method:'card',productName:'Curso',customerName:'Ana',transactionId:'stripe:acct_seller:pi_sale'})
 })
 it('webhook de contestação usa o estado atual da disputa',async()=>{
  const {database,stripe}=fixture()
  await processStripeEvent(database,{id:'evt_dp',type:'charge.dispute.created',account:'acct_seller',created:1788540000,livemode:false,data:{object:{id:'dp_1',status:'needs_response'}}},stripe)
  expect(stripe.disputes.retrieve).toHaveBeenCalledWith('dp_1',{},{stripeAccount:'acct_seller'})
  expect(database.rpc).toHaveBeenCalledWith('apply_stripe_dispute',expect.objectContaining({p_intent:'pi_sale',p_dispute_status:'lost',p_account:'acct_seller'}))
 })
})
