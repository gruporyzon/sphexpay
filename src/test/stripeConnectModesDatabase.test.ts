import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import {afterAll,beforeAll,describe,expect,it} from 'vitest'
const read=(name:string)=>readFileSync(`supabase/migrations/${name}.sql`,'utf8')
const migration=read('20260909010000_stripe_connect_modes')
const owner='11111111-1111-4111-8111-111111111111',fresh='22222222-2222-4222-8222-222222222222'
let db:PGlite
let legacy:Record<string,unknown>
beforeAll(async()=>{
 db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as 'select null::uuid';`)
 await db.exec(read('20260903110000_stripe_connect_foundation'))
 const payments=read('20260904120000_stripe_payments')
 await db.exec(payments.slice(0,payments.indexOf('create table public.stripe_checkout_orders')))
 // Existing order reference uses the same FK as stripe_checkout_orders.
 await db.exec('create table existing_orders(account_id text references stripe_connected_accounts(stripe_account_id))')
 await db.query('insert into auth.users values($1),($2)',[owner,fresh])
 await db.query("insert into stripe_connected_accounts(user_id,stripe_account_id,stripe_charges_enabled) values($1,'acct_preserved',true)",[owner])
 await db.exec("insert into existing_orders values('acct_preserved')")
 await db.query("insert into stripe_account_requests(user_id,parameters,created_at) values($1,'{\"legacy\":true}',now()-interval '2 days')",[owner])
 legacy=(await db.query<Record<string,unknown>>('select * from stripe_connected_accounts')).rows[0]
 await db.exec(migration)
},30000)
afterAll(async()=>{await db?.close()})
const reserve=(user:string,mode:string,parameters={mode})=>db.query('select reserve_stripe_account_for_mode($1,$2,$3) as parameters',[user,mode,parameters])
describe('migration de isolamento executada em PostgreSQL',()=>{
 it('preserva integralmente conta, flags, reserva e referência de pedido como legado',async()=>{
  expect((await db.query('select * from stripe_connected_accounts')).rows).toEqual([{...legacy,stripe_mode:'legacy'}])
  expect((await db.query('select parameters,stripe_mode from stripe_account_requests')).rows).toEqual([{parameters:{legacy:true},stripe_mode:'legacy'}])
  expect((await db.query('select * from existing_orders')).rows).toEqual([{account_id:'acct_preserved'}])
 })
 it('isola reserva Test da reserva legada expirada e impede duplicação Live ambígua',async()=>{
  expect((await reserve(owner,'test')).rows[0]).toEqual({parameters:{mode:'test'}})
  await expect(reserve(owner,'live')).rejects.toThrow('CONNECT_LEGACY_CLASSIFICATION_REQUIRED')
  await expect(db.query('select reserve_stripe_account($1,$2)',[owner,{}])).rejects.toThrow('CONNECT_MODE_REQUIRED')
 })
 it('aceita legado, Test e Live para mesmo usuário sem sobrescrever ID ou status',async()=>{
  for(const mode of ['test','live'])await db.query('insert into stripe_connected_accounts(user_id,stripe_mode,stripe_account_id) values($1,$2,$3)',[fresh,mode,`acct_${mode}`])
  await db.query("insert into stripe_connected_accounts(user_id,stripe_mode,stripe_account_id) values($1,'test','acct_ownertest')",[owner])
  expect((await db.query('select * from stripe_connected_accounts where stripe_account_id=$1',['acct_preserved'])).rows[0]).toEqual({...legacy,stripe_mode:'legacy'})
  await expect(db.query("insert into stripe_connected_accounts(user_id,stripe_mode,stripe_account_id) values($1,'test','acct_duplicate')",[fresh])).rejects.toMatchObject({code:'23505'})
  await expect(db.query("insert into stripe_connected_accounts(user_id,stripe_mode,stripe_account_id) values($1,'live','acct_preserved')",[owner])).rejects.toMatchObject({code:'23505'})
 })
 it('mantém reservas e parâmetros imutáveis por modo durante retries',async()=>{
  for(const mode of ['test','live']){
   expect((await reserve(fresh,mode)).rows[0]).toEqual({parameters:{mode}})
   expect((await reserve(fresh,mode,{mode:'changed'})).rows[0]).toEqual({parameters:{mode}})
  }
  await db.query("update stripe_account_requests set created_at=now()-interval '2 days' where user_id=$1 and stripe_mode='test'",[fresh])
  await expect(reserve(fresh,'test')).rejects.toThrow('CONNECT_RECONCILIATION_REQUIRED')
  expect((await reserve(fresh,'live')).rows[0]).toEqual({parameters:{mode:'live'}})
 })
 it('bloqueia troca de identidade e de modo em contas classificadas',async()=>{
  await expect(db.exec("update stripe_connected_accounts set stripe_mode='legacy' where stripe_account_id='acct_live'")).rejects.toThrow('CONNECT_IDENTITY_IMMUTABLE')
  await expect(db.exec("update stripe_connected_accounts set stripe_account_id='acct_changed' where stripe_account_id='acct_preserved'")).rejects.toThrow('CONNECT_IDENTITY_IMMUTABLE')
  await expect(db.query("update stripe_connected_accounts set user_id=$1 where stripe_account_id='acct_test'",[owner])).rejects.toThrow('CONNECT_IDENTITY_IMMUTABLE')
 })
 it('classificação explícita preserva ID e pedido; não substitui outra conta',async()=>{
  await db.exec("update stripe_connected_accounts set stripe_mode='live' where stripe_account_id='acct_preserved' and stripe_mode='legacy'")
  expect((await db.query('select * from stripe_connected_accounts where stripe_account_id=$1',['acct_preserved'])).rows[0]).toEqual({...legacy,stripe_mode:'live'})
  expect((await db.query('select * from existing_orders')).rows).toEqual([{account_id:'acct_preserved'}])
 })
 it('reexecuta migration preservando todos os dados e modos já classificados',async()=>{
  const before=(await db.query('select * from stripe_connected_accounts order by stripe_account_id')).rows
  const requests=(await db.query('select * from stripe_account_requests order by user_id,stripe_mode')).rows
  await db.exec(migration)
  expect((await db.query('select * from stripe_connected_accounts order by stripe_account_id')).rows).toEqual(before)
  expect((await db.query('select * from stripe_account_requests order by user_id,stripe_mode')).rows).toEqual(requests)
 })
 it('nega escritas e RPC a anon/authenticated e permite RPC ao service_role',async()=>{
  for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role}`)
   await expect(db.exec("insert into stripe_connected_accounts(user_id,stripe_mode,stripe_account_id) values(gen_random_uuid(),'test','acct_attack')")).rejects.toMatchObject({code:'42501'})
   await expect(reserve(fresh,'test')).rejects.toMatchObject({code:'42501'})
   await db.exec('reset role')
  }
  await db.exec('set role service_role')
  expect((await reserve(fresh,'live')).rows[0]).toEqual({parameters:{mode:'live'}})
  await db.exec('reset role')
 })
 it.each(['legacy','unknown','',null])('recusa modo de reserva inválido: %s',async mode=>{
  await expect(reserve(fresh,mode as string)).rejects.toThrow('CONNECT_MODE_REQUIRED')
 })
})
