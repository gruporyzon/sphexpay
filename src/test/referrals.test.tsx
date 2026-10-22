import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { render,screen } from '@testing-library/react'
import { afterAll,afterEach,beforeAll,beforeEach,describe,expect,it,vi } from 'vitest'
import { ReferralReport } from '../features/referrals/ReferralReport'
import { REFERRAL_STORAGE,referralService,rememberReferral } from '../services/referralService'

vi.mock('../hooks/useAuth',()=>({useAuth:()=>({user:{id:'u1'}})}))
vi.mock('../hooks/useDashboardAdmin',()=>({useDashboardAdmin:()=>({allowed:false,loading:false})}))
const ana='11111111-1111-4111-8111-111111111111',bia='22222222-2222-4222-8222-222222222222',old='33333333-3333-4333-8333-333333333333'
let db:PGlite
beforeAll(async()=>{
 db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 create table public.payment_transactions(id uuid primary key default gen_random_uuid(),user_id uuid,provider text,status text,amount_cents bigint,fee_cents bigint,currency text,occurred_at timestamptz default now(),metadata jsonb default '{}');
 create function public.is_dashboard_admin() returns boolean language sql as $$ select current_setting('test.admin',true)='1' $$;`)
 await db.query(`insert into auth.users(id,email,raw_user_meta_data,created_at) values($1,'ana@x.com','{"full_name":"Ana Lima"}',now()),($2,'bia@x.com','{"full_name":"Bia Souza"}',now()),($3,'old@x.com','{}',now()-interval '30 days')`,[ana,bia,old])
 await db.exec(readFileSync('supabase/migrations/20261022100000_seller_referrals.sql','utf8'))
},30000)
afterAll(async()=>{await db?.close()})
afterEach(()=>{vi.restoreAllMocks();localStorage.clear()})
beforeEach(async()=>{await db.exec('delete from public.referral_payouts;delete from public.seller_referrals;delete from public.payment_transactions')})
const as=async<T,>(user:string,sql:string,params:unknown[]=[])=>{await db.exec(`select set_config('test.uid','${user}',false)`);try{return(await db.query<T>(sql,params)).rows}finally{await db.exec(`select set_config('test.uid','',false)`)}}

describe('indicação de vendedores no banco',()=>{
 it('gera um código estável e vincula só conta nova, sem autoindicação',async()=>{
  const code=(await as<{c:string}>(ana,'select my_referral_code() as c'))[0].c
  expect(code).toMatch(/^SPX-[A-Z0-9]{8}$/);expect((await as<{c:string}>(ana,'select my_referral_code() as c'))[0].c).toBe(code)
  expect((await as<{ok:boolean}>(ana,'select claim_referral($1) as ok',[code]))[0].ok).toBe(false)
  expect((await as<{ok:boolean}>(old,'select claim_referral($1) as ok',[code]))[0].ok).toBe(false)
  expect((await as<{ok:boolean}>(bia,'select claim_referral($1) as ok',[code.toLowerCase()]))[0].ok).toBe(true)
  expect((await as<{ok:boolean}>(bia,'select claim_referral($1) as ok',[code]))[0].ok).toBe(false)
 })
 it('paga 10% da taxa das vendas aprovadas do indicado dentro de 12 meses',async()=>{
  const code=(await as<{c:string}>(ana,'select my_referral_code() as c'))[0].c
  await as(bia,'select claim_referral($1)',[code])
  await db.query(`insert into payment_transactions(user_id,provider,status,amount_cents,fee_cents,currency,occurred_at) values($1,'stripe','approved',10000,500,'BRL',now()),($1,'stripe','refunded',10000,500,'BRL',now()),($1,'stripe','approved',10000,500,'BRL',now()+interval '13 months')`,[bia])
  const rows=await as<{commission_cents:number;referred_name:string}>(ana,"select * from my_referral_sales(now()-interval '1 day',now()+interval '2 years')")
  expect(rows).toHaveLength(1);expect(Number(rows[0].commission_cents)).toBe(50);expect(rows[0].referred_name).toBe('Bia')
  expect(await as(bia,"select * from my_referral_sales(now()-interval '1 day',now()+interval '1 day')")).toHaveLength(0)
 })
 it('só a equipe vê o mês e registra o pagamento',async()=>{
  const code=(await as<{c:string}>(ana,'select my_referral_code() as c'))[0].c
  await as(bia,'select claim_referral($1)',[code])
  await db.query(`insert into payment_transactions(user_id,provider,status,amount_cents,fee_cents,currency) values($1,'stripe','approved',20000,1000,'BRL')`,[bia])
  await expect(as(ana,'select * from admin_referral_month(current_date)')).rejects.toThrow(/ADMIN_REQUIRED/)
  await db.exec(`select set_config('test.admin','1',false)`)
  const rows=await as<{commission_cents:number}>(bia,'select * from admin_referral_month(current_date)')
  expect(Number(rows[0].commission_cents)).toBe(100)
  await as(bia,'select admin_mark_referral_paid($1,current_date,100)',[ana])
  await db.exec(`select set_config('test.admin','0',false)`)
  expect(Number((await as<{s:{paid_cents:number}}>(ana,'select my_referral_summary() as s'))[0].s.paid_cents)).toBe(100)
 })
})

describe('indicação na tela',()=>{
 it('guarda o código do link de cadastro e ignora código inválido',()=>{
  rememberReferral('?indicacao=spx-abcd1234');expect(localStorage.getItem(REFERRAL_STORAGE)).toBe('SPX-ABCD1234')
  localStorage.clear();rememberReferral('?indicacao=<x>');expect(localStorage.getItem(REFERRAL_STORAGE)).toBeNull()
 })
 it('mostra o link, a regra e a comissão',async()=>{
  vi.spyOn(referralService,'code').mockResolvedValue('SPX-ABCD1234')
  vi.spyOn(referralService,'summary').mockResolvedValue({referred:2,active:2,paidCents:0,payouts:[]})
  vi.spyOn(referralService,'sales').mockResolvedValue([{referredId:'b',referredName:'Bia',referredSince:'2026-10-01T00:00:00Z',occurredAt:'2026-10-20T00:00:00Z',amountCents:10000,feeCents:500,commissionCents:50,currency:'BRL'}])
  render(<ReferralReport/>)
  expect(await screen.findByText(/criar-conta\?indicacao=SPX-ABCD1234/)).toBeInTheDocument()
  expect(screen.getByText(/10% da taxa SphexPay/)).toBeInTheDocument()
  expect(screen.getAllByText('R$ 0,50').length).toBeGreaterThan(0)
 })
})
