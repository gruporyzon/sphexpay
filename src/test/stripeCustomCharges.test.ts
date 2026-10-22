import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
// @ts-expect-error Backend JavaScript stays outside the frontend bundle.
import {chargeMethodProblem,createCustomCharge,processCustomChargeEvent,voidCustomCharge} from '../../server/stripe/charges.js'
// @ts-expect-error Backend JavaScript stays outside the frontend bundle.
import {processStripeEvent} from '../../server/stripe/webhook.js'

const key='11111111-1111-4111-8111-111111111111'
const input=(patch:Record<string,unknown>={})=>({requestKey:key,customerName:'Ana Lima',customerEmail:'ana@exemplo.com',description:'Mentoria',amountCents:15000,methods:['pix','boleto','card'],dueDays:3,...patch})
function fixture(){
 const tables:Record<string,any[]>={custom_charges:[],kyc_profiles:[{user_id:'seller',status:'approved'}],stripe_connected_accounts:[{stripe_mode:'test',user_id:'seller',stripe_account_id:'acct_seller',stripe_charges_enabled:true,stripe_payouts_enabled:true}],stripe_webhook_events:[]}
 const database:any={rpc:vi.fn(async()=>({data:{duplicate:false},error:null})),from:vi.fn((table:string)=>{
  const filters:((row:any)=>boolean)[]=[];let patch:any
  const rows=()=>tables[table].filter(row=>filters.every(f=>f(row)))
  const q:any={select:()=>q,eq:(k:string,v:unknown)=>{filters.push(row=>row[k]===v);return q},
   insert:async(value:any)=>{tables[table].push({status:'creating',created_at:'2026-10-22T00:00:00Z',...value});return{error:null}},
   update:(value:any)=>{patch=value;return q},upsert:async(value:any)=>{tables[table].push(value);return{error:null}},
   maybeSingle:async()=>({data:rows()[0]||null,error:null}),
   single:async()=>{rows().forEach(row=>Object.assign(row,patch));return{data:rows()[0]||null,error:null}},
   then:(resolve:any)=>{if(patch)rows().forEach(row=>Object.assign(row,patch));return Promise.resolve({data:null,error:null}).then(resolve)}}
  return q
 })}
 const stripe:any={
  accounts:{retrieve:vi.fn(async()=>({id:'acct_seller',metadata:{sphex_user_id:'seller'},charges_enabled:true,payouts_enabled:true,details_submitted:true,capabilities:{card_payments:'active',pix_payments:'active',boleto_payments:'active'}}))},
  customers:{create:vi.fn(async()=>({id:'cus_1'}))},
  invoiceItems:{create:vi.fn(async()=>({id:'ii_1'}))},
  invoices:{create:vi.fn(async()=>({id:'in_1'})),finalizeInvoice:vi.fn(async()=>({id:'in_1',amount_due:15000,hosted_invoice_url:'https://invoice.stripe.com/i/1'})),sendInvoice:vi.fn(async()=>({id:'in_1',hosted_invoice_url:'https://invoice.stripe.com/i/1'})),voidInvoice:vi.fn(async()=>({id:'in_1',status:'void'})),
   retrieve:vi.fn(async()=>({id:'in_1',status:'paid',currency:'brl',livemode:false,amount_paid:15000,amount_due:15000,metadata:{sphex_charge_id:key,sphex_seller_id:'seller'},payments:{data:[{payment:{type:'payment_intent',payment_intent:'pi_1'}}]}}))},
  paymentIntents:{retrieve:vi.fn(async()=>({id:'pi_1',status:'succeeded',application_fee_amount:150,latest_charge:{id:'ch_1',payment_method_details:{type:'pix'}}}))}
 }
 return{tables,database,stripe}
}
describe('cobrança personalizada',()=>{
 beforeEach(()=>{vi.stubEnv('STRIPE_SECRET_KEY','sk_test_fixture');vi.stubEnv('STRIPE_PLATFORM_FEE_BPS','100')})
 afterEach(()=>vi.unstubAllEnvs())
 it('cria a fatura na conta conectada com a taxa do servidor e a Stripe envia o e-mail',async()=>{
  const {tables,database,stripe}=fixture()
  const charge=await createCustomCharge(database,{id:'seller'},input(),stripe)
  expect(charge).toMatchObject({status:'open',hostedUrl:'https://invoice.stripe.com/i/1',amountCents:15000})
  expect(stripe.invoices.create).toHaveBeenCalledWith(expect.objectContaining({collection_method:'send_invoice',application_fee_amount:150,payment_settings:{payment_method_types:['pix','boleto','card']},metadata:{sphex_charge_id:key,sphex_seller_id:'seller'}}),expect.objectContaining({stripeAccount:'acct_seller'}))
  expect(stripe.invoices.sendInvoice).toHaveBeenCalled()
  expect(tables.custom_charges[0]).toMatchObject({invoice_id:'in_1',fee_cents:150,seller_id:'seller'})
  // Repetir a mesma tentativa não cria outra cobrança.
  await createCustomCharge(database,{id:'seller'},input(),stripe)
  expect(stripe.invoices.create).toHaveBeenCalledTimes(1)
 })
 it('recusa método inativo, valor fora do limite e dados inválidos',async()=>{
  expect(chargeMethodProblem('boleto',{boleto_payments:'active'},400)).toMatch(/R\$ 5,00/)
  expect(chargeMethodProblem('pix',{},1000)).toMatch(/Pix não está ativo/)
  expect(chargeMethodProblem('card',{card_payments:'active'},50)).toBeNull()
  const {database,stripe}=fixture()
  stripe.accounts.retrieve.mockResolvedValueOnce({id:'acct_seller',metadata:{sphex_user_id:'seller'},charges_enabled:true,payouts_enabled:true,details_submitted:true,capabilities:{card_payments:'active'}})
  await expect(createCustomCharge(database,{id:'seller'},input(),stripe)).rejects.toMatchObject({code:'PAYMENT_METHOD_NOT_ACTIVE'})
  await expect(createCustomCharge(database,{id:'seller'},input({amountCents:-1}),stripe)).rejects.toMatchObject({code:'INVALID_CHARGE_INPUT'})
  expect(stripe.invoices.create).not.toHaveBeenCalled()
 })
 it('em produção exige verificação aprovada e pagamentos reais ligados',async()=>{
  vi.stubEnv('STRIPE_SECRET_KEY','sk_live_fixture')
  const {tables,database,stripe}=fixture()
  tables.stripe_connected_accounts[0].stripe_mode='live';tables.kyc_profiles[0].status='pending'
  await expect(createCustomCharge(database,{id:'seller'},input(),stripe)).rejects.toMatchObject({code:'SELLER_VERIFICATION_PENDING'})
 })
 it('só cancela cobrança em aberto do próprio vendedor',async()=>{
  const {tables,database,stripe}=fixture()
  await createCustomCharge(database,{id:'seller'},input(),stripe)
  await expect(voidCustomCharge(database,{id:'outro'},{chargeId:key},stripe)).rejects.toMatchObject({code:'CHARGE_NOT_FOUND'})
  expect((await voidCustomCharge(database,{id:'seller'},{chargeId:key},stripe)).status).toBe('void')
  expect(tables.custom_charges[0].status).toBe('void')
  await expect(voidCustomCharge(database,{id:'seller'},{chargeId:key},stripe)).rejects.toMatchObject({code:'CHARGE_NOT_OPEN'})
 })
 it('webhook de fatura paga registra a venda pelo estado atual da Stripe',async()=>{
  const {database,stripe}=fixture()
  await createCustomCharge(database,{id:'seller'},input(),stripe)
  await processStripeEvent(database,{id:'evt_in',type:'invoice.paid',account:'acct_seller',created:1788540000,livemode:false,data:{object:{id:'in_1',metadata:{sphex_charge_id:key}}}},stripe)
  expect(database.rpc).toHaveBeenCalledWith('apply_custom_charge_invoice',expect.objectContaining({p_charge_id:key,p_status:'paid',p_amount:15000,p_fee:150,p_method:'pix',p_intent:'pi_1'}))
 })
 it('webhook recusa fatura que não confere com a cobrança',async()=>{
  const {database,stripe}=fixture()
  await createCustomCharge(database,{id:'seller'},input(),stripe)
  stripe.invoices.retrieve.mockResolvedValueOnce({id:'in_outra',status:'paid',currency:'brl',livemode:false,metadata:{sphex_charge_id:key,sphex_seller_id:'seller'}})
  await expect(processCustomChargeEvent(database,{id:'evt_x',type:'invoice.paid',account:'acct_seller',created:1,livemode:false,data:{object:{id:'in_outra'}}},stripe)).rejects.toThrow('STRIPE_PAYMENT_MISMATCH')
 })
})
