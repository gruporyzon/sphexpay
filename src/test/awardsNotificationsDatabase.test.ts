import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll,beforeAll,beforeEach,describe,expect,it } from 'vitest'

// Executa a migration real contra Postgres (PGlite) com stubs mínimos das tabelas existentes.
const migration=readFileSync('supabase/migrations/20261021031119_awards_and_notifications_schema.sql','utf8')
const followUp=readFileSync('supabase/migrations/20261021031916_notifications_no_commercial.sql','utf8')
const admin=readFileSync('supabase/migrations/20261021040634_award_admin.sql','utf8')
const seller='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
let db:PGlite
const as=async(user:string|null,sql:string,params:unknown[]=[])=>{
 await db.exec(`select set_config('test.uid','${user??''}',false)`)
 return db.query(sql,params)
}
const sale=(id:string,cents:number,status='approved',currency='BRL')=>db.query(`insert into public.payment_transactions(transaction_id,user_id,product_name,status,amount_cents,currency) values ($1,$2,'Curso',$3,$4,$5)`,[id,seller,status,cents,currency])
const notes=async()=>(await db.query<{title:string;description:string;detail_path:string}>(`select title,description,detail_path from public.user_notifications where user_id=$1 order by created_at,title`,[seller])).rows

beforeAll(async()=>{
 db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 create table public.payment_transactions(transaction_id text primary key,user_id uuid,product_name text,product_name_snapshot text,status text,amount_cents bigint,currency text);
 create table public.kyc_profiles(user_id uuid primary key,status text);
 create table public.team_notifications(id bigint generated always as identity primary key,user_id uuid,kind text,ref text,constraint team_notifications_kind_check check (kind in ('onboarding')));`)
 await db.query('insert into auth.users values ($1),($2)',[seller,other])
 await db.exec(migration)
 await db.exec(followUp)
 await db.exec(`create function public.is_dashboard_admin() returns boolean language sql stable as $$ select current_setting('test.admin',true)='1' $$`)
 await db.exec(admin)
},30000)
afterAll(async()=>{await db?.close()})
beforeEach(async()=>{await db.exec('delete from public.user_notifications;delete from public.award_requests;delete from public.payment_transactions;delete from public.kyc_profiles')})

const address={recipient:'Ana Lima',phone:'11999990000',postalCode:'01310-100',street:'Av. Paulista',number:'1000',complement:'',district:'Bela Vista',city:'São Paulo',state:'SP',country:'Brasil',reference:'',extra:'ignorado'}

describe('premiações e notificações no banco',()=>{
 it('não leva vendas nem reembolsos ao sino, mas avisa contestação e premiação liberada',async()=>{
  await sale('t-1',600000)
  await sale('t-2',500000)
  await db.query(`update public.payment_transactions set status='refunded' where transaction_id='t-1'`)
  await db.query(`update public.payment_transactions set status='chargeback' where transaction_id='t-2'`)
  const rows=await notes()
  expect(rows.map(row=>row.title).sort()).toEqual(['Contestação recebida','Nova premiação liberada'])
  expect(rows.find(row=>row.title==='Contestação recebida')).toMatchObject({description:'Curso · R$ 5.000,00. Acompanhe a disputa na Stripe.',detail_path:'/app/vendas/t-2'})
 })
 it('não duplica a premiação liberada quando o status não muda',async()=>{
  await sale('t-3',1000000)
  await db.query(`update public.payment_transactions set amount_cents=1000001 where transaction_id='t-3'`)
  await db.query(`update public.payment_transactions set status='approved' where transaction_id='t-3'`)
  expect((await notes()).filter(row=>row.title==='Nova premiação liberada')).toHaveLength(1)
 })
 it('só aceita pedido de premiação liberada pelo faturamento real e guarda só os campos do endereço',async()=>{
  await expect(as(seller,`select public.request_award('10k',$1::jsonb)`,[JSON.stringify(address)])).rejects.toThrow(/AWARD_NOT_UNLOCKED/)
  await sale('t-4',900000,'approved','USD')
  await expect(as(seller,`select public.request_award('10k',$1::jsonb)`,[JSON.stringify(address)])).rejects.toThrow(/AWARD_NOT_UNLOCKED/)
  await sale('t-5',1000000)
  const result=await as(seller,`select public.request_award('10k',$1::jsonb) as row`,[JSON.stringify(address)])
  const stored=(result.rows[0] as {row:{status:string;address:Record<string,string>}}).row
  expect(stored.status).toBe('requested')
  expect(stored.address).not.toHaveProperty('extra')
  expect((await notes()).map(row=>row.title)).toContain('Pedido de premiação recebido')
  await expect(as(seller,`select public.request_award('10k',$1::jsonb)`,[JSON.stringify({...address,city:''})])).rejects.toThrow(/INVALID_ADDRESS/)
  await expect(as(seller,`select public.request_award('9k',$1::jsonb)`,[JSON.stringify(address)])).rejects.toThrow(/AWARD_NOT_FOUND/)
 })
 it('permite corrigir o endereço só enquanto o pedido não entrou em preparação',async()=>{
  await sale('t-6',1000000)
  await as(seller,`select public.request_award('10k',$1::jsonb)`,[JSON.stringify(address)])
  await as(seller,`select public.request_award('10k',$1::jsonb)`,[JSON.stringify({...address,number:'2000'})])
  expect((await db.query<{number:string}>(`select address->>'number' as number from public.award_requests where user_id=$1`,[seller])).rows[0].number).toBe('2000')
  await db.query(`update public.award_requests set status='preparing'`)
  await expect(as(seller,`select public.request_award('10k',$1::jsonb)`,[JSON.stringify(address)])).rejects.toThrow(/AWARD_ALREADY_IN_PROGRESS/)
  expect((await notes()).map(row=>row.title)).toContain('Premiação em preparação')
 })
 it('exige sessão e devolve a jornada só do próprio usuário',async()=>{
  await expect(as(null,'select public.my_award_journey()')).rejects.toThrow(/AUTH_REQUIRED/)
  await sale('t-7',1234)
  const journey=(await as(other,'select public.my_award_journey() as j')).rows[0] as {j:{revenue_cents:number}}
  expect(journey.j.revenue_cents).toBe(0)
 })
 it('notifica o resultado da verificação',async()=>{
  await db.query(`insert into public.kyc_profiles values ($1,'pending')`,[seller])
  await db.query(`update public.kyc_profiles set status='approved' where user_id=$1`,[seller])
  expect((await notes()).map(row=>row.title)).toContain('Verificação aprovada')
 })
 it('mantém escrita das tabelas fora do alcance do cliente',()=>{
  expect(migration).toMatch(/grant select on public\.award_requests to authenticated;/)
  expect(migration).toMatch(/grant update \(read_at, archived_at\) on public\.user_notifications to authenticated;/)
  expect(migration).not.toMatch(/grant[^;]*insert[^;]*to authenticated/i)
  expect(migration).toMatch(/revoke all on function public\.notify_user\([^)]*\) from public, anon, authenticated;/)
 })
 it('só a equipe (admin) lista pedidos e muda o status, que notifica o vendedor',async()=>{
  await sale('t-adm',1000000)
  await as(seller,`select public.request_award('10k',$1::jsonb)`,[JSON.stringify(address)])
  await db.exec(`select set_config('test.admin','0',false)`)
  await expect(as(seller,'select * from public.admin_list_award_requests()')).rejects.toThrow(/ADMIN_REQUIRED/)
  const id=(await db.query<{id:string}>('select id from public.award_requests')).rows[0].id
  await expect(as(seller,`select public.admin_update_award_request($1,'shipped','BR123')`,[id])).rejects.toThrow(/ADMIN_REQUIRED/)
  await db.exec(`select set_config('test.admin','1',false)`)
  const rows=(await as(other,`select * from public.admin_list_award_requests('requested')`)).rows as {award_id:string;address:{city:string}}[]
  expect(rows).toHaveLength(1);expect(rows[0].address.city).toBe('São Paulo')
  await as(other,`select public.admin_update_award_request($1,'shipped',' BR123 ')`,[id])
  expect((await db.query<{status:string;tracking_code:string}>('select status,tracking_code from public.award_requests')).rows[0]).toEqual({status:'shipped',tracking_code:'BR123'})
  expect((await notes()).find(row=>row.title==='Premiação enviada')?.description).toBe('Sphex 10K · rastreio BR123')
  await expect(as(other,`select public.admin_update_award_request($1,'perdido',null)`,[id])).rejects.toThrow(/INVALID_STATUS/)
  await db.exec(`select set_config('test.admin','0',false)`)
 })
})
