import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import {afterAll,beforeAll,beforeEach,describe,expect,it} from 'vitest'
const read=(path:string)=>readFileSync(path,'utf8')
const base=read('supabase/migrations/20260811000000_production_baseline.sql')
const seller='11111111-1111-4111-8111-111111111111',product='22222222-2222-4222-8222-222222222222',offer='33333333-3333-4333-8333-333333333333',checkout='44444444-4444-4444-8444-444444444444',order='55555555-5555-4555-8555-555555555555'
let db:PGlite
beforeAll(async()=>{
 db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;`)
 // Execute the actual pre-existing ledger DDL, not a mock of the new functions.
 for(const table of ['products','payment_transactions','payment_transaction_events','financial_event_outbox']){
  const start=base.indexOf(`CREATE TABLE IF NOT EXISTS "public"."${table}" (`),end=base.indexOf('\n);',start)+3
  await db.exec(base.slice(start,end))
  await db.exec(`alter table public.${table} add primary key(id)`)
 }
 await db.exec(`create unique index on payment_transactions(provider,external_transaction_id) where provider is not null and external_transaction_id is not null;alter table payment_transaction_events add unique(event_id);alter table financial_event_outbox add unique(event_id);`)
 const offers=read('supabase/migrations/20260811120000_products_v2.sql'),start=offers.indexOf('create table if not exists public.product_offers (')
 await db.exec(offers.slice(start,offers.indexOf('\n);',start)+3))
 const studio=read('supabase/migrations/20260812150000_checkout_studio.sql')
 await db.exec(studio.slice(studio.indexOf('create table'),studio.indexOf('\n);')+3))
 await db.exec(read('supabase/migrations/20260903110000_stripe_connect_foundation.sql'))
 await db.exec(read('supabase/migrations/20260904120000_stripe_payments.sql'))
 await db.exec(read('supabase/migrations/20260909001000_stripe_checkout_integrity.sql'))
 await db.exec(read('supabase/migrations/20260909010000_stripe_connect_modes.sql'))
 await db.exec(read('supabase/migrations/20261006025244_stripe_checkout_elements.sql'))
 await db.exec(read('supabase/migrations/20261006184000_stripe_sandbox_financial_isolation.sql'))
 await db.exec(read('supabase/migrations/20261021033948_stripe_payment_method.sql'))
 await db.exec(read('supabase/migrations/20261021034747_stripe_subscriptions.sql'))
 await db.exec(read('supabase/migrations/20261022041720_customers_carts_disputes.sql'))
 await db.query('insert into auth.users values($1)',[seller])
 await db.query('insert into products(id,seller_id,name,price_cents) values($1,$2,$3,10000)',[product,seller,'Produto'])
 await db.query("insert into product_offers(id,product_id,seller_id,name,price_cents,billing_type) values($1,$2,$3,'Oferta',10000,'one_time')",[offer,product,seller])
 await db.query("insert into product_checkouts(id,product_id,seller_id,offer_id,name,slug) values($1,$2,$3,$4,'Checkout','checkout')",[checkout,product,seller,offer])
 await db.query("insert into stripe_connected_accounts(user_id,stripe_account_id,stripe_mode) values($1,'acct_seller','live'),($1,'acct_test','test'),($1,'acct_legacy','legacy')",[seller])
},30000)
afterAll(async()=>{await db?.close()})
beforeEach(async()=>{
 await db.exec('truncate stripe_webhook_events,stripe_checkout_orders,payment_transaction_events,financial_event_outbox,payment_transactions,stripe_account_requests')
 await db.query(`insert into stripe_checkout_orders(id,request_key,checkout_id,product_id,seller_id,stripe_account_id,offer_id,product_name,amount_cents,currency,fee_cents,fee_rule,buyer_email,buyer_name)
 values($1,$1,$2,$3,$4,'acct_seller',$5,'Produto',10000,'BRL',100,'bps:100','buyer@example.test','Comprador')`,[order,checkout,product,seller,offer])
})
const second='66666666-6666-4666-8666-666666666666',third='77777777-7777-4777-8777-777777777777'
const apply=async(orderId:string,eventId:string,status:string,intent:string,account='acct_seller')=>db.query("select apply_stripe_payment_v2($1,$2,'payment_intent.succeeded',$3,$4,null,$5,0,now(),'card')",[orderId,eventId,account,intent,status])
const as=async<T,>(sql:string)=>{await db.exec(`select set_config('test.uid','${seller}',false)`);try{return(await db.query<T>(sql)).rows}finally{await db.exec(`select set_config('test.uid','',false)`)}}
const addOrder=(id:string,email:string,account='acct_seller',ageHours=2)=>db.query(`insert into stripe_checkout_orders(id,request_key,checkout_id,product_id,seller_id,stripe_account_id,offer_id,product_name,amount_cents,currency,fee_cents,fee_rule,buyer_email,buyer_name,created_at)
 values($1,$1,$2,$3,$4,$5,$6,'Produto',10000,'BRL',100,'bps:100',$7,'Outro',now()-($8||' hours')::interval)`,[id,checkout,product,seller,account,offer,email,String(ageHours)])
const dispute=(eventId:string,status:string,intent='pi_sale')=>db.query("select apply_stripe_dispute($1,'charge.dispute.updated','acct_seller',$2,'dp_1',$3,'fraudulent',10000,null,now()) as result",[eventId,intent,status])
describe('clientes, carrinhos e contestações no banco',()=>{
 it('exige sessão e agrupa os clientes reais por e-mail',async()=>{
  await expect(db.query('select * from my_customers()')).rejects.toThrow(/AUTH_REQUIRED/)
  await apply(order,'evt_1','approved','pi_sale')
  await addOrder(second,'BUYER@example.test');await apply(second,'evt_2','approved','pi_two')
  const rows=await as<{email:string;purchases:number;spent_cents:number}>('select * from my_customers()')
  expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({email:'buyer@example.test',purchases:2});expect(Number(rows[0].spent_cents)).toBe(20000)
 })
 it('não mostra vendas de teste como clientes nem como carrinho',async()=>{
  await addOrder(second,'teste@example.test','acct_test');await apply(second,'evt_t','approved','pi_test','acct_test')
  await addOrder(third,'sandbox@example.test','acct_test')
  expect(await as('select * from my_customers()')).toHaveLength(0)
  expect((await as<{buyer_email:string}>('select * from my_abandoned_checkouts()')).map(row=>row.buyer_email)).not.toContain('sandbox@example.test')
 })
 it('carrinho abandonado só depois de 1 hora e some quando o mesmo e-mail compra depois',async()=>{
  await db.query("update stripe_checkout_orders set created_at=now()-interval '3 hours' where id=$1",[order])
  await addOrder(second,'novo@example.test','acct_seller',0)
  expect((await as<{buyer_email:string}>('select * from my_abandoned_checkouts()')).map(row=>row.buyer_email)).toEqual(['buyer@example.test'])
  await addOrder(third,'buyer@example.test','acct_seller',1.5);await apply(third,'evt_3','approved','pi_three')
  expect(await as('select * from my_abandoned_checkouts()')).toHaveLength(0)
 })
 it('contestação marca a venda, vitória devolve para aprovada e evento repetido é ignorado',async()=>{
  await apply(order,'evt_1','approved','pi_sale')
  await dispute('evt_d1','needs_response')
  expect((await db.query<{status:string;dispute:string}>("select status,metadata->>'dispute_status' as dispute from payment_transactions")).rows[0]).toEqual({status:'chargeback',dispute:'needs_response'})
  expect((await dispute('evt_d1','won')).rows[0]).toEqual({result:{duplicate:true}})
  await dispute('evt_d2','won')
  expect((await db.query<{status:string}>('select status from payment_transactions')).rows[0].status).toBe('approved')
  expect((await dispute('evt_d3','lost','pi_desconhecido')).rows[0]).toEqual({result:{ignored:true}})
 })
 it('mantém a função de contestação fora do alcance do cliente',()=>{
  const sql=read('supabase/migrations/20261022041720_customers_carts_disputes.sql')
  expect(sql).toMatch(/revoke all on function public\.apply_stripe_dispute\([^)]*\) from public,anon,authenticated;/)
  expect(sql).toMatch(/grant execute on function public\.my_customers\(\) to authenticated;/)
 })
})
