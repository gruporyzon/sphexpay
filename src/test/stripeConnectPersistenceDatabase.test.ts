import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import {afterAll,beforeAll,vi,describe,expect,it} from 'vitest'
// @ts-expect-error Server-side JavaScript is tested outside the frontend bundle.
import {connectionRecord} from '../../server/stripe/connect.js'

const userId='11111111-1111-4111-8111-111111111111'
let db:PGlite
beforeAll(async()=>{
 vi.stubEnv('STRIPE_SECRET_KEY','sk_test_fixture')
 db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as 'select null::uuid';`)
 await db.exec(readFileSync('supabase/migrations/20260903110000_stripe_connect_foundation.sql','utf8'))
 // Apply the Connect portion verbatim; the remaining DDL concerns payment ledgers.
 const payments=readFileSync('supabase/migrations/20260904120000_stripe_payments.sql','utf8')
 await db.exec(payments.slice(0,payments.indexOf('create table public.stripe_checkout_orders')))
 await db.exec(readFileSync('supabase/migrations/20260909010000_stripe_connect_modes.sql','utf8'))
 await db.query('insert into auth.users values ($1)',[userId])
},30000)
afterAll(async()=>{await db?.close();vi.unstubAllEnvs()})
const account={id:'acct_valid123',object:'v2.core.account',dashboard:'express',applied_configurations:['merchant','recipient'],configuration:{merchant:{capabilities:{card_payments:{status:'pending'}}},recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:'pending'}}}}},metadata:{sphex_user_id:userId}}
const persist=(record:Record<string,unknown>)=>{
 const columns=Object.keys(record)
 return db.query(`insert into stripe_connected_accounts (${columns.join(',')}) values (${columns.map((_,index)=>`$${index+1}`).join(',')}) on conflict (user_id,stripe_mode) do update set updated_at=excluded.updated_at returning *`,Object.values(record))
}
describe('diagnóstico de CHECKs com payload real de persistência Connect',()=>{
 it('aceita o payload atual de uma Account v2 com merchant e recipient sem type',async()=>{
  const record=connectionRecord(userId,account)
  expect(record).toMatchObject({stripe_account_type:'express',stripe_onboarding_status:'pending',stripe_capabilities:{},stripe_details_submitted:false,stripe_charges_enabled:false,stripe_payouts_enabled:false})
  const result=await persist(record)
  expect(result.rows[0]).toMatchObject({user_id:userId,stripe_account_id:account.id,stripe_account_type:'express'})
 })
 it('identifica todos os CHECKs pelo catálogo PostgreSQL',async()=>{
  const result=await db.query<{conname:string}>("select conname from pg_constraint where conrelid='public.stripe_connected_accounts'::regclass and contype='c' order by conname")
  expect(result.rows.map(row=>row.conname)).toEqual(['stripe_connected_accounts_account_id_format','stripe_connected_accounts_stripe_account_type_check','stripe_connected_accounts_stripe_mode_check','stripe_connected_accounts_stripe_onboarding_status_check'])
 })
 it.each(['none','standard','custom','merchant','recipient'])('reproduz 23514 no tipo %s mesmo com account ID válido',async type=>{
  await expect(persist(connectionRecord(userId,{...account,type}))).rejects.toMatchObject({code:'23514',constraint:'stripe_connected_accounts_stripe_account_type_check'})
 })
 it.each(['complete','completed','active','enabled_pending','onboarding_complete','restricted','disabled','pending_review'])('rejeita status fora do contrato: %s',async status=>{
  await expect(persist({...connectionRecord(userId,account),stripe_onboarding_status:status})).rejects.toMatchObject({code:'23514',constraint:'stripe_connected_accounts_stripe_onboarding_status_check'})
 })
 it('preserva as constraints de ID e exclusividade entre usuários',async()=>{
  await expect(persist({...connectionRecord(userId,account),stripe_account_id:'invalid'})).rejects.toMatchObject({code:'23514',constraint:'stripe_connected_accounts_account_id_format'})
  const other='22222222-2222-4222-8222-222222222222'
  await db.query('insert into auth.users values ($1)',[other])
  await expect(persist(connectionRecord(other,account))).rejects.toMatchObject({code:'23505',constraint:'stripe_connected_accounts_stripe_account_id_key'})
 })
})

it('mapeamento retorna exatamente quatro estados em todas as 128 combinações de flags e impedimentos',()=>{
 const states=new Set<string>()
 for(let mask=0;mask<128;mask++){
  const details=Boolean(mask&1),charges=Boolean(mask&2),payouts=Boolean(mask&4),current=Boolean(mask&8),past=Boolean(mask&16),disabled=Boolean(mask&32),verification=Boolean(mask&64)
  const record=connectionRecord(userId,{...account,details_submitted:details,charges_enabled:charges,payouts_enabled:payouts,
   stripe_onboarding_status:'completed',status:'active',metadata:{stripe_onboarding_status:'restricted'},
   requirements:{currently_due:current?['external_account']:[],past_due:past?['external_account']:[],disabled_reason:disabled?'under_review':null,pending_verification:verification?['individual.verification.document']:[]}})
  const status=record.stripe_onboarding_status
  states.add(status)
  expect(['pending','in_review','requirements_due','enabled']).toContain(status)
  if(current||past)expect(status).toBe('requirements_due')
  if(status==='enabled')expect([details,charges,payouts,!current,!past,!disabled,!verification]).toEqual(Array(7).fill(true))
  if(status==='pending')expect([details,current,past]).toEqual([false,false,false])
  if(status==='in_review')expect([details,current,past]).toEqual([true,false,false])
 }
 expect([...states].sort()).toEqual(['enabled','in_review','pending','requirements_due'])
})
