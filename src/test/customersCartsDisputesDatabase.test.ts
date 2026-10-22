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
 await db.exec(read('supabase/migrations/20261022050000_custom_charges.sql'))
 await db.exec(read('supabase/migrations/20260831223000_affiliates_v1.sql').replace('create extension if not exists pgcrypto;',''))
 await db.exec(read('supabase/migrations/20261022060000_affiliate_attribution.sql'))
 await db.exec(`alter table products add column if not exists product_type text not null default 'digital';alter table products add column if not exists deleted_at timestamptz;alter table product_checkouts add column if not exists status text not null default 'published';alter table product_checkouts add column if not exists deleted_at timestamptz;`)
 await db.exec(read('supabase/migrations/20261022070000_shipping_and_fulfillment.sql'))
 await db.exec(`create table product_coupons(id uuid primary key,uses_count integer not null default 0,updated_at timestamptz)`)
 await db.exec(read('supabase/migrations/20261022080000_checkout_coupons.sql'))
 await db.exec(read('supabase/migrations/20261022110000_team_members.sql'))
 await db.query('insert into auth.users values($1)',[seller])
 await db.query('insert into products(id,seller_id,name,price_cents) values($1,$2,$3,10000)',[product,seller,'Produto'])
 await db.query("insert into product_offers(id,product_id,seller_id,name,price_cents,billing_type) values($1,$2,$3,'Oferta',10000,'one_time')",[offer,product,seller])
 await db.query("insert into product_checkouts(id,product_id,seller_id,offer_id,name,slug) values($1,$2,$3,$4,'Checkout','checkout')",[checkout,product,seller,offer])
 await db.query("insert into stripe_connected_accounts(user_id,stripe_account_id,stripe_mode) values($1,'acct_seller','live'),($1,'acct_test','test'),($1,'acct_legacy','legacy')",[seller])
},30000)
afterAll(async()=>{await db?.close()})
beforeEach(async()=>{
 await db.exec('truncate shipping_rates,affiliate_commission_payments,custom_charges,stripe_webhook_events,stripe_checkout_orders,payment_transaction_events,financial_event_outbox,payment_transactions,stripe_account_requests')
 await db.query(`insert into stripe_checkout_orders(id,request_key,checkout_id,product_id,seller_id,stripe_account_id,offer_id,product_name,amount_cents,currency,fee_cents,fee_rule,buyer_email,buyer_name)
 values($1,$1,$2,$3,$4,'acct_seller',$5,'Produto',10000,'BRL',100,'bps:100','buyer@example.test','Comprador')`,[order,checkout,product,seller,offer])
})
const count=async(table:string)=>Number((await db.query<{n:number}>(`select count(*)::int as n from ${table}`)).rows[0].n)
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

describe('cobranças personalizadas no banco',()=>{
 const charge='88888888-8888-4888-8888-888888888888'
 const create=(mode='live')=>db.query(`insert into custom_charges(id,seller_id,stripe_account_id,stripe_mode,customer_name,customer_email,description,amount_cents,methods,fee_cents,fee_rule,due_date,invoice_id,status)
  values($1,$2,'acct_seller',$3,'Ana','ana@exemplo.com','Mentoria',15000,array['pix','card'],150,'bps:100',current_date+3,'in_1','open')`,[charge,seller,mode])
 const pay=(eventId:string,status='paid',amount=15000)=>db.query("select apply_custom_charge_invoice($1,$2,'invoice.paid','acct_seller','in_1','pi_c','ch_c',$3,$4,150,'pix',now()) as result",[charge,eventId,status,amount])
 it('fatura paga vira venda aprovada uma única vez e não volta para aberta',async()=>{
  await create()
  await pay('evt_c1');await pay('evt_c1');await pay('evt_c2','void')
  const sale=(await db.query<{status:string;payment_method:string;net_amount_cents:number;product_name:string}>('select status,payment_method,net_amount_cents,product_name from payment_transactions')).rows
  expect(sale).toHaveLength(1);expect(sale[0]).toMatchObject({status:'approved',payment_method:'pix',product_name:'Mentoria'});expect(Number(sale[0].net_amount_cents)).toBe(14850)
  expect((await db.query<{status:string}>('select status from custom_charges')).rows[0].status).toBe('paid')
  expect(await count('financial_event_outbox')).toBe(1)
 })
 it('cobrança de teste não gera receita e valor divergente é recusado',async()=>{
  await create('test');await pay('evt_t1')
  expect(await count('payment_transactions')).toBe(0)
  await db.exec('truncate custom_charges,stripe_webhook_events');await create()
  await expect(pay('evt_bad','paid',100)).rejects.toThrow(/STRIPE_PAYMENT_MISMATCH/)
 })
 it('vendedor só lê as próprias cobranças e não escreve',()=>{
  const sql=read('supabase/migrations/20261022050000_custom_charges.sql')
  expect(sql).toMatch(/using \(seller_id=\(select auth\.uid\(\)\)\)/)
  expect(sql).toMatch(/grant select on public\.custom_charges to authenticated;/)
  expect(sql).not.toMatch(/grant[^;]*(insert|update|delete)[^;]*custom_charges[^;]*to authenticated/i)
  expect(sql).toMatch(/revoke all on function public\.apply_custom_charge_invoice\([^)]*\) from public,anon,authenticated;/)
 })
})

