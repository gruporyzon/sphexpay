import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterAll,beforeAll,beforeEach,describe,expect,it } from 'vitest'

// Migration real de webhooks contra Postgres (PGlite). pg_net é simulado por um stub com a
// mesma assinatura de net.http_post e a tabela net._http_response.
const migration=readFileSync('supabase/migrations/20261021032821_seller_webhooks.sql','utf8').replace('create extension if not exists pg_net;','')
const seller='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
let db:PGlite
const as=async<T=Record<string,unknown>>(user:string|null,sql:string,params:unknown[]=[])=>{
 await db.exec(`select set_config('test.uid','${user??''}',false)`)
 return db.query<T>(sql,params)
}
const createHook=async(events=['sale.approved'],url='https://hooks.exemplo.com/sphexpay')=>(await as<{r:{id:string;secret:string}}>(seller,`select public.create_seller_webhook('Operação',$1,$2::text[]) as r`,[url,events])).rows[0].r
const sale=(id:string,status='approved')=>db.query(`insert into public.payment_transactions(transaction_id,user_id,product_id,product_name,status,amount_cents,currency,customer_display_name,payment_method,occurred_at) values ($1,$2,null,'Curso',$3,9700,'BRL','Ana L.','card',now())`,[id,seller,status])
const deliveries=async()=>(await db.query<{id:string;status:string;attempts:number;event_type:string;request_id:number|null;last_error:string|null;payload:Record<string,unknown>}>('select * from public.webhook_deliveries order by created_at')).rows

