import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import {afterAll,afterEach,beforeAll,beforeEach,expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({retrieve:vi.fn()}))
vi.mock('../../server/stripe/client.js',async original=>({...await original<object>(),getStripe:()=>({accounts:{retrieve:mocks.retrieve}})}))
// @ts-expect-error Server JavaScript is outside the frontend bundle.
import handler from '../../api/stripe/connect/status.js'
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
const columns=['id','user_id','stripe_account_id','stripe_account_type','stripe_onboarding_status','stripe_details_submitted','stripe_charges_enabled','stripe_payouts_enabled','stripe_requirements_currently_due','stripe_requirements_eventually_due','created_at','updated_at','stripe_capabilities','stripe_mode']
let db:PGlite
let patchError:any,throwPatch:boolean,emptyPatch:boolean
let patches:{url:URL;body:Record<string,unknown>}[],stages:string[]
const response=()=>({statusCode:0,body:null as any,setHeader:vi.fn(),status(code:number){this.statusCode=code;return this},json(body:any){this.body=body;return this}})
const run=async()=>{const out=response();await handler({method:'GET',headers:{authorization:'Bearer synthetic-session'},query:{mode:'live'}},out);return out}
beforeAll(async()=>{
 db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as 'select null::uuid';`)
 await db.exec(readFileSync('supabase/migrations/20260909010000_stripe_connect_modes.sql','utf8'))
 await db.query('insert into auth.users values ($1),($2)',[owner,other])
},30000)
afterAll(async()=>{await db?.close()})
beforeEach(async()=>{
 vi.stubEnv('SUPABASE_URL','https://project.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-service-key');vi.stubEnv('STRIPE_SECRET_KEY','sk_test_fixture')
 vi.spyOn(console,'error').mockImplementation(()=>{})
 patchError=null;throwPatch=false;emptyPatch=false;patches=[];stages=[]
 await db.exec('delete from public.stripe_connected_accounts')
 for(const [user,mode,id] of [[owner,'legacy','acct_legacy'],[owner,'test','acct_test'],[owner,'live','acct_live'],[other,'test','acct_other']]){
  await db.query('insert into stripe_connected_accounts(user_id,stripe_mode,stripe_account_id) values ($1,$2,$3)',[user,mode,id])
 }
 mocks.retrieve.mockImplementation(async(id:string)=>{stages.push('Stripe GET success');return{id,type:'none',details_submitted:true,charges_enabled:true,payouts_enabled:true,capabilities:{card_payments:'active',transfers:'active'},requirements:{currently_due:[],eventually_due:['business_profile.url']},metadata:{sphex_user_id:owner}}})
 // Exercise the real Supabase client's HTTP serialization, then execute its PATCH
 // payload and filters against PostgreSQL with the project's actual constraints.
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(input)),method=init?.method||'GET'
  const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
  if(url.pathname==='/auth/v1/user'){stages.push('Auth GET');return json({id:owner})}
  expect(url.pathname).toBe('/rest/v1/stripe_connected_accounts')
  const values:unknown[]=[],where:string[]=[]
  for(const [key,value] of url.searchParams){
   if(key==='select')continue
   expect(columns).toContain(key);expect(value.startsWith('eq.')).toBe(true)
   values.push(value.slice(3));where.push(`${key}=$${values.length}`)
  }
  if(method==='GET'){
   stages.push('Supabase GET')
   const result=await db.query(`select * from stripe_connected_accounts where ${where.join(' and ')}`,values)
   return json(result.rows)
  }
  expect(method).toBe('PATCH');stages.push('Supabase PATCH')
  const body=JSON.parse(String(init?.body));patches.push({url,body})
  if(throwPatch)throw new Error('synthetic-private-token private@example.test')
  if(patchError)return json(patchError,400)
  if(emptyPatch)return json({code:'PGRST116',message:'private row details'},406)
  const sets=Object.entries(body).map(([key,value])=>{
   expect(columns).toContain(key);values.push(value);return `${key}=$${values.length}`
  })
  const result=await db.query(`update stripe_connected_accounts set ${sets.join(',')} where ${where.join(' and ')} returning *`,values)
  expect(result.rows).toHaveLength(1)
  return json(result.rows[0])
 }))
})
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();vi.clearAllMocks()})
it('GET pós-onboarding persiste schema real, flags e contrato sem tocar legacy/live/outro usuário',async()=>{
 const before=(await db.query("select * from stripe_connected_accounts where stripe_mode<>'test' or user_id<>$1 order by stripe_account_id",[owner])).rows
 const schema=await db.query<{column_name:string}>("select column_name from information_schema.columns where table_schema='public' and table_name='stripe_connected_accounts'")
 expect(schema.rows.map(row=>row.column_name).sort()).toEqual([...columns].sort())
 const out=await run()
 expect(stages).toEqual(['Auth GET','Supabase GET','Stripe GET success','Supabase PATCH'])
 expect(mocks.retrieve).toHaveBeenCalledExactlyOnceWith('acct_test')
 expect(patches).toHaveLength(1)
 expect(Object.fromEntries(patches[0].url.searchParams)).toMatchObject({user_id:`eq.${owner}`,stripe_mode:'eq.test',stripe_account_id:'eq.acct_test'})
 expect(patches[0].body).toEqual({user_id:owner,stripe_mode:'test',stripe_account_id:'acct_test',stripe_account_type:'express',stripe_onboarding_status:'enabled',stripe_details_submitted:true,stripe_charges_enabled:true,stripe_payouts_enabled:true,stripe_capabilities:{card_payments:'active',transfers:'active'},stripe_requirements_currently_due:[],stripe_requirements_eventually_due:['business_profile.url'],updated_at:expect.any(String)})
 expect(out).toMatchObject({statusCode:200,body:{success:true,mode:'test',connected:true,onboardingComplete:true,chargesEnabled:true,payoutsEnabled:true,detailsSubmitted:true}})
 for(const physical of columns)expect(out.body).not.toHaveProperty(physical)
 const saved=(await db.query('select * from stripe_connected_accounts where user_id=$1 and stripe_mode=$2',[owner,'test'])).rows[0]
 expect(JSON.parse(JSON.stringify(saved))).toMatchObject(patches[0].body)
 expect((await db.query("select * from stripe_connected_accounts where stripe_mode<>'test' or user_id<>$1 order by stripe_account_id",[owner])).rows).toEqual(before)
 expect(console.error).not.toHaveBeenCalled()
})
it.each(['23514','42501','PGRST204'])('falha PATCH %s após retrieve é interna, com diagnóstico seguro',async code=>{
 patchError={code,message:code==='PGRST204'?"Could not find the 'stripe_capabilities' column of 'stripe_connected_accounts' in the schema cache":'private@example.test synthetic-private-token',details:'acct_private',hint:'Bearer synthetic-secret'}
 const out=await run()
 expect(out).toMatchObject({statusCode:500,body:{success:false,code:'CONNECT_STORAGE_ERROR'}})
 expect(stages).toEqual(['Auth GET','Supabase GET','Stripe GET success','Supabase PATCH'])
 expect(console.error).toHaveBeenCalledWith('[Stripe Connect][Supabase persistence]',expect.objectContaining({stage:'persist_status',mode:'test',operation:'PATCH',code,status:400,message:code==='PGRST204'?patchError.message:'[REDACTED]'}))
 const serialized=JSON.stringify([vi.mocked(console.error).mock.calls,out.body])
 for(const secret of ['private@example.test','synthetic-private-token','acct_private','synthetic-secret'])expect(serialized).not.toContain(secret)
 expect((await db.query('select stripe_details_submitted from stripe_connected_accounts where stripe_mode=$1',['test'])).rows.every((row:any)=>row.stripe_details_submitted===false)).toBe(true)
})
it.each(['network','empty'])('falha %s na persistência também retorna 500',async kind=>{
 throwPatch=kind==='network';emptyPatch=kind==='empty'
 expect(await run()).toMatchObject({statusCode:500,body:{code:'CONNECT_STORAGE_ERROR'}})
 expect(console.error).toHaveBeenCalledWith('[Stripe Connect][Supabase persistence]',expect.objectContaining({stage:'persist_status',mode:'test',operation:'PATCH'}))
})
it.each([
 [{type:'StripeConnectionError'},503],
 [{type:'StripeRateLimitError',statusCode:429},503],
 [{type:'StripeAPIError',statusCode:503},503],
 [{type:'StripeAuthenticationError',statusCode:401},500],
 [{type:'StripeInvalidRequestError',statusCode:400},500],
 [{type:'StripeInvalidRequestError',statusCode:404},500]
])('classifica erro de retrieve %j e nunca faz PATCH',async(error,status)=>{
 mocks.retrieve.mockRejectedValue(error)
 expect(await run()).toMatchObject({statusCode:status})
 expect(patches).toHaveLength(0)
})
it('configuração Stripe ausente é 500 e nunca faz PATCH',async()=>{
 vi.stubEnv('STRIPE_SECRET_KEY','')
 expect(await run()).toMatchObject({statusCode:500,body:{code:'STRIPE_NOT_CONFIGURED'}})
 expect(patches).toHaveLength(0)
})
