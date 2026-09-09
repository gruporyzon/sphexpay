import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
// @ts-expect-error Server-side JavaScript is tested outside the frontend bundle.
import {connectionRecord} from '../../server/stripe/connect.js'

const migration=readFileSync('supabase/migrations/20260908235100_fix_stripe_account_id_format.sql','utf8')
const counts=readFileSync('docs/sql/stripe-connect-account-id-counts.sql','utf8')
const constraint='stripe_connected_accounts_account_id_format'
const owner='11111111-1111-4111-8111-111111111111'
const other='22222222-2222-4222-8222-222222222222'
const accountId='acct_1UC5gt5NJWINIyVF'
let db:PGlite
beforeEach(async()=>{
 vi.stubEnv('STRIPE_SECRET_KEY','sk_test_fixture')
 db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as 'select null::uuid';`)
 await db.exec(readFileSync('supabase/migrations/20260903110000_stripe_connect_foundation.sql','utf8'))
 const payments=readFileSync('supabase/migrations/20260904120000_stripe_payments.sql','utf8')
 await db.exec(payments.slice(0,payments.indexOf('create table public.stripe_checkout_orders')))
 await db.query('insert into auth.users values ($1),($2)',[owner,other])
},30000)
afterEach(async()=>{await db?.close();vi.unstubAllEnvs()})
const installBrokenConstraint=()=>db.exec(`alter table public.stripe_connected_accounts
 drop constraint ${constraint}, add constraint ${constraint}
 check (stripe_account_id ~ '^acct_[A-Za-z0-9]+\n   $') not valid;`)
const insert=(id:string,user=owner)=>{
 const record=connectionRecord(user,{id,object:'v2.core.account',applied_configurations:['merchant','recipient'],configuration:{merchant:{},recipient:{}}})
 // This historical regression intentionally runs the schema before mode separation.
 delete record.stripe_mode
 const columns=Object.keys(record)
 return db.query(`insert into stripe_connected_accounts (${columns.join(',')}) values (${columns.map((_,i)=>`$${i+1}`).join(',')}) returning *`,Object.values(record))
}
type ConstraintRow={conname:string;contype:string;definition:string;convalidated:boolean}
const constraints=async()=>(await db.query<ConstraintRow>(`select conname,contype,pg_get_constraintdef(oid) as definition,convalidated
 from pg_constraint where conrelid='public.stripe_connected_accounts'::regclass order by conname`)).rows

describe('correção exclusiva da regex remota de Stripe account ID',()=>{
 it('reproduz o newline remoto, corrige com a migration real e preserva dados e demais constraints',async()=>{
  await insert('acct_legacy123')
  const rowsBefore=(await db.query('select * from stripe_connected_accounts')).rows
  await installBrokenConstraint()
  const before=await constraints()
  expect(before.find(c=>c.conname===constraint)?.definition).toContain('\n   $')
  await expect(insert(accountId,other)).rejects.toMatchObject({code:'23514',constraint})
  await db.exec(migration)
  expect((await db.query('select * from stripe_connected_accounts')).rows).toEqual(rowsBefore)
  const after=await constraints()
  expect(after.filter(c=>c.conname!==constraint)).toEqual(before.filter(c=>c.conname!==constraint))
  expect(after.find(c=>c.conname===constraint)).toMatchObject({definition:"CHECK ((stripe_account_id ~ '^acct_[A-Za-z0-9]+$'::text))",convalidated:true})
  expect((await insert(accountId,other)).rows[0]).toMatchObject({stripe_account_id:accountId,stripe_account_type:'express',stripe_onboarding_status:'pending'})
  await db.exec(migration)
  expect(await constraints()).toEqual(after)
  expect((await db.query<{total:number}>(counts)).rows[0]).toEqual({total:2,validos:2,invalidos:0})
 })
 it('rejeita IDs sem prefixo ou com caracteres inválidos e mantém CHECKs de tipo e status',async()=>{
  await installBrokenConstraint()
  await db.exec(migration)
  for(const id of ['1UC5gt5NJWINIyVF','cus_1UC5gt5NJWINIyVF','acct_','acct_bad-id','acct_bad/id','acct_bad id','acct_bad_id',accountId+'\n   ']){
   await expect(insert(id)).rejects.toMatchObject({code:'23514',constraint})
  }
  await expect(db.query("insert into stripe_connected_accounts(user_id,stripe_account_id,stripe_account_type) values($1,$2,'none')",[owner,accountId])).rejects.toMatchObject({code:'23514',constraint:'stripe_connected_accounts_stripe_account_type_check'})
  await expect(db.query("insert into stripe_connected_accounts(user_id,stripe_account_id,stripe_onboarding_status) values($1,$2,'invalid')",[owner,accountId])).rejects.toMatchObject({code:'23514',constraint:'stripe_connected_accounts_stripe_onboarding_status_check'})
 })
 it('falha atomicamente quando há dados inválidos, preservando a constraint anterior e os registros',async()=>{
  await installBrokenConstraint()
  await insert(accountId+'\n   ')
  const before=await constraints()
  const rowsBefore=(await db.query('select * from stripe_connected_accounts')).rows
  expect((await db.query(counts)).rows[0]).toEqual({total:1,validos:0,invalidos:1})
  await expect(db.exec(migration)).rejects.toMatchObject({code:'23514'})
  expect(await constraints()).toEqual(before)
  expect((await db.query('select * from stripe_connected_accounts')).rows).toEqual(rowsBefore)
 })
})