beforeAll(async()=>{
 db=new PGlite({extensions:{pgcrypto}})
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema extensions;create extension pgcrypto schema extensions;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 create schema net;
 create table net.requests(id bigserial primary key,url text,body jsonb,headers jsonb);
 create table net._http_response(id bigint primary key,status_code integer,timed_out boolean,error_msg text);
 create function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 5000) returns bigint
  language sql as $$ insert into net.requests(url,body,headers) values (url,body,headers) returning id $$;
 create table public.payment_transactions(transaction_id text primary key,user_id uuid,product_id uuid,product_name text,product_name_snapshot text,status text,amount_cents bigint,currency text,customer_display_name text,payment_method text,occurred_at timestamptz);`)
 await db.query('insert into auth.users values ($1),($2)',[seller,other])
 await db.exec(migration)
},30000)
afterAll(async()=>{await db?.close()})
beforeEach(async()=>{await db.exec('delete from public.webhook_deliveries;delete from public.seller_webhooks;delete from public.payment_transactions;delete from net.requests;delete from net._http_response')})

describe('webhooks de saída',()=>{
 it('aceita só URLs https públicas',async()=>{
  const allowed=async(url:string)=>(await db.query<{ok:boolean}>('select public.webhook_url_allowed($1) as ok',[url])).rows[0].ok
  expect(await allowed('https://hooks.exemplo.com/sphexpay?x=1')).toBe(true)
  expect(await allowed('https://api.exemplo.com.br:443/h')).toBe(true)
  for(const url of ['http://hooks.exemplo.com','https://localhost/x','https://127.0.0.1/x','https://[::1]/x','https://10.0.0.5/x','https://user:pass@exemplo.com/x','https://exemplo.com:8080/x','https://db.internal/x','https://semponto/x','ftp://exemplo.com'])expect(await allowed(url),url).toBe(false)
  await expect(createHook(['sale.approved'],'https://169.254.169.254/latest')).rejects.toThrow(/WEBHOOK_URL_INVALID/)
 })
 it('cria com segredo, valida eventos e respeita o limite por vendedor',async()=>{
  const hook=await createHook(['sale.approved','x.invalido'])
  expect(hook.secret).toMatch(/^whsec_[0-9a-f]{48}$/)
  expect((await db.query<{events:string[]}>('select events from public.seller_webhooks')).rows[0].events).toEqual(['sale.approved'])
  await expect(as(seller,`select public.create_seller_webhook('X','https://a.exemplo.com',array['nada'])`)).rejects.toThrow(/WEBHOOK_EVENTS_REQUIRED/)
  for(let index=0;index<9;index++)await createHook()
  await expect(createHook()).rejects.toThrow(/WEBHOOK_LIMIT/)
  await expect(as(null,`select public.create_seller_webhook('X','https://a.exemplo.com',array['sale.approved'])`)).rejects.toThrow(/AUTH_REQUIRED/)
 })
 it('gera entrega para venda aprovada e envia assinada com HMAC do corpo',async()=>{
  const hook=await createHook(['sale.approved','sale.refunded'])
  await sale('t-1')
  await sale('t-2','pending')
  await db.query(`update public.payment_transactions set status='refunded' where transaction_id='t-1'`)
  expect((await deliveries()).map(row=>row.event_type)).toEqual(['sale.approved','sale.refunded'])
  expect(await db.query('select public.dispatch_seller_webhooks()')).toBeTruthy()
  const requests=(await db.query<{url:string;body:Record<string,unknown>;headers:Record<string,string>}>('select * from net.requests order by id')).rows
  expect(requests).toHaveLength(2)
  const first=requests[0]
  expect(first.url).toBe('https://hooks.exemplo.com/sphexpay')
  expect(first.body).toMatchObject({type:'sale.approved',livemode:true,data:{transaction_id:'t-1',amount_cents:9700,currency:'BRL',customer_name:'Ana L.'}})
  const bodyText=(await db.query<{t:string}>('select payload::text as t from public.webhook_deliveries where event_type=$1',['sale.approved'])).rows[0].t
  const expected=createHmac('sha256',hook.secret).update(`${first.headers['X-SphexPay-Timestamp']}.${bodyText}`).digest('hex')
  expect(first.headers['X-SphexPay-Signature']).toBe(`v1=${expected}`)
  expect(first.headers['X-SphexPay-Event']).toBe('sale.approved')
  expect((await deliveries()).every(row=>row.status==='sending'&&row.attempts===1)).toBe(true)
 })
 it('marca sucesso, reagenda falhas com espera e desiste após 6 tentativas',async()=>{
  await createHook()
  await sale('t-3')
  await db.query('select public.dispatch_seller_webhooks()')
  let [row]=await deliveries()
  await db.query('insert into net._http_response values ($1,500,false,null)',[row.request_id])
  await db.query('select public.dispatch_seller_webhooks()')
  ;[row]=await deliveries()
  expect(row).toMatchObject({status:'pending',attempts:1,last_error:'Resposta HTTP 500'})
  await db.query(`update public.webhook_deliveries set next_attempt_at=now(),attempts=6`)
  await db.query('select public.dispatch_seller_webhooks()')
  ;[row]=await deliveries()
  await db.query('insert into net._http_response values ($1,null,true,null)',[row.request_id])
  await db.query('select public.dispatch_seller_webhooks()')
  ;[row]=await deliveries()
  expect(row).toMatchObject({status:'failed',attempts:7,last_error:'Tempo esgotado (5 s)'})
  await sale('t-4')
  await db.query('select public.dispatch_seller_webhooks()')
  const next=(await deliveries()).find(item=>item.payload&&(item.payload as {data:{transaction_id:string}}).data.transaction_id==='t-4')!
  await db.query('insert into net._http_response values ($1,204,false,null)',[next.request_id])
  await db.query('select public.dispatch_seller_webhooks()')
  expect((await deliveries()).find(item=>item.id===next.id)?.status).toBe('succeeded')
 })
 it('não envia eventos não assinados, de outro vendedor ou para webhook desativado',async()=>{
  const hook=await createHook(['sale.refunded'])
  await sale('t-5')
  expect(await deliveries()).toHaveLength(0)
  await as(seller,`select public.update_seller_webhook($1,'Operação','https://hooks.exemplo.com/sphexpay',array['sale.approved'],false)`,[hook.id])
  await sale('t-6')
  expect(await deliveries()).toHaveLength(0)
  await expect(as(other,`select public.update_seller_webhook($1,'X','https://hooks.exemplo.com/x',array['sale.approved'],true)`,[hook.id])).rejects.toThrow(/WEBHOOK_NOT_FOUND/)
  await expect(as(other,'select public.reveal_seller_webhook_secret($1)',[hook.id])).rejects.toThrow(/WEBHOOK_NOT_FOUND/)
 })
 it('envia teste na hora, limita repetição e troca o segredo',async()=>{
  const hook=await createHook()
  await as(seller,'select public.send_test_seller_webhook($1)',[hook.id])
  expect((await db.query('select * from net.requests')).rows).toHaveLength(1)
  await expect(as(seller,'select public.send_test_seller_webhook($1)',[hook.id])).rejects.toThrow(/WEBHOOK_TEST_RATE_LIMIT/)
  const rotated=(await as<{s:string}>(seller,'select public.reveal_seller_webhook_secret($1,true) as s',[hook.id])).rows[0].s
  expect(rotated).not.toBe(hook.secret)
  expect((await as<{s:string}>(seller,'select public.reveal_seller_webhook_secret($1) as s',[hook.id])).rows[0].s).toBe(rotated)
 })
 it('não expõe o segredo nem permite escrita direta pelo cliente',()=>{
  expect(migration).toMatch(/grant select \(id, user_id, name, url, events, active, created_at, updated_at\) on public\.seller_webhooks to authenticated;/)
  expect(migration).not.toMatch(/grant (insert|update)[^;]*to authenticated/i)
  expect(migration).toMatch(/revoke all on function public\.dispatch_seller_webhooks\(\) from public, anon, authenticated;/)
 })
})
