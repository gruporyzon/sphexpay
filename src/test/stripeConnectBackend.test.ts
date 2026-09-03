import {afterEach,describe,expect,it,vi} from 'vitest'
const {createClientMock}=vi.hoisted(()=>({createClientMock:vi.fn()}))
vi.mock('@supabase/supabase-js',()=>({createClient:createClientMock}))
// @ts-expect-error Serverless JavaScript is tested outside the frontend bundle.
import accountHandler from '../../api/stripe/connect/account.js'
// @ts-expect-error Server-side JavaScript is tested outside the frontend bundle.
import {authenticate,createOnboardingLink,ensureConnectedAccount,safeStatus} from '../../server/stripe/connect.js'

type Result={statusCode:number;body:Record<string,unknown>|null}
const response=()=>{const result:Result={statusCode:200,body:null};return{result,status(code:number){result.statusCode=code;return this},json(body:Record<string,unknown>){result.body=body;return this}}}
const connection={user_id:'user-1',stripe_account_id:'acct_test123',stripe_account_type:'express',stripe_onboarding_status:'pending',stripe_details_submitted:false,stripe_charges_enabled:false,stripe_payouts_enabled:false,stripe_requirements_currently_due:[],stripe_requirements_eventually_due:[]}

describe('fundação Stripe Connect',()=>{
 afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks()})

 it('recusa criação de conta sem autenticação',async()=>{
  vi.stubEnv('SUPABASE_URL','https://project.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','server-key')
  createClientMock.mockReturnValue({auth:{getUser:vi.fn()}})
  const output=response();await accountHandler({method:'POST',headers:{}},output)
  expect(output.result).toMatchObject({statusCode:401,body:{success:false,code:'UNAUTHORIZED'}})
 })

 it('obtém o usuário exclusivamente a partir do bearer token',async()=>{
  const getUser=vi.fn(async()=>({data:{user:{id:'owner-1',email:'seller@example.test'}},error:null}))
  const user=await authenticate({headers:{authorization:'Bearer secure-token'}},{auth:{getUser}})
  expect(user.id).toBe('owner-1');expect(getUser).toHaveBeenCalledWith('secure-token')
 })

 it('reutiliza a conta existente e não cria duplicata',async()=>{
  const maybeSingle=vi.fn(async()=>({data:connection,error:null})),query={eq:vi.fn(()=>({maybeSingle}))}
  const database={from:vi.fn(()=>({select:vi.fn(()=>query)}))},stripe={accounts:{create:vi.fn()}}
  const result=await ensureConnectedAccount(database,{id:'user-1',email:'seller@example.test'},stripe)
  expect(result).toEqual(connection);expect(stripe.accounts.create).not.toHaveBeenCalled()
 })

 it('cria conta com controller Express, transfers e uma chave idempotente por usuário',async()=>{
  const created={id:'acct_new123',type:'express',details_submitted:false,charges_enabled:false,payouts_enabled:false,requirements:{currently_due:[],eventually_due:[]}}
  const maybeSingle=vi.fn(async()=>({data:null,error:null})),selectExisting={eq:vi.fn(()=>({maybeSingle}))}
  const single=vi.fn(async()=>({data:{...connection,stripe_account_id:'acct_new123'},error:null})),selectSaved=vi.fn(()=>({single})),upsert=vi.fn(()=>({select:selectSaved}))
  const database={from:vi.fn().mockReturnValueOnce({select:vi.fn(()=>selectExisting)}).mockReturnValueOnce({upsert})}
  const stripe={accounts:{create:vi.fn(async(_params:unknown,_options:unknown)=>created)}}
  await ensureConnectedAccount(database,{id:'user-1',email:'seller@example.test'},stripe)
  const [params,options]=stripe.accounts.create.mock.calls[0]
  expect(params).not.toHaveProperty('type')
  expect(params).toEqual(expect.objectContaining({controller:{fees:{payer:'application'},losses:{payments:'application'},stripe_dashboard:{type:'express'}},capabilities:{transfers:{requested:true}}}))
  expect(options).toEqual(expect.objectContaining({idempotencyKey:expect.stringMatching(/^sphex-connect-/)}))
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({user_id:'user-1',stripe_account_id:'acct_new123'}),{onConflict:'user_id'})
 })

 it('usa APP_URL confiável nos retornos e gera account_onboarding',async()=>{
  vi.stubEnv('APP_URL','https://sphexpay.example')
  const create=vi.fn(async input=>({url:'https://connect.stripe.test/link',...input}))
  await createOnboardingLink(connection,{accountLinks:{create}})
  expect(create).toHaveBeenCalledWith({account:'acct_test123',type:'account_onboarding',refresh_url:'https://sphexpay.example/app/financeiro/stripe/refresh',return_url:'https://sphexpay.example/app/financeiro/stripe/return',collection_options:{fields:'eventually_due'}})
 })

 it('expõe apenas o contrato seguro de status',()=>{
  expect(safeStatus(connection)).toEqual({connected:true,accountId:'acct_test123',detailsSubmitted:false,chargesEnabled:false,payoutsEnabled:false,onboardingStatus:'pending',requirements:{currentlyDue:[],eventuallyDue:[]}})
 })
})
