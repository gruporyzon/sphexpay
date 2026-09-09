import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import {afterAll,beforeAll,beforeEach,describe,expect,it} from 'vitest'
const read=(path:string)=>readFileSync(path,'utf8')
const base=read('supabase/migrations/20260811000000_production_baseline.sql')
const seller='11111111-1111-4111-8111-111111111111',product='22222222-2222-4222-8222-222222222222',offer='33333333-3333-4333-8333-333333333333',checkout='44444444-4444-4444-8444-444444444444',order='55555555-5555-4555-8555-555555555555'
let db:PGlite
beforeAll(async()=>{
 db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as 'select null::uuid';`)
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
 await db.query('insert into auth.users values($1)',[seller])
 await db.query('insert into products(id,seller_id,name,price_cents) values($1,$2,$3,10000)',[product,seller,'Produto'])
 await db.query("insert into product_offers(id,product_id,seller_id,name,price_cents,billing_type) values($1,$2,$3,'Oferta',10000,'one_time')",[offer,product,seller])
 await db.query("insert into product_checkouts(id,product_id,seller_id,offer_id,name,slug) values($1,$2,$3,$4,'Checkout','checkout')",[checkout,product,seller,offer])
 await db.query("insert into stripe_connected_accounts(user_id,stripe_account_id) values($1,'acct_seller')",[seller])
},30000)
afterAll(async()=>{await db?.close()})
beforeEach(async()=>{
 await db.exec('truncate stripe_webhook_events,stripe_checkout_orders,payment_transaction_events,financial_event_outbox,payment_transactions,stripe_account_requests')
 await db.query(`insert into stripe_checkout_orders(id,request_key,checkout_id,product_id,seller_id,stripe_account_id,offer_id,product_name,amount_cents,currency,fee_cents,fee_rule,buyer_email,buyer_name)
 values($1,$1,$2,$3,$4,'acct_seller',$5,'Produto',10000,'BRL',100,'bps:100','buyer@example.test','Comprador')`,[order,checkout,product,seller,offer])
})
const apply=async(eventId:string,status:string,refunded=0,time='2026-09-04T12:00:00Z',account='acct_seller')=>(await db.query<{result:any}>("select apply_stripe_payment($1,$2,'payment_intent.succeeded',$3,'pi_sale','ch_sale',$4,$5,$6) as result",[order,eventId,account,status,refunded,time])).rows[0].result
const count=async(table:string)=>(await db.query<{n:number}>(`select count(*)::int as n from ${table}`)).rows[0].n
describe('migration Stripe executada em PostgreSQL',()=>{
 it('reenvios e eventos correlacionados criam uma venda e uma notificação',async()=>{
  await apply('evt_pi','approved');expect(await apply('evt_pi','approved')).toEqual({duplicate:true});await apply('evt_charge','approved');await apply('evt_checkout','approved')
  expect(await count('payment_transactions')).toBe(1);expect(await count('payment_transaction_events')).toBe(3);expect(await count('financial_event_outbox')).toBe(1)
 })
 it('pagamento recusado pode aprovar e não regride com evento atrasado',async()=>{
  await apply('evt_fail','declined');await apply('evt_success','approved',0,'2026-09-04T12:01:00Z');await apply('evt_old','declined')
  expect((await db.query<{status:string}>('select status from payment_transactions')).rows[0].status).toBe('approved')
 })
 it('aprovação autoritativa não é descartada por timestamp de um evento anterior',async()=>{
  await apply('evt_newer_failure','declined',0,'2026-09-04T12:02:00Z')
  await apply('evt_delayed_success','approved',0,'2026-09-04T12:01:00Z')
  expect((await db.query<{status:string}>('select status from payment_transactions')).rows[0].status).toBe('approved')
  expect(await count('financial_event_outbox')).toBe(1)
 })
 it('reembolso é terminal e reembolso parcial persiste o valor',async()=>{
  await apply('evt_partial','approved',500)
  expect((await db.query<any>('select refunded_cents from stripe_checkout_orders')).rows[0].refunded_cents).toBe(500)
  await apply('evt_refund','refunded',10000);await apply('evt_late','approved',0,'2026-09-04T12:02:00Z')
  expect((await db.query<any>('select status,metadata from payment_transactions')).rows[0]).toMatchObject({status:'refunded',metadata:{refunded_cents:10000}})
  expect(await count('financial_event_outbox')).toBe(2)
 })
 it('conta incompatível causa rollback sem consumir o evento',async()=>{
  await expect(apply('evt_bad','approved',0,undefined,'acct_other')).rejects.toThrow('STRIPE_IDENTITY_MISMATCH')
  expect(await count('stripe_webhook_events')).toBe(0);expect(await count('payment_transactions')).toBe(0)
 })
 it('reserva parâmetros imutáveis e exige reconciliação após 23 horas',async()=>{
  const reserve=async(parameters:object)=>(await db.query<any>("select reserve_stripe_account_for_mode($1,'test',$2) as result",[seller,parameters])).rows[0].result
  expect(await reserve({contact_email:'first@example.test'})).toEqual({contact_email:'first@example.test'})
  expect(await reserve({contact_email:'changed@example.test'})).toEqual({contact_email:'first@example.test'})
  await db.exec("update stripe_account_requests set created_at=now()-interval '24 hours'")
  await expect(reserve({})).rejects.toThrow('CONNECT_RECONCILIATION_REQUIRED')
 })
 it('não permite substituir stripe_account_id existente',async()=>{
  await expect(db.exec("update stripe_connected_accounts set stripe_account_id='acct_other'")).rejects.toThrow('CONNECT_IDENTITY_IMMUTABLE')
 })
 it('anon e authenticated não podem escrever nem chamar funções financeiras',async()=>{
  for(const role of ['anon','authenticated']){
   const rows=(await db.query<any>(`select has_table_privilege($1,'stripe_checkout_orders','INSERT') as writable,has_function_privilege($1,'reserve_stripe_account(uuid,jsonb)','EXECUTE') as callable`,[role])).rows
   expect(rows[0]).toEqual({writable:false,callable:false})
  }
 })
})
