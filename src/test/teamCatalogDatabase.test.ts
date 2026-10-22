import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import {afterAll,beforeAll,beforeEach,describe,expect,it} from 'vitest'

// Equipe, fase 2: o Administrador edita o catálogo da conta de quem convidou, com as regras de
// acesso (RLS) reais aplicadas ao papel authenticated.
const read=(path:string)=>readFileSync(path,'utf8')
const owner='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222',support='33333333-3333-4333-8333-333333333333',outsider='44444444-4444-4444-8444-444444444444'
const product='55555555-5555-4555-8555-555555555555',offer='66666666-6666-4666-8666-666666666666',checkout='77777777-7777-4777-8777-777777777777'
const OWNED=['products','product_offers','product_delivery_settings','product_activity_log','product_checkouts','checkout_versions','checkout_analytics_events','product_coupons','product_order_bumps','product_funnel_steps','product_funnel_settings','product_links','product_coproducers','shipping_rates','custom_charges']
let db:PGlite

beforeAll(async()=>{
 db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('email',nullif(current_setting('test.email',true),'')) $$;
 create table products(id uuid primary key default gen_random_uuid(),seller_id uuid not null,name text,slug text,description text,category text,tags text[],image_url text,sales_page_url text,product_type text,status text,billing_type text,warranty_days integer,price_cents bigint,currency text,deleted_at timestamptz);
 create table payment_transactions(id uuid primary key default gen_random_uuid(),user_id uuid,provider text,status text,amount_cents bigint,refunded_at timestamptz,metadata jsonb default '{}');
 create table custom_charges(id uuid primary key default gen_random_uuid(),seller_id uuid);
 create table stripe_checkout_orders(id uuid primary key default gen_random_uuid(),checkout_id uuid);
 create table product_offers(id uuid primary key default gen_random_uuid(),product_id uuid,seller_id uuid,name text,price_cents bigint,currency text,billing_type text,billing_interval text,installments integer,trial_days integer,setup_fee_cents bigint,max_charges integer,access_duration_days integer,warranty_days integer,status text,is_default boolean,deleted_at timestamptz);
 create table product_delivery_settings(product_id uuid primary key,seller_id uuid,provider text,config jsonb);
 create table product_activity_log(id uuid primary key default gen_random_uuid(),product_id uuid,seller_id uuid,actor_id uuid,action text,entity_type text,entity_id text,metadata jsonb);
 create table product_checkouts(id uuid primary key default gen_random_uuid(),product_id uuid,seller_id uuid,offer_id uuid,name text,status text default 'draft',draft_layout jsonb default '[]',draft_design jsonb default '{}',draft_settings jsonb default '{}',lock_version bigint default 0,deleted_at timestamptz,is_default boolean default false,published_version_id uuid,last_publish_key text,updated_at timestamptz);
 create table checkout_versions(id uuid primary key default gen_random_uuid(),checkout_id uuid,product_id uuid,seller_id uuid,version integer,layout jsonb,design jsonb,settings jsonb,offer_id uuid,created_by uuid);
 create table checkout_analytics_events(id uuid primary key default gen_random_uuid(),checkout_id uuid,product_id uuid,seller_id uuid,event_type text);
 create table product_coupons(id uuid primary key default gen_random_uuid(),product_id uuid,seller_id uuid,code text);
 create table product_order_bumps(id uuid primary key default gen_random_uuid(),product_id uuid,seller_id uuid,status text,deleted_at timestamptz);
 create table product_funnel_steps(id uuid primary key default gen_random_uuid(),product_id uuid,seller_id uuid);
 create table product_funnel_settings(id uuid primary key default gen_random_uuid(),product_id uuid,seller_id uuid);
 create table product_links(id uuid primary key default gen_random_uuid(),product_id uuid,seller_id uuid);
 create table product_coproducers(id uuid primary key default gen_random_uuid(),product_id uuid,seller_id uuid);
 create table shipping_rates(id uuid primary key default gen_random_uuid(),seller_id uuid,name text);
 create function checkout_layout_valid(jsonb) returns boolean language sql as $$ select jsonb_typeof($1)='array' $$;`)
 // Regras do dono como nas tabelas reais: só a própria conta.
 for(const table of OWNED){
  const column=table==='payment_transactions'?'user_id':'seller_id'
  await db.exec(`alter table ${table} enable row level security;grant select,insert,update,delete on ${table} to authenticated;
  create policy ${table}_own on ${table} for all to authenticated using (${column}=auth.uid()) with check (${column}=auth.uid());`)
 }
 await db.exec('alter table payment_transactions enable row level security;grant select on payment_transactions,stripe_checkout_orders to authenticated;')
 await db.exec(read('supabase/migrations/20261022110000_team_members.sql'))
 const catalog=read('supabase/migrations/20261022130000_team_catalog.sql')
 // O armazenamento de arquivos (storage) não existe no banco de teste.
 await db.exec(catalog.slice(0,catalog.indexOf('-- Imagens do produto')))
 await db.query(`insert into auth.users(id,email) values($1,'dono@x.com'),($2,'admin@x.com'),($3,'suporte@x.com'),($4,'fora@x.com')`,[owner,admin,support,outsider])
 await db.exec(`insert into team_members(owner_id,member_id,email,role,status) values('${owner}','${admin}','admin@x.com','admin','active'),('${owner}','${support}','suporte@x.com','support','active')`)
},30000)
afterAll(async()=>{await db?.close()})
beforeEach(async()=>{
 await db.exec('delete from product_coupons;delete from product_coproducers;delete from shipping_rates;delete from checkout_versions;delete from product_checkouts;delete from product_activity_log;delete from product_delivery_settings;delete from product_offers;delete from products')
 await db.query(`insert into products(id,seller_id,name,status) values($1,$2,'Curso','active')`,[product,owner])
 await db.query(`insert into product_offers(id,product_id,seller_id,name,price_cents,status,is_default) values($1,$2,$3,'Padrão',9700,'active',true)`,[offer,product,owner])
 await db.query(`insert into product_checkouts(id,product_id,seller_id,offer_id,name) values($1,$2,$3,$4,'Principal')`,[checkout,product,owner,offer])
})
const as=async<T,>(user:string,sql:string,params:unknown[]=[])=>{
 await db.exec(`select set_config('test.uid','${user}',false);set role authenticated`)
 try{return(await db.query<T>(sql,params))}finally{await db.exec(`reset role;select set_config('test.uid','',false)`)}
}

describe('administrador no catálogo de quem convidou',()=>{
 it('cria produto na conta do dono, sempre com entrega só por pagamento e registrado em nome dele',async()=>{
  const id=(await as<{id:string}>(admin,'select create_product_v2($1) as id',[{sellerId:owner,name:'Mentoria',slug:'mentoria',offerName:'Única',priceCents:5000,currency:'BRL',billingType:'one_time',deliveryProvider:'webhook',deliveryConfig:{url:'https://x'}}])).rows[0].id
  const row=(await db.query<{seller_id:string}>('select seller_id from products where id=$1',[id])).rows[0]
  expect(row.seller_id).toBe(owner)
  expect((await db.query<{provider:string}>('select provider from product_delivery_settings where product_id=$1',[id])).rows[0].provider).toBe('payment_only')
  expect((await db.query<{actor_id:string}>('select actor_id from product_activity_log where product_id=$1',[id])).rows[0].actor_id).toBe(admin)
 })
 it('edita produto, oferta, cupom e frete, mas não coprodução nem exclusão definitiva',async()=>{
  expect((await as(admin,"update products set name='Curso 2' where id=$1",[product])).affectedRows).toBe(1)
  expect((await as(admin,"update product_offers set price_cents=12000 where id=$1",[offer])).affectedRows).toBe(1)
  await as(admin,"insert into product_coupons(product_id,seller_id,code) values($1,$2,'BEMVINDO')",[product,owner])
  await as(admin,"insert into shipping_rates(seller_id,name) values($1,'Sedex')",[owner])
  await expect(as(admin,'insert into product_coproducers(product_id,seller_id) values($1,$2)',[product,owner])).rejects.toThrow(/row-level security/)
  expect((await as(admin,'delete from products where id=$1',[product])).affectedRows).toBe(0)
  await expect(as(admin,'update products set seller_id=$2 where id=$1',[product,admin])).rejects.toThrow(/SELLER_IMMUTABLE|row-level security/)
  await expect(as(admin,"insert into product_activity_log(product_id,seller_id,actor_id,action) values($1,$2,$2,'x')",[product,owner])).rejects.toThrow(/row-level security/)
  await as(admin,"insert into product_activity_log(product_id,seller_id,actor_id,action) values($1,$2,$3,'x')",[product,owner,admin])
 })
 it('monta, publica e escolhe o checkout padrão; links da conta aparecem',async()=>{
  const layout=[{type:'buyer_form'},{type:'order_summary'},{type:'payment_methods'},{type:'button'}]
  const lock=(await as<{l:number}>(admin,'select save_checkout_draft($1,0,$2,$3,$4) as l',[checkout,JSON.stringify(layout),'{}','{}'])).rows[0].l
  const published=(await as<{p:{version:number}}>(admin,"select publish_checkout($1,$2,'k1') as p",[checkout,lock])).rows[0].p
  expect(published.version).toBe(1)
  await as(admin,'select set_default_checkout($1,$2)',[product,checkout])
  expect((await db.query<{created_by:string}>('select created_by from checkout_versions')).rows[0].created_by).toBe(admin)
  expect((await as(admin,'select * from seller_payment_links($1)',[owner])).rows).toHaveLength(1)
 })
})

describe('outros cargos e estranhos no catálogo',()=>{
 it('suporte e quem não é da equipe não escrevem nem publicam',async()=>{
  for(const user of [support,outsider]){
   await expect(as(user,'select create_product_v2($1)',[{sellerId:owner,name:'X',slug:'x',offerName:'X',priceCents:100,currency:'BRL',billingType:'one_time'}])).rejects.toThrow(/FORBIDDEN/)
   expect((await as(user,"update product_offers set price_cents=1 where id=$1",[offer])).affectedRows).toBe(0)
   await expect(as(user,"insert into product_coupons(product_id,seller_id,code) values($1,$2,'X')",[product,owner])).rejects.toThrow(/row-level security/)
   await expect(as(user,"select save_checkout_draft($1,0,'[]','{}','{}')",[checkout])).rejects.toThrow(/CHECKOUT_VERSION_CONFLICT/)
   await expect(as(user,'select set_default_checkout($1,$2)',[product,checkout])).rejects.toThrow(/CHECKOUT_NOT_FOUND/)
   await expect(as(user,'select * from seller_payment_links($1)',[owner])).rejects.toThrow(/FORBIDDEN/)
  }
 })
 it('acesso removido corta a edição na hora',async()=>{
  await db.query(`update team_members set status='revoked' where member_id=$1`,[admin])
  expect((await as(admin,"update products set name='X' where id=$1",[product])).affectedRows).toBe(0)
  await db.query(`update team_members set status='active' where member_id=$1`,[admin])
 })
 it('o dono continua com o próprio catálogo e cria produto sem informar conta',async()=>{
  const id=(await as<{id:string}>(owner,'select create_product_v2($1) as id',[{name:'Ebook',slug:'ebook',offerName:'Única',priceCents:1000,currency:'BRL',billingType:'one_time',deliveryProvider:'email'}])).rows[0].id
  expect((await db.query<{provider:string}>('select provider from product_delivery_settings where product_id=$1',[id])).rows[0].provider).toBe('email')
 })
})
