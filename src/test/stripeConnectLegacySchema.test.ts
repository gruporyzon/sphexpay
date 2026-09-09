import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import {afterAll,beforeAll,describe,expect,it} from 'vitest'
const read=(name:string)=>readFileSync(`supabase/migrations/${name}.sql`,'utf8')
const migration=read('20260909010000_stripe_connect_modes')
const foundation=read('20260903110000_stripe_connect_foundation')
const payments=read('20260904120000_stripe_payments')
const owner='11111111-1111-4111-8111-111111111111'
const fresh='22222222-2222-4222-8222-222222222222'
const setup=`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as 'select null::uuid';`
const fks=(db:PGlite)=>db.query(`select oid,conname,pg_get_constraintdef(oid) as definition from pg_constraint
 where contype='f' order by oid`)

describe.each(['foundation_only','requests_only','full_connect','no_connect_tables'] as const)('schema legado: %s',scenario=>{
 let db:PGlite,oldRows:Record<string,unknown>[],oldRequests:Record<string,unknown>[],oldFks:unknown[]
 beforeAll(async()=>{
  db=new PGlite();await db.exec(setup)
  await db.query('insert into auth.users values($1),($2)',[owner,fresh])
  if(scenario!=='no_connect_tables'){
   await db.exec(foundation)
   if(scenario==='full_connect')await db.exec(payments.slice(0,payments.indexOf('create table public.stripe_checkout_orders')))
   if(scenario==='requests_only'){
    // Historical table shape, but no capabilities, trigger, functions or grants.
    await db.exec(payments.slice(payments.indexOf('create table public.stripe_account_requests'),payments.indexOf('create function public.reserve_stripe_account')))
    await db.exec('alter table stripe_account_requests rename constraint stripe_account_requests_pkey to historical_request_owner_pk')
    await db.exec('alter table stripe_connected_accounts rename constraint stripe_connected_accounts_user_id_key to historical_connect_owner_key')
   }
   await db.query(`insert into stripe_connected_accounts(user_id,stripe_account_id,stripe_onboarding_status,
    stripe_details_submitted,stripe_charges_enabled,stripe_payouts_enabled,stripe_requirements_currently_due,
    stripe_requirements_eventually_due,created_at,updated_at)
    values($1,'acct_preserved','requirements_due',true,true,false,array['external_account'],array['business_profile.url'],
    '2026-01-01T00:00:00Z','2026-02-01T00:00:00Z')`,[owner])
   if(scenario==='full_connect')await db.exec(`update stripe_connected_accounts set stripe_capabilities='{"card_payments":"active"}'`)
   await db.exec('create table historical_orders(account_id text references stripe_connected_accounts(stripe_account_id))')
   await db.exec("insert into historical_orders values('acct_preserved')")
   oldRows=(await db.query<Record<string,unknown>>('select * from stripe_connected_accounts')).rows
  }else oldRows=[]
  if(['requests_only','full_connect'].includes(scenario)){
   await db.query(`insert into stripe_account_requests(user_id,parameters,created_at) values($1,'{"original":true}','2026-01-01T00:00:00Z')`,[owner])
   oldRequests=(await db.query<Record<string,unknown>>('select * from stripe_account_requests')).rows
  }else oldRequests=[]
  oldFks=(await fks(db)).rows
  await db.exec(migration)
 },30000)
 afterAll(async()=>{await db?.close()})
 it('preserva IDs, usuários, status, flags, timestamps, reservas e FKs; não classifica legado',async()=>{
  const rows=(await db.query('select * from stripe_connected_accounts')).rows
  expect(rows).toEqual(oldRows.map(r=>({stripe_capabilities:{},...r,stripe_mode:'legacy'})))
  expect((await db.query('select * from stripe_account_requests')).rows).toEqual(oldRequests.map(r=>({...r,stripe_mode:'legacy'})))
  expect((await fks(db)).rows).toEqual(expect.arrayContaining(oldFks))
  if(oldRows.length)expect((await db.query('select * from historical_orders')).rows).toEqual([{account_id:'acct_preserved'}])
 })
 it('possui colunas e defaults de reserva compatíveis com o backend',async()=>{
  const result=await db.query(`select column_name,data_type,is_nullable,column_default from information_schema.columns
   where table_schema='public' and table_name='stripe_account_requests' order by ordinal_position`)
  expect(result.rows).toEqual([
   {column_name:'user_id',data_type:'uuid',is_nullable:'NO',column_default:null},
   {column_name:'parameters',data_type:'jsonb',is_nullable:'NO',column_default:null},
   {column_name:'created_at',data_type:'timestamp with time zone',is_nullable:'NO',column_default:'now()'},
   {column_name:'stripe_mode',data_type:'text',is_nullable:'NO',column_default:"'legacy'::text"}
  ])
 })
 it('RPC e persistência Test funcionam com service_role sem depender de pagamentos',async()=>{
  await db.exec('set role service_role')
  const reserve=()=>db.query("select reserve_stripe_account_for_mode($1,'test',$2) as parameters",[owner,{contact_email:'synthetic@example.test'}])
  expect((await reserve()).rows[0]).toEqual({parameters:{contact_email:'synthetic@example.test'}})
  expect((await reserve()).rows[0]).toEqual({parameters:{contact_email:'synthetic@example.test'}})
  await db.query(`insert into stripe_connected_accounts(user_id,stripe_mode,stripe_account_id)
   values($1,'test','acct_newtest') on conflict(user_id,stripe_mode) do update set updated_at=excluded.updated_at`,[owner])
  await db.query("update stripe_connected_accounts set stripe_details_submitted=true where user_id=$1 and stripe_mode='test'",[owner])
  await db.exec('reset role')
  expect((await db.query("select stripe_details_submitted from stripe_connected_accounts where stripe_mode='test'")).rows).toEqual([{stripe_details_submitted:true}])
 })
 it('instala trigger real e recusa trocar ID ou modo',async()=>{
  await expect(db.exec("update stripe_connected_accounts set stripe_account_id='acct_replacement' where stripe_mode='test'")).rejects.toThrow('CONNECT_IDENTITY_IMMUTABLE')
  await expect(db.exec("update stripe_connected_accounts set stripe_mode='live' where stripe_mode='test'")).rejects.toThrow('CONNECT_IDENTITY_IMMUTABLE')
  expect((await db.query("select tgenabled from pg_trigger where tgrelid='stripe_connected_accounts'::regclass and tgname='stripe_connection_identity_guard'")).rows).toEqual([{tgenabled:'O'}])
 })
 it('protege as duas RPCs e a tabela de reservas quando são criadas do zero',async()=>{
  for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role}`)
   await expect(db.query('select reserve_stripe_account($1,$2)',[owner,{}])).rejects.toMatchObject({code:'42501'})
   await expect(db.query("select reserve_stripe_account_for_mode($1,'test',$2)",[owner,{}])).rejects.toMatchObject({code:'42501'})
   await expect(db.exec('select * from stripe_account_requests')).rejects.toMatchObject({code:'42501'})
   await expect(db.query("insert into stripe_account_requests(user_id,parameters) values($1,'{}')",[fresh])).rejects.toMatchObject({code:'42501'})
   await expect(db.exec("update stripe_connected_accounts set stripe_charges_enabled=false")).rejects.toMatchObject({code:'42501'})
   await db.exec('reset role')
  }
  expect((await db.query("select relrowsecurity,relforcerowsecurity from pg_class where oid='stripe_account_requests'::regclass")).rows).toEqual([{relrowsecurity:true,relforcerowsecurity:true}])
 })
 it('reexecuta sem mudar dados, classificações, FKs ou duplicar triggers/policies',async()=>{
  await db.query("insert into stripe_connected_accounts(user_id,stripe_mode,stripe_account_id) values($1,'live','acct_liveclassified')",[fresh])
  const before=(await db.query('select * from stripe_connected_accounts order by stripe_account_id')).rows
  const requests=(await db.query('select * from stripe_account_requests order by user_id,stripe_mode')).rows
  const foreignKeys=(await fks(db)).rows
  await db.exec(migration);await db.exec(migration)
  expect((await db.query('select * from stripe_connected_accounts order by stripe_account_id')).rows).toEqual(before)
  expect((await db.query('select * from stripe_account_requests order by user_id,stripe_mode')).rows).toEqual(requests)
  expect((await fks(db)).rows).toEqual(foreignKeys)
  expect((await db.query("select count(*)::int as n from pg_trigger where tgrelid='stripe_connected_accounts'::regclass and tgname='stripe_connection_identity_guard'")).rows).toEqual([{n:1}])
  expect((await db.query("select count(*)::int as n from pg_policy where polrelid='stripe_connected_accounts'::regclass and polname='stripe_connections_select_own'")).rows).toEqual([{n:1}])
 })
})

it('reproduz 42P01 da versão anterior e comprova rollback do DDL antes de aplicar a correção',async()=>{
 const db=new PGlite()
 try{
  await db.exec(setup);await db.exec(foundation)
  await db.query('insert into auth.users values($1)',[owner])
  await db.query("insert into stripe_connected_accounts(user_id,stripe_account_id) values($1,'acct_preserved')",[owner])
  const before=(await db.query('select * from stripe_connected_accounts')).rows
  await expect(db.exec(`begin;
   alter table stripe_connected_accounts add column stripe_mode text not null default 'legacy';
   alter table stripe_account_requests add column stripe_mode text not null default 'legacy';
   commit;`)).rejects.toMatchObject({code:'42P01'})
  // PostgreSQL leaves the transaction aborted until the runner rolls it back/closes it.
  await db.exec('rollback')
  expect((await db.query('select * from stripe_connected_accounts')).rows).toEqual(before)
  await db.exec(migration)
  expect((await db.query('select * from stripe_connected_accounts')).rows).toEqual(before.map((r:any)=>({...r,stripe_capabilities:{},stripe_mode:'legacy'})))
 }finally{await db.close()}
},30000)

it('FK inesperada para user_id faz falhar atomicamente, sem CASCADE ou perda de referência',async()=>{
 const db=new PGlite()
 try{
  await db.exec(setup);await db.exec(foundation)
  await db.query('insert into auth.users values($1)',[owner])
  await db.query("insert into stripe_connected_accounts(user_id,stripe_account_id) values($1,'acct_preserved')",[owner])
  await db.exec('create table external_owner_reference(owner uuid references stripe_connected_accounts(user_id))')
  await db.query('insert into external_owner_reference values($1)',[owner])
  const before=(await db.query('select * from stripe_connected_accounts')).rows
  const foreignKeys=(await fks(db)).rows
  await expect(db.exec(migration)).rejects.toMatchObject({code:'2BP01'})
  await db.exec('rollback')
  expect((await db.query('select * from stripe_connected_accounts')).rows).toEqual(before)
  expect((await fks(db)).rows).toEqual(foreignKeys)
  expect((await db.query('select * from external_owner_reference')).rows).toEqual([{owner}])
 }finally{await db.close()}
},30000)
