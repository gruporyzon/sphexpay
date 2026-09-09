import {Readable} from 'node:stream'
import Stripe from 'stripe'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
// @ts-expect-error Backend JavaScript stays outside the frontend bundle.
import {configureProductPayments,createCheckout,feeConfiguration,validateCheckoutInput} from '../../server/stripe/payments.js'
// @ts-expect-error Backend JavaScript stays outside the frontend bundle.
import {processStripeEvent,stripeWebhookHandler} from '../../server/stripe/webhook.js'
// @ts-expect-error Backend JavaScript stays outside the frontend bundle.
import {ensureConnectedAccount,retrieveAndSync} from '../../server/stripe/connect.js'
const checkoutId='11111111-1111-4111-8111-111111111111',requestKey='22222222-2222-4222-8222-222222222222'
const input=()=>({checkoutId,requestKey,buyer:{name:'Comprador Teste',email:'buyer@example.test'}})
const order=()=>({id:'33333333-3333-4333-8333-333333333333',checkout_id:checkoutId,request_key:requestKey,product_id:'product',seller_id:'seller',stripe_account_id:'acct_seller',offer_id:'offer',product_name:'Produto',amount_cents:10000,currency:'BRL',fee_cents:100,fee_rule:'bps:100',buyer_name:'Comprador Teste',buyer_email:'buyer@example.test',created_at:new Date().toISOString(),session_id:null})
function fixture(){
 const tables:Record<string,any[]>={
  product_checkouts:[{id:checkoutId,seller_id:'seller',product_id:'product',status:'published',deleted_at:null,published_version_id:'version'}],
  checkout_versions:[{id:'version',checkout_id:checkoutId,seller_id:'seller',offer_id:'offer'}],
  products:[{id:'product',seller_id:'seller',name:'Produto',status:'active',active:true,deleted_at:null,currency:'BRL'}],
  product_offers:[{id:'offer',product_id:'product',seller_id:'seller',status:'active',deleted_at:null,price_cents:10000,currency:'BRL',billing_type:'one_time',installments:1}],
  product_payment_settings:[{product_id:'product',seller_id:'seller',enabled_methods:['card']}],
  stripe_connected_accounts:[{stripe_mode:'test',user_id:'seller',stripe_account_id:'acct_seller',stripe_account_type:'express',stripe_charges_enabled:true,stripe_payouts_enabled:true}],
  stripe_checkout_orders:[],stripe_webhook_events:[]
 }
 const database={rpc:vi.fn(async()=>({data:{duplicate:false},error:null})),from:vi.fn((table:string)=>{
  const filters:((row:any)=>boolean)[]=[];let patch:any
  const rows=()=>tables[table].filter(row=>filters.every(f=>f(row)))
  const q:any={select:()=>q,eq:(key:string,value:any)=>{filters.push(row=>row[key]===value);return q},is:(key:string,value:any)=>{filters.push(row=>row[key]===value);return q},
   update:(value:any)=>{patch=value;return q},upsert:(value:any,options:any)=>{if(!tables[table].some(row=>row[options.onConflict]===value[options.onConflict]))tables[table].push({...order(),...value});return q},
   maybeSingle:async()=>({data:rows()[0]||null,error:null}),single:async()=>{rows().forEach(row=>Object.assign(row,patch));return{data:rows()[0],error:null}},
   then:(resolve:any)=>{if(patch)rows().forEach(row=>Object.assign(row,patch));return Promise.resolve({data:null,error:null}).then(resolve)}}
  return q
 })}
 const intent:any={id:'pi_sale',metadata:{sphex_order_id:order().id,sphex_seller_id:'seller',sphex_product_id:'product'},amount:10000,currency:'brl',application_fee_amount:100,status:'succeeded',livemode:false,latest_charge:{id:'ch_sale',amount_refunded:0}}
 const stripe:any={accounts:{retrieve:vi.fn(async()=>({id:'acct_seller',capabilities:{card_payments:'active'},metadata:{sphex_user_id:'seller'},charges_enabled:true,payouts_enabled:true,details_submitted:true}))},checkout:{sessions:{create:vi.fn(async()=>({id:'cs_sale',url:'https://checkout.stripe.com/test'})),retrieve:vi.fn(async()=>({id:'cs_sale',mode:'payment',client_reference_id:order().id,payment_intent:'pi_sale',status:'open',url:'https://checkout.stripe.com/test'}))}},paymentIntents:{retrieve:vi.fn(async()=>intent)}}
 return{tables,database,stripe,intent}
}
const event=(type='payment_intent.succeeded')=>({id:'evt_sale',type,account:'acct_seller',created:1788540000,livemode:false,data:{object:{id:'pi_sale',payment_intent:'pi_sale'}}})
describe('pagamentos Stripe',()=>{
 beforeEach(()=>{vi.stubEnv('APP_URL','https://sphexpay.example');vi.stubEnv('STRIPE_SECRET_KEY','sk_test_fixture');vi.stubEnv('STRIPE_PLATFORM_FEE_BPS','100')})
 afterEach(()=>vi.unstubAllEnvs())
 it.each(['amount','amountCents','currency','merchantId','stripe_account_id','stripeAccountId'])('recusa campo controlado pelo servidor: %s',field=>{
  expect(()=>validateCheckoutInput({...input(),[field]:field.includes('stripe')?'acct_other':1})).toThrow()
 })
 it('impede habilitar cartão de produto pertencente a outro usuário',async()=>{
  const {database,stripe}=fixture();await expect(configureProductPayments(database,{id:'other'},{productId:checkoutId,enabled:true},stripe)).rejects.toMatchObject({code:'PRODUCT_NOT_FOUND'})
 })
 it('desabilita cartão sem depender da disponibilidade da Stripe',async()=>{
  const {database,stripe,tables}=fixture();tables.products[0].id=checkoutId;tables.product_payment_settings[0].product_id=checkoutId
  expect(await configureProductPayments(database,{id:'seller'},{productId:checkoutId,enabled:false},stripe)).toEqual({enabled:false})
  expect(stripe.accounts.retrieve).not.toHaveBeenCalled()
 })
 it('não oferece cartão desabilitado pelo vendedor',async()=>{
  const {database,stripe,tables}=fixture();tables.product_payment_settings[0].enabled_methods=[]
  await expect(createCheckout(database,input(),stripe)).rejects.toMatchObject({code:'CHECKOUT_UNAVAILABLE'});expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
 })
 it('cria direct charge usando apenas preço, produto e conta do banco',async()=>{
  const {database,stripe,tables}=fixture();await createCheckout(database,input(),stripe)
  expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({line_items:[{quantity:1,price_data:{currency:'brl',unit_amount:10000,product_data:{name:'Produto'}}}],payment_intent_data:expect.objectContaining({application_fee_amount:100})}),{stripeAccount:'acct_seller',idempotencyKey:`sphex-checkout-${order().id}`})
  expect(tables.stripe_checkout_orders[0].session_id).toBe('cs_sale')
  await createCheckout(database,input(),stripe);expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1)
 })
 it('bloqueia conta de outro merchant antes de criar cobrança',async()=>{
  const {database,stripe}=fixture();stripe.accounts.retrieve.mockResolvedValue({id:'acct_seller',metadata:{sphex_user_id:'other'},charges_enabled:true,payouts_enabled:true})
  await expect(createCheckout(database,input(),stripe)).rejects.toMatchObject({code:'CONNECT_OWNERSHIP_MISMATCH'});expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
 })
 it('retry após timeout conserva preço, taxa e URLs mesmo com configurações alteradas',async()=>{
  const {database,stripe,tables}=fixture()
  stripe.checkout.sessions.create.mockRejectedValueOnce(new Error('timeout'))
  await expect(createCheckout(database,input(),stripe)).rejects.toThrow('timeout')
  const original=stripe.checkout.sessions.create.mock.calls[0]
  vi.stubEnv('APP_URL','https://new.sphexpay.example');vi.stubEnv('STRIPE_PLATFORM_FEE_BPS','200')
  tables.product_offers[0].price_cents=20000
  await createCheckout(database,input(),stripe)
  expect(stripe.checkout.sessions.create.mock.calls[1]).toEqual(original)
 })
 it('pedido antigo sem origem reservada exige reconciliação sem recriar sessão',async()=>{
  const {database,stripe,tables}=fixture();tables.stripe_checkout_orders.push(order())
  await expect(createCheckout(database,input(),stripe)).rejects.toMatchObject({code:'PAYMENT_RECONCILIATION_REQUIRED'})
  expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
 })
 it('não cobra oferta de outro vendedor nem oferta pausada',async()=>{
  const {database,stripe,tables}=fixture();tables.product_offers[0].seller_id='other'
  await expect(createCheckout(database,input(),stripe)).rejects.toMatchObject({code:'CHECKOUT_UNAVAILABLE'})
  tables.product_offers[0].seller_id='seller';tables.product_offers[0].status='paused'
  await expect(createCheckout(database,input(),stripe)).rejects.toThrow();expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
 })
 it('bloqueia live sem ativação explícita e taxa ausente',async()=>{
  const {database,stripe,tables}=fixture();tables.stripe_connected_accounts[0].stripe_mode='live';vi.stubEnv('STRIPE_SECRET_KEY','sk_live_fixture');vi.stubEnv('STRIPE_LIVE_PAYMENTS_ENABLED','false')
  await expect(createCheckout(database,input(),stripe)).rejects.toMatchObject({code:'LIVE_PAYMENTS_DISABLED'})
  vi.stubEnv('STRIPE_PLATFORM_FEE_BPS','');expect(()=>feeConfiguration(10000)).toThrow()
  vi.stubEnv('STRIPE_PLATFORM_FEE_BPS','0');expect(feeConfiguration(10000)).toEqual({fee:0,rule:'bps:0'})
 })
 it('bloqueia tentativa antiga sem recriar uma cobrança possivelmente existente',async()=>{
  const {database,stripe,tables}=fixture();tables.stripe_checkout_orders.push({...order(),created_at:'2020-01-01T00:00:00Z'})
  await expect(createCheckout(database,input(),stripe)).rejects.toMatchObject({code:'PAYMENT_RECONCILIATION_REQUIRED'});expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
 })
 it.each(['payment_intent.succeeded','charge.succeeded','checkout.session.completed'])('normaliza %s para o mesmo PaymentIntent',async type=>{
  const {database,stripe,tables}=fixture();tables.stripe_checkout_orders.push({...order(),session_id:'cs_sale'});await processStripeEvent(database,event(type),stripe)
  expect(database.rpc).toHaveBeenCalledWith('apply_stripe_payment',expect.objectContaining({p_intent:'pi_sale',p_charge:'ch_sale',p_status:'approved',p_account:'acct_seller'}))
 })
 it('registra recusa a partir do estado atual da Stripe',async()=>{
  const {database,stripe,tables,intent}=fixture();tables.stripe_checkout_orders.push({...order(),session_id:'cs_sale'});intent.status='requires_payment_method';intent.last_payment_error={code:'card_declined'}
  await processStripeEvent(database,event('payment_intent.payment_failed'),stripe)
  expect(database.rpc).toHaveBeenCalledWith('apply_stripe_payment',expect.objectContaining({p_status:'declined'}))
 })
 it('registra reembolso total e parcial sem inventar reembolso total',async()=>{
  const {database,stripe,tables,intent}=fixture();tables.stripe_checkout_orders.push({...order(),session_id:'cs_sale'});intent.latest_charge.amount_refunded=500
  await processStripeEvent(database,event('charge.refunded'),stripe)
  expect(database.rpc).toHaveBeenLastCalledWith('apply_stripe_payment',expect.objectContaining({p_status:'approved',p_refunded:500}))
  intent.latest_charge.amount_refunded=10000;await processStripeEvent(database,event('charge.refunded'),stripe)
  expect(database.rpc).toHaveBeenLastCalledWith('apply_stripe_payment',expect.objectContaining({p_status:'refunded'}))
 })
 it('ignora duplicata persistida sem consultar ou processar pagamento',async()=>{
  const {database,stripe,tables}=fixture();tables.stripe_webhook_events.push({event_id:'evt_sale'})
  expect(await processStripeEvent(database,event(),stripe)).toEqual({duplicate:true});expect(database.rpc).not.toHaveBeenCalled();expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled()
 })
 it('recusa evento assinado cujo pagamento não corresponde à conta ou ao preço',async()=>{
  const {database,stripe,tables,intent}=fixture();tables.stripe_checkout_orders.push({...order(),stripe_account_id:'acct_other'})
  await expect(processStripeEvent(database,event(),stripe)).rejects.toThrow('STRIPE_PAYMENT_MISMATCH')
  tables.stripe_checkout_orders[0].stripe_account_id='acct_seller';intent.amount=1
  await expect(processStripeEvent(database,event(),stripe)).rejects.toThrow('STRIPE_PAYMENT_MISMATCH');expect(database.rpc).not.toHaveBeenCalled()
 })
 it('account.updated consulta estado atual e preserva Express',async()=>{
  const {database,stripe,tables}=fixture();await processStripeEvent(database,{...event('account.updated'),data:{object:{id:'acct_seller',charges_enabled:false}}},stripe)
  expect(tables.stripe_connected_accounts[0]).toMatchObject({stripe_account_type:'express',stripe_charges_enabled:true,stripe_details_submitted:true})
 })
 it('não aceita um PaymentIntent com metadata copiada de outro Checkout',async()=>{
  const {database,stripe,tables}=fixture();tables.stripe_checkout_orders.push({...order(),session_id:'cs_sale'})
  stripe.checkout.sessions.retrieve.mockResolvedValue({id:'cs_sale',mode:'payment',client_reference_id:order().id,payment_intent:'pi_different'})
  await expect(processStripeEvent(database,event(),stripe)).rejects.toThrow('STRIPE_SESSION_MISMATCH')
  expect(database.rpc).not.toHaveBeenCalled()
 })
 it('webhook anterior à persistência da sessão pode ser reenviado sem consumir o evento',async()=>{
  const {database,stripe,tables}=fixture();tables.stripe_checkout_orders.push(order())
  await expect(processStripeEvent(database,event(),stripe)).rejects.toThrow('STRIPE_SESSION_PENDING')
  expect(database.rpc).not.toHaveBeenCalled()
  tables.stripe_checkout_orders[0].session_id='cs_sale'
  await processStripeEvent(database,event(),stripe)
  expect(database.rpc).toHaveBeenCalledTimes(1)
  expect(stripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_sale',{},{stripeAccount:'acct_seller'})
 })
 it('reserva falhada impede criação Connect antes da chamada externa',async()=>{
  const {database,stripe,tables}=fixture();tables.stripe_connected_accounts=[];database.rpc.mockResolvedValue({data:null,error:{message:'expired'}} as any);stripe.v2={core:{accounts:{create:vi.fn()}}}
  await expect(ensureConnectedAccount(database,{id:'seller'},stripe)).rejects.toMatchObject({code:'CONNECT_RECONCILIATION_REQUIRED'});expect(stripe.v2.core.accounts.create).not.toHaveBeenCalled()
 })
 it('recusa sincronização usando usuário que não é dono',async()=>{
  const {database,stripe,tables}=fixture();await expect(retrieveAndSync(database,'other',tables.stripe_connected_accounts[0],stripe)).rejects.toMatchObject({code:'CONNECT_OWNERSHIP_MISMATCH'})
 })
})
describe('assinatura oficial e payload bruto',()=>{
 afterEach(()=>vi.unstubAllEnvs())
 const sdk=new Stripe('sk_test_fixture'),secret='whsec_fixture'
 const response=()=>({statusCode:200,body:null as any,status(code:number){this.statusCode=code;return this},json(data:any){this.body=data;return this}})
 it.each(['missing','invalid','altered','expired'])('rejeita assinatura %s antes de acessar banco',async mode=>{
  vi.stubEnv('STRIPE_WEBHOOK_SECRET',secret)
  const payload=JSON.stringify(event()),signature=mode==='missing'?undefined:mode==='invalid'?'invalid':sdk.webhooks.generateTestHeaderString({payload,secret,timestamp:mode==='expired'?1:Math.floor(Date.now()/1000)})
  const request=Object.assign(Readable.from([mode==='altered'?payload+' ':payload]),{method:'POST',headers:{'stripe-signature':signature}}),res=response(),factory=vi.fn()
  await stripeWebhookHandler(request,res,factory,()=>sdk);expect(res.statusCode).toBe(400);expect(factory).not.toHaveBeenCalled()
 })
 it('valida bytes exatos sem acessar o getter do corpo parseado',async()=>{
  vi.stubEnv('STRIPE_WEBHOOK_SECRET',secret)
  const payload=' {"id":"evt_ignore", "type":"unknown"}\n',signature=sdk.webhooks.generateTestHeaderString({payload,secret})
  const request=Object.assign(Readable.from([payload.slice(0,8),payload.slice(8)]),{method:'POST',headers:{'stripe-signature':signature}})
  Object.defineProperty(request,'body',{get(){throw new Error('Parsed body accessed')}})
  const {database}=fixture(),res=response();await stripeWebhookHandler(request,res,()=>database,()=>sdk);expect(res.statusCode).toBe(200)
 })
})
