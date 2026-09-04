import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
const {createClientMock}=vi.hoisted(()=>({createClientMock:vi.fn()}))
vi.mock('@supabase/supabase-js',()=>({createClient:createClientMock}))
// @ts-expect-error Serverless JavaScript is tested outside the frontend bundle.
import accountHandler from '../../api/stripe/connect/account.js'
// @ts-expect-error Server-side JavaScript is tested outside the frontend bundle.
import {authenticate,createOnboardingLink,ensureConnectedAccount,fail,retrieveAndSync,safeStatus} from '../../server/stripe/connect.js'

type Result={statusCode:number;body:Record<string,unknown>|null}
const response=()=>{const result:Result={statusCode:200,body:null};return{result,status(code:number){result.statusCode=code;return this},json(body:Record<string,unknown>){result.body=body;return this}}}
const connection={user_id:'user-1',stripe_account_id:'acct_test123',stripe_account_type:'express',stripe_onboarding_status:'pending',stripe_details_submitted:false,stripe_charges_enabled:false,stripe_payouts_enabled:false,stripe_requirements_currently_due:[],stripe_requirements_eventually_due:[]}

describe('fundação Stripe Connect',()=>{
 beforeEach(()=>{vi.spyOn(console,'error').mockImplementation(()=>{})})
 afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();vi.restoreAllMocks()})

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
  const create=vi.fn(),database={from:vi.fn(()=>({select:vi.fn(()=>query)}))},stripe={v2:{core:{accounts:{create}}}}
  const result=await ensureConnectedAccount(database,{id:'user-1',email:'seller@example.test'},stripe)
  expect(result).toEqual(connection);expect(create).not.toHaveBeenCalled()
 })

 it('cria Account v2 com merchant e recipient brasileiros e salva o id com idempotência',async()=>{
  const created={id:'acct_new123',object:'v2.core.account'}
  const maybeSingle=vi.fn(async()=>({data:null,error:null})),selectExisting={eq:vi.fn(()=>({maybeSingle}))}
  const single=vi.fn(async()=>({data:{...connection,stripe_account_id:'acct_new123'},error:null})),selectSaved=vi.fn(()=>({single})),upsert=vi.fn(()=>({select:selectSaved}))
  const database={from:vi.fn().mockReturnValueOnce({select:vi.fn(()=>selectExisting)}).mockReturnValueOnce({upsert})}
  const create=vi.fn<(params:unknown,options:unknown)=>Promise<typeof created>>().mockResolvedValue(created),legacyCreate=vi.fn()
  const stripe={v2:{core:{accounts:{create}}},accounts:{create:legacyCreate}}
  await ensureConnectedAccount(database,{id:'user-1',email:'seller@example.test'},stripe)
  expect(create).toHaveBeenCalledTimes(1)
  const [params,options]=create.mock.calls[0]
  expect(legacyCreate).not.toHaveBeenCalled()
  expect(params).toEqual({contact_email:'seller@example.test',identity:{country:'br'},dashboard:'express',configuration:{merchant:{capabilities:{card_payments:{requested:true}}},recipient:{capabilities:{stripe_balance:{stripe_transfers:{requested:true}}}}},defaults:{responsibilities:{fees_collector:'application',losses_collector:'application'}},metadata:{sphex_user_id:'user-1'}})
  expect(options).toEqual(expect.objectContaining({idempotencyKey:expect.stringMatching(/^sphex-connect-/)}))
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({user_id:'user-1',stripe_account_id:'acct_new123'}),{onConflict:'user_id'})
 })

 it('mantém a mesma chave de idempotência ao repetir após falha no Supabase',async()=>{
  const maybeSingle=vi.fn(async()=>({data:null,error:null}))
  const single=vi.fn().mockResolvedValueOnce({data:null,error:{message:'storage unavailable'}}).mockResolvedValueOnce({data:connection,error:null})
  const upsert=vi.fn(()=>({select:vi.fn(()=>({single}))}))
  const database={from:vi.fn(()=>({select:vi.fn(()=>({eq:vi.fn(()=>({maybeSingle}))})),upsert}))}
  const create=vi.fn<(params:unknown,options:unknown)=>Promise<{id:string;object:string}>>().mockResolvedValue({id:connection.stripe_account_id,object:'v2.core.account'})
  const stripe={v2:{core:{accounts:{create}}}},user={id:'user-1',email:'seller@example.test'}
  await expect(ensureConnectedAccount(database,user,stripe)).rejects.toMatchObject({code:'CONNECT_STORAGE_ERROR'})
  await expect(ensureConnectedAccount(database,user,stripe)).resolves.toEqual(connection)
  expect(create).toHaveBeenCalledTimes(2)
  expect(create.mock.calls[1]).toEqual(create.mock.calls[0])
  expect(create.mock.calls[1][1]).toEqual({idempotencyKey:expect.stringMatching(/^sphex-connect-[a-f0-9]{64}$/)})
  expect(upsert).toHaveBeenLastCalledWith(expect.objectContaining({user_id:user.id,stripe_account_id:connection.stripe_account_id}),{onConflict:'user_id'})
 })

 describe('diagnóstico seguro da persistência',()=>{
  const attempt=(error:unknown,data:unknown=null)=>{
   const single=vi.fn(async()=>({data,error}))
   const upsert=vi.fn(()=>({select:vi.fn(()=>({single}))}))
   const database={from:vi.fn(()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert}))}
   const create=vi.fn(async()=>({id:'acct_new123',object:'v2.core.account'}))
   return{run:()=>ensureConnectedAccount(database,{id:'user-1'},{v2:{core:{accounts:{create}}}}),create,upsert,single}
  }

  it.each([
   {code:'42501',message:'permission denied for table stripe_connected_accounts',details:null,hint:null},
   {code:'23514',message:'new row for relation "stripe_connected_accounts" violates check constraint "stripe_connected_accounts_account_id_format"',details:null,hint:null},
   {code:'23505',message:'duplicate key value violates unique constraint "stripe_connected_accounts_user_id_key"',details:null,hint:null},
   {code:'PGRST205',message:"Could not find the table 'public.stripe_connected_accounts' in the schema cache",details:null,hint:null}
  ])('registra somente os quatro campos técnicos seguros: $code',async error=>{
   const {run,create,upsert,single}=attempt({...error,request:{Authorization:'private'},account:{email:'private@example.test'}})
   const caught=await run().catch((failure:unknown)=>failure)
   expect(caught).toMatchObject({code:'CONNECT_STORAGE_ERROR',status:503})
   expect(console.error).toHaveBeenCalledExactlyOnceWith('[Stripe Connect][Supabase persistence]',error)
   const output=response();fail(output,caught)
   expect(output.result).toEqual({statusCode:503,body:{success:false,code:'CONNECT_STORAGE_ERROR',message:'A conta foi criada, mas não foi possível concluir o vínculo. Tente novamente.'}})
   expect(create).toHaveBeenCalledTimes(1)
   expect(upsert).toHaveBeenCalledWith(expect.objectContaining({user_id:'user-1',stripe_account_id:'acct_new123'}),{onConflict:'user_id'})
   expect(single).toHaveBeenCalledTimes(1)
  })

  it.each([
   'Authorization: Bearer synthetic-token',
   'Cookie: session=synthetic-cookie',
   'seller@example.test',
   'STRIPE_SECRET_KEY='+'sk_'+'test_'+'x'.repeat(24),
   'SUPABASE_SERVICE_ROLE_KEY=synthetic-service-credential',
   'access_token=synthetic-access',
   'refresh_token=synthetic-refresh',
   'Failing row contains (Maria Silva, +55 11 99999-9999, Rua Exemplo 123).',
   'Key (user_id)=(00000000-0000-4000-8000-000000000001) already exists.',
   'permission denied for table stripe_connected_accounts\nAuthorization: Bearer synthetic-token',
   {email:'seller@example.test'},
   ['personal data']
  ])('oculta texto livre, credenciais e dados pessoais: %#',async value=>{
   const {run}=attempt({code:value,message:value,details:value,hint:value})
   await expect(run()).rejects.toMatchObject({code:'CONNECT_STORAGE_ERROR',status:503})
   expect(console.error).toHaveBeenCalledExactlyOnceWith('[Stripe Connect][Supabase persistence]',{code:null,message:'[REDACTED]',details:'[REDACTED]',hint:'[REDACTED]'})
  })

  it('não altera sucesso nem registra erro inexistente',async()=>{
   await expect(attempt(null,connection).run()).resolves.toEqual(connection)
   expect(console.error).not.toHaveBeenCalled()
  })

  it('preserva a falha sem dados quando Supabase não retorna um erro',async()=>{
   await expect(attempt(null).run()).rejects.toMatchObject({code:'CONNECT_STORAGE_ERROR',status:503})
   expect(console.error).not.toHaveBeenCalled()
  })

  it('preserva a resposta mesmo se o logger falhar',async()=>{
   vi.mocked(console.error).mockImplementation(()=>{throw new Error('logger unavailable')})
   await expect(attempt({code:'42501'}).run()).rejects.toMatchObject({code:'CONNECT_STORAGE_ERROR',status:503,message:'A conta foi criada, mas não foi possível concluir o vínculo. Tente novamente.'})
  })
 })

 it('usa APP_URL confiável e gera Account Link v2 para recipient onboarding',async()=>{
  vi.stubEnv('APP_URL','https://sphexpay.example')
  const create=vi.fn(async input=>({url:'https://connect.stripe.test/link',...input}))
  await createOnboardingLink(connection,{v2:{core:{accountLinks:{create}}}})
  expect(create).toHaveBeenCalledWith({account:'acct_test123',use_case:{type:'account_onboarding',account_onboarding:{configurations:['recipient'],refresh_url:'https://sphexpay.example/app/financeiro/stripe/refresh',return_url:'https://sphexpay.example/app/financeiro/stripe/return',collection_options:{fields:'eventually_due'}}}})
 })

 it('mantém a leitura de status v1 compatível e sincroniza o Supabase',async()=>{
  const account={id:'acct_test123',type:'none',details_submitted:true,charges_enabled:false,payouts_enabled:true,requirements:{currently_due:['external_account'],eventually_due:[]}}
  const single=vi.fn(async()=>({data:{...connection,stripe_details_submitted:true,stripe_payouts_enabled:true,stripe_requirements_currently_due:['external_account']},error:null}))
  const update=vi.fn(()=>({eq:vi.fn(()=>({eq:vi.fn(()=>({select:vi.fn(()=>({single}))}))}))}))
  const retrieve=vi.fn(async()=>account),database={from:vi.fn(()=>({update}))}
  await retrieveAndSync(database,'user-1',connection,{accounts:{retrieve}})
  expect(retrieve).toHaveBeenCalledWith('acct_test123');expect(update).toHaveBeenCalled()
 })

 it('trata erro Stripe sem expor detalhes sensíveis',()=>{
  const output=response();fail(output,Object.assign(new Error('sensitive Stripe detail'),{requestId:'req_secret'}))
  expect(output.result).toEqual({statusCode:502,body:{success:false,code:'CONNECT_UNAVAILABLE',message:'Não foi possível acessar a configuração de pagamentos agora.'}})
 })

 it('expõe apenas o contrato seguro de status',()=>{
  expect(safeStatus(connection)).toEqual({connected:true,accountId:'acct_test123',detailsSubmitted:false,chargesEnabled:false,payoutsEnabled:false,onboardingStatus:'pending',requirements:{currentlyDue:[],eventuallyDue:[]}})
 })
})