describe('afiliados no banco',()=>{
 const affiliate='99999999-9999-4999-8999-999999999999'
 const setup=async()=>{
  await db.query("insert into affiliates(id,merchant_id,public_id,name,status) values($1,$2,'AFF-TESTE123','Bruno','active') on conflict do nothing",[affiliate,seller])
  await db.query('update stripe_checkout_orders set affiliate_id=$1,affiliate_commission_cents=3000 where id=$2',[affiliate,order])
 }
 it('lista a venda com comissão só enquanto aprovada e só para o dono',async()=>{
  await setup();await apply(order,'evt_a1','approved','pi_sale')
  const rows=await as<{commission_cents:number;affiliate_name:string}>("select * from my_affiliate_sales(now()-interval '1 day',now()+interval '1 day')")
  expect(rows).toHaveLength(1);expect(rows[0].affiliate_name).toBe('Bruno');expect(Number(rows[0].commission_cents)).toBe(3000)
  await expect(db.query("select * from my_affiliate_sales(now()-interval '1 day',now())")).rejects.toThrow(/AUTH_REQUIRED/)
  await db.query("update payment_transactions set status='refunded',refunded_at=now()")
  expect(Number((await as<{commission_cents:number}>("select * from my_affiliate_sales(now()-interval '1 day',now()+interval '1 day')"))[0].commission_cents)).toBe(0)
 })
 it('marca comissão paga apenas em pedido aprovado do próprio vendedor',async()=>{
  await setup();await apply(order,'evt_a2','approved','pi_sale')
  expect((await as<{n:number}>(`select set_affiliate_commission_paid(array['${order}']::uuid[],true) as n`))[0].n).toBe(1)
  expect((await as<{paid:string|null}>("select commission_paid_at as paid from my_affiliate_sales(now()-interval '1 day',now()+interval '1 day')"))[0].paid).not.toBeNull()
  expect((await as<{n:number}>(`select set_affiliate_commission_paid(array['${order}']::uuid[],false) as n`))[0].n).toBe(1)
  await db.exec(`select set_config('test.uid','${second}',false)`)
  expect((await db.query<{n:number}>(`select set_affiliate_commission_paid(array['${order}']::uuid[],true) as n`)).rows[0].n).toBe(0)
  await db.exec(`select set_config('test.uid','',false)`)
 })
 it('impede comissão maior que a venda',async()=>{
  await expect(db.query('update stripe_checkout_orders set affiliate_commission_cents=999999 where id=$1',[order])).rejects.toThrow()
 })
})

describe('frete e encomendas no banco',()=>{
 const rate='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 const addRate=(active=true)=>db.query("insert into shipping_rates(id,seller_id,name,price_cents,active) values($1,$2,'Padrão',2000,$3)",[rate,seller,active])
 const ship=()=>db.query(`update stripe_checkout_orders set shipping_rate_id=$1,shipping_cents=2000,amount_cents=12000,shipping_address='{"recipient":"Comprador","postalCode":"01310-100","street":"Av. Paulista","number":"1000","district":"Bela Vista","city":"São Paulo","state":"SP"}' where id=$2`,[rate,order])
 it('mostra fretes ativos só para produto físico publicado',async()=>{
  await addRate();await db.query("update product_checkouts set status='published'")
  expect((await db.query('select * from get_checkout_shipping_rates($1)',[checkout])).rows).toHaveLength(0)
  await db.query("update products set product_type='physical'")
  expect((await db.query('select * from get_checkout_shipping_rates($1)',[checkout])).rows).toHaveLength(1)
  await db.query('update shipping_rates set active=false')
  expect((await db.query('select * from get_checkout_shipping_rates($1)',[checkout])).rows).toHaveLength(0)
  await db.query("update products set product_type='digital'");await db.query("update product_checkouts set status='draft'")
 })
 it('encomenda paga aparece para o dono e recebe status e rastreio validados',async()=>{
  await addRate();await ship();await apply(order,'evt_s1','approved','pi_sale')
  const rows=await as<{fulfillment_status:string;shipping_rate_name:string}>('select * from my_shipments()')
  expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({fulfillment_status:'pending',shipping_rate_name:'Padrão'})
  await as(`select update_shipment('${order}','shipped',' BR123456789BR ')`)
  const saved=(await db.query<{fulfillment_status:string;tracking_code:string;shipped_at:string|null}>('select fulfillment_status,tracking_code,shipped_at from stripe_checkout_orders')).rows[0]
  expect(saved).toMatchObject({fulfillment_status:'shipped',tracking_code:'BR123456789BR'});expect(saved.shipped_at).not.toBeNull()
  await expect(as(`select update_shipment('${order}','shipped','<script>')`)).rejects.toThrow(/INVALID_TRACKING/)
  await expect(as(`select update_shipment('${order}','perdido',null)`)).rejects.toThrow(/INVALID_STATUS/)
  await db.exec(`select set_config('test.uid','${second}',false)`)
  await expect(db.query(`select update_shipment('${order}','delivered',null)`)).rejects.toThrow(/ORDER_NOT_FOUND/)
  await db.exec(`select set_config('test.uid','',false)`)
 })
 it('frete não pode ser maior ou igual ao total do pedido',async()=>{
  await expect(db.query('update stripe_checkout_orders set shipping_cents=amount_cents where id=$1',[order])).rejects.toThrow()
 })
})

describe('cupons no banco',()=>{
 const coupon='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
 it('conta o uso só quando o pagamento é aprovado, uma vez',async()=>{
  await db.query('insert into product_coupons(id) values($1) on conflict do nothing',[coupon])
  await db.query('update product_coupons set uses_count=0')
  await db.query('update stripe_checkout_orders set coupon_id=$1,discount_cents=1000 where id=$2',[coupon,order])
  await apply(order,'evt_c_pending','pending','pi_sale')
  expect((await db.query<{uses_count:number}>('select uses_count from product_coupons')).rows[0].uses_count).toBe(0)
  await apply(order,'evt_c_ok','approved','pi_sale');await apply(order,'evt_c_ok2','approved','pi_sale')
  expect((await db.query<{uses_count:number}>('select uses_count from product_coupons')).rows[0].uses_count).toBe(1)
 })
 it('não aceita desconto negativo',async()=>{
  await expect(db.query('update stripe_checkout_orders set discount_cents=-1 where id=$1',[order])).rejects.toThrow()
 })
})

describe('equipe com cargos no banco',()=>{
 const member='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 const asUser=async<T,>(user:string,email:string,sql:string,params:unknown[]=[])=>{await db.exec(`select set_config('test.uid','${user}',false);select set_config('test.email','${email}',false)`);try{return(await db.query<T>(sql,params)).rows}finally{await db.exec(`select set_config('test.uid','',false);select set_config('test.email','',false)`)}}
 const invite=async(role:string)=>{await db.exec('delete from team_members');return(await asUser<{t:string}>(seller,'dono@x.com','select invite_team_member($1,$2) as t',['Equipe@X.com',role]))[0].t}
 beforeAll(async()=>{
  await db.exec(`create or replace function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('email',nullif(current_setting('test.email',true),'')) $$`)
  await db.query('insert into auth.users values($1) on conflict do nothing',[member])
 })
 it('convite só vale para o e-mail convidado e dentro de 7 dias',async()=>{
  const token=await invite('support')
  await expect(asUser(member,'outro@x.com','select accept_team_invite($1)',[token])).rejects.toThrow(/INVITE_EMAIL_MISMATCH/)
  await db.query("update team_members set invited_at=now()-interval '8 days'")
  await expect(asUser(member,'equipe@x.com','select accept_team_invite($1)',[token])).rejects.toThrow(/INVITE_EXPIRED/)
  await db.query('update team_members set invited_at=now()')
  expect((await asUser<{o:string}>(member,'equipe@x.com','select accept_team_invite($1) as o',[token]))[0].o).toBe(seller)
  await expect(asUser(member,'equipe@x.com','select accept_team_invite($1)',[token])).rejects.toThrow(/INVITE_NOT_FOUND/)
  await expect(asUser(seller,'dono@x.com','select invite_team_member($1,$2)',['dono@x.com','admin'])).rejects.toThrow(/SELF_INVITE/)
 })
 it('suporte vê clientes e atualiza envio; financeiro vê relatórios mas não mexe em envio',async()=>{
  await db.query("insert into shipping_rates(id,seller_id,name,price_cents) values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',$1,'Padrão',2000)",[seller])
  await db.query(`update stripe_checkout_orders set shipping_cents=2000,amount_cents=12000,shipping_address='{"recipient":"C","postalCode":"01310-100","street":"R","number":"1","district":"B","city":"SP","state":"SP"}' where id=$1`,[order])
  await apply(order,'evt_team','approved','pi_sale')
  let token=await invite('support');await asUser(member,'equipe@x.com','select accept_team_invite($1)',[token])
  expect(await asUser(member,'equipe@x.com','select * from seller_customers($1)',[seller])).toHaveLength(1)
  await asUser(member,'equipe@x.com',`select seller_update_shipment($1,'${order}','shipped','BR1')`,[seller])
  await expect(asUser(member,'equipe@x.com',"select * from seller_affiliate_sales($1,now()-interval '1 day',now())",[seller])).rejects.toThrow(/FORBIDDEN/)
  token=await invite('finance');await asUser(member,'equipe@x.com','select accept_team_invite($1)',[token])
  expect(await asUser(member,'equipe@x.com',"select * from seller_affiliate_sales($1,now()-interval '1 day',now())",[seller])).toHaveLength(0)
  await expect(asUser(member,'equipe@x.com',`select seller_update_shipment($1,'${order}','delivered',null)`,[seller])).rejects.toThrow(/FORBIDDEN/)
 })
 it('removido ou estranho não acessa nada',async()=>{
  const token=await invite('admin');await asUser(member,'equipe@x.com','select accept_team_invite($1)',[token])
  const id=(await db.query<{id:string}>('select id from team_members')).rows[0].id
  await asUser(seller,'dono@x.com','select update_team_member($1,null,true)',[id])
  await expect(asUser(member,'equipe@x.com','select * from seller_customers($1)',[seller])).rejects.toThrow(/FORBIDDEN/)
  await expect(asUser(second,'x@x.com','select * from seller_customers($1)',[seller])).rejects.toThrow(/FORBIDDEN/)
  await expect(asUser(member,'equipe@x.com','select update_team_member($1,$2,false)',[id,'admin'])).rejects.toThrow(/MEMBER_NOT_FOUND/)
 })
 it('regras da equipe só somam leitura e a escrita fica nas funções',()=>{
  const sql=read('supabase/migrations/20261022110000_team_members.sql')
  expect(sql).toMatch(/revoke all on public\.team_members from anon,authenticated;/)
  expect(sql.match(/create policy [a-z_]+_team_read on public\.[a-z_]+ for select/g)).toHaveLength(3)
  expect(sql).not.toMatch(/create policy [^;]*for (insert|update|delete|all)/i)
 })
})
