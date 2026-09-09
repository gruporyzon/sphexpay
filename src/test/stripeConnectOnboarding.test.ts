import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({database:vi.fn(),stripe:vi.fn()}))
vi.mock('@supabase/supabase-js',()=>({createClient:mocks.database}))
vi.mock('../../server/stripe/client.js',async importOriginal=>({...await importOriginal<object>(),getStripe:mocks.stripe}))
// @ts-expect-error Server-side JavaScript is tested outside the frontend bundle.
import handler from '../../api/stripe/connect/onboarding.js'

const owner='11111111-1111-4111-8111-111111111111'
const record={stripe_mode:'test',user_id:owner,stripe_account_id:'acct_existing123',stripe_account_type:'express',stripe_onboarding_status:'pending',stripe_details_submitted:false,stripe_charges_enabled:false,stripe_payouts_enabled:false}
const link={account:record.stripe_account_id,url:'https://connect.stripe.com/setup/synthetic'}
const mismatch={type:'StripeInvalidRequestError',code:'configs_must_match_to_use_account_links',param:'use_case.account_onboarding.configurations',message:'Account cannot be onboard via v2/core/account_links without specifying the right configurations.',requestId:'req_fixture123'}
const response=()=>({statusCode:0,body:null as any,status(code:number){this.statusCode=code;return this},json(body:unknown){this.body=body;return this}})
const request={method:'POST',headers:{authorization:'Bearer synthetic-session'},body:{accountId:'acct_attacker',user_id:'attacker'}}
function fixture(existing:any=record){
 let saved=existing
 const maybeSingle=vi.fn(async()=>({data:saved,error:null as any}))
 const eq=vi.fn(()=>({eq,maybeSingle}))
 const single=vi.fn(async()=>({data:saved,error:null as any}))
 const upsert=vi.fn((value:any)=>{saved=value;return{select:()=>({single})}})
 const database={auth:{getUser:vi.fn(async()=>({data:{user:{id:owner}},error:null}))},rpc:vi.fn(async(_name:string,args:any)=>({data:args.p_parameters,error:null as any})),from:vi.fn(()=>({select:()=>({eq}),upsert}))}
 const createAccount=vi.fn(async()=>({id:record.stripe_account_id,object:'v2.core.account',metadata:{sphex_user_id:owner}}))
 const createLink=vi.fn<(params:any)=>Promise<any>>().mockResolvedValue(link)
 mocks.database.mockReturnValue(database)
 mocks.stripe.mockReturnValue({v2:{core:{accounts:{create:createAccount},accountLinks:{create:createLink}}}})
 return{database,maybeSingle,eq,single,upsert,createAccount,createLink}
}
beforeEach(()=>{
 vi.stubEnv('STRIPE_SECRET_KEY','sk_test_fixture')
 vi.stubEnv('SUPABASE_URL','https://project.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-service-key')
 vi.stubEnv('APP_URL','https://sphexpay.example');vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL','');vi.stubEnv('VERCEL_URL','')
 vi.spyOn(console,'error').mockImplementation(()=>{});vi.spyOn(console,'info').mockImplementation(()=>{})
})
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();vi.clearAllMocks()})
describe('endpoint de onboarding v2 com persistência confirmada',()=>{
 it('reutiliza vínculo do usuário autenticado e retorna URL sem aceitar account ID do cliente',async()=>{
  const f=fixture(),out=response();await handler(request,out)
  expect(out).toMatchObject({statusCode:200,body:{success:true,url:link.url}})
  expect(f.eq).toHaveBeenCalledWith('user_id',owner)
  expect(f.createAccount).not.toHaveBeenCalled();expect(f.upsert).not.toHaveBeenCalled();expect(f.database.rpc).not.toHaveBeenCalled()
  expect(f.createLink).toHaveBeenCalledWith({account:record.stripe_account_id,use_case:{type:'account_onboarding',account_onboarding:{configurations:['merchant','recipient'],refresh_url:'https://sphexpay.example/app/financeiro/stripe/refresh',return_url:'https://sphexpay.example/app/financeiro/stripe/return',collection_options:{fields:'eventually_due'}}}})
 })
 it('registra erro Stripe e retry gera somente outro link, sem criar conta',async()=>{
  const f=fixture();f.createLink.mockRejectedValueOnce(mismatch)
  const failed=response();await handler(request,failed)
  expect(failed).toMatchObject({statusCode:500,body:{success:false,code:'ONBOARDING_LINK_FAILED',message:'Não foi possível abrir a configuração da Stripe agora.'}})
  expect(console.error).toHaveBeenCalledWith('[Stripe Connect][Onboarding]',{operation:'v2.core.accountLinks.create',type:mismatch.type,code:mismatch.code,param:mismatch.param,message:mismatch.message,request_id:mismatch.requestId,statusCode:null,raw:{type:null,code:null,message:null}})
  const retry=response();await handler(request,retry)
  expect(retry).toMatchObject({statusCode:200,body:{url:link.url}})
  expect(f.createLink).toHaveBeenCalledTimes(2);expect(f.createAccount).not.toHaveBeenCalled()
  expect(JSON.stringify(failed.body)).not.toContain(mismatch.code)
 })
 it('sem vínculo, cria conta do modo atual e retry reutiliza o vínculo',async()=>{
  const f=fixture(null)
  for(let i=0;i<2;i++){
   const out=response();await handler(request,out)
   expect(out).toMatchObject({statusCode:200,body:{url:link.url}})
  }
  expect(f.createAccount).toHaveBeenCalledTimes(1);expect(f.createLink).toHaveBeenCalledTimes(2)
  expect(f.database.rpc).toHaveBeenCalledWith('reserve_stripe_account_for_mode',expect.objectContaining({p_mode:'test'}))
  expect(f.upsert).toHaveBeenCalledWith(expect.objectContaining({stripe_mode:'test'}),{onConflict:'user_id,stripe_mode'})
 })
 it.each([null,undefined,'','cus_other','acct_','acct_bad-id'])('bloqueia referência persistida inválida: %s',async id=>{
  const f=fixture({...record,stripe_account_id:id}),out=response();await handler(request,out)
  expect(out).toMatchObject({statusCode:500,body:{code:'CONNECT_ACCOUNT_INVALID'}})
  expect(f.createAccount).not.toHaveBeenCalled();expect(f.createLink).not.toHaveBeenCalled()
 })
 it.each(['http://localhost:3000','https://localhost','https://127.0.0.1','https://[::1]'])('bloqueia localhost em produção: %s',async origin=>{
  vi.stubEnv('VERCEL_ENV','production');vi.stubEnv('APP_URL',origin)
  const f=fixture(),out=response();await handler(request,out)
  expect(out).toMatchObject({statusCode:500,body:{code:'APP_URL_NOT_CONFIGURED'}})
  expect(f.createLink).not.toHaveBeenCalled()
  expect(console.error).toHaveBeenCalledWith('[Stripe Connect][Onboarding]',expect.objectContaining({operation:'onboarding.validate_urls',response_status:500,code:'APP_URL_NOT_CONFIGURED'}))
 })
 it('preserva campos técnicos de erro Stripe incluindo raw e status HTTP',async()=>{
  const f=fixture();f.createLink.mockRejectedValue({...mismatch,statusCode:400,raw:{type:'invalid_request_error',code:mismatch.code,message:mismatch.message}})
  const out=response();await handler(request,out)
  expect(out.statusCode).toBe(500)
  expect(console.error).toHaveBeenCalledWith('[Stripe Connect][Onboarding]',expect.objectContaining({operation:'v2.core.accountLinks.create',statusCode:400,raw:{type:'invalid_request_error',code:mismatch.code,message:mismatch.message}}))
 })
 it('registra URLs efetivas sanitizadas e referência mascarada da conta persistida',async()=>{
  fixture();await handler(request,response())
  expect(console.info).toHaveBeenCalledWith('[Stripe Connect][Onboarding context]',expect.objectContaining({operation:'v2.core.accountLinks.create',account_source:'persisted_connection',account_reference:'acct_…ing123',return_url:'https://sphexpay.example/app/financeiro/stripe/return',refresh_url:'https://sphexpay.example/app/financeiro/stripe/refresh'}))
  expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(record.stripe_account_id)
 })
 it('erro de consulta Supabase é diagnosticado sem prosseguir para Stripe',async()=>{
  const f=fixture();f.maybeSingle.mockResolvedValue({data:null,error:{code:'42501',message:'permission denied for table stripe_connected_accounts',details:'private row',hint:null}})
  const out=response();await handler(request,out)
  expect(out).toMatchObject({statusCode:500,body:{code:'CONNECT_STORAGE_ERROR'}})
  expect(console.error).toHaveBeenCalledWith('[Stripe Connect][Supabase persistence]',{operation:'find_connection',code:'42501',message:'permission denied for table stripe_connected_accounts',details:'[REDACTED]',hint:null})
  expect(f.createAccount).not.toHaveBeenCalled();expect(f.createLink).not.toHaveBeenCalled()
 })
 it('recusa vínculo de outro usuário antes de qualquer chamada Stripe',async()=>{
  const f=fixture({...record,user_id:'other'}),out=response();await handler(request,out)
  expect(out).toMatchObject({statusCode:403,body:{code:'CONNECT_OWNERSHIP_MISMATCH'}})
  expect(f.createAccount).not.toHaveBeenCalled();expect(f.createLink).not.toHaveBeenCalled()
 })
 it('sem autenticação não consulta vínculos nem cria conta ou link',async()=>{
  const f=fixture(),out=response();await handler({...request,headers:{}},out)
  expect(out.statusCode).toBe(401);expect(f.database.from).not.toHaveBeenCalled()
  expect(f.createAccount).not.toHaveBeenCalled();expect(f.createLink).not.toHaveBeenCalled()
 })
 it.each(['javascript:alert(1)','http://sphexpay.example','https://user:password@sphexpay.example','not-a-url',''])('recusa base inválida para return_url/refresh_url: %s',async value=>{
  const f=fixture();vi.stubEnv('APP_URL',value)
  const out=response();await handler(request,out)
  expect(out).toMatchObject({statusCode:500,body:{code:'APP_URL_NOT_CONFIGURED'}})
  expect(f.createLink).not.toHaveBeenCalled();expect(f.createAccount).not.toHaveBeenCalled()
 })
 it.each([undefined,null,'','not-a-url','javascript:alert(1)','http://connect.stripe.com/test','https://user:password@connect.stripe.com/test'])('recusa resposta sem URL HTTPS válida: %s',async url=>{
  const f=fixture();f.createLink.mockResolvedValue({url,lastResponse:{requestId:'req_invalid123'}})
  const out=response();await handler(request,out)
  expect(out).toMatchObject({statusCode:502,body:{code:'ONBOARDING_LINK_FAILED'}})
  expect(console.error).toHaveBeenCalledWith('[Stripe Connect][Onboarding]',expect.objectContaining({code:'invalid_onboarding_url',request_id:'req_invalid123'}))
  expect(out.body.url).toBeUndefined()
 })
 it('recusa resposta com link de outra conta',async()=>{
  const f=fixture();f.createLink.mockResolvedValue({...link,account:'acct_other'})
  const out=response();await handler(request,out)
  expect(out.statusCode).toBe(502)
  expect(console.error).toHaveBeenCalledWith('[Stripe Connect][Onboarding]',expect.objectContaining({code:'onboarding_account_mismatch'}))
 })
 it('não serializa segredos, headers, dados pessoais, URLs ou raw error',async()=>{
  const f=fixture()
  const privateText='Authorization: Bearer token; sk_test_secret; Maria Silva private@example.test https://connect.stripe.com/token'
  f.createLink.mockRejectedValue({...mismatch,message:privateText,headers:{authorization:privateText},raw:{details:privateText},request:privateText})
  const out=response();await handler(request,out)
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(privateText)
  expect(console.error).toHaveBeenCalledWith('[Stripe Connect][Onboarding]',expect.objectContaining({message:'[REDACTED]',request_id:mismatch.requestId}))
  expect(out.body).not.toHaveProperty('request_id')
 })
 it('falha do logger não altera a resposta pública',async()=>{
  const f=fixture();f.createLink.mockRejectedValue(mismatch)
  vi.mocked(console.error).mockImplementation(()=>{throw new Error('logger unavailable')})
  const out=response();await handler(request,out)
  expect(out).toMatchObject({statusCode:500,body:{code:'ONBOARDING_LINK_FAILED'}})
 })
 it.each([
  [{type:'StripeAuthenticationError',statusCode:401},500],
  [{type:'StripePermissionError',statusCode:403},500],
  [{type:'StripeInvalidRequestError',code:'accounts_v2_access_blocked',statusCode:400},500],
  [{type:'StripeInvalidRequestError',code:'not_found',statusCode:404},409],
  [{type:'StripeRateLimitError',statusCode:429},503],
  [{type:'RateLimitError',statusCode:429},503],
  [{type:'StripeAPIError',statusCode:500},502],
  [{type:'StripeConnectionError',message:'Request aborted due to timeout being reached (5000ms)'},504],
  [{type:'StripeConnectionError',message:'An error occurred with our connection to Stripe.'},502],
  [new Error('Unexpected local error'),500]
 ])('classifica a falha do link sem expor o erro original: %#',async(failure,status)=>{
  const f=fixture();f.createLink.mockRejectedValue({...failure,requestId:'req_failure123'})
  const out=response();await handler(request,out)
  expect(out).toMatchObject({statusCode:status,body:{success:false,code:'ONBOARDING_LINK_FAILED'}})
  expect(out.body).not.toHaveProperty('request_id');expect(out.body).not.toHaveProperty('type')
  expect(console.error).toHaveBeenCalledWith('[Stripe Connect][Onboarding]',expect.objectContaining({
   operation:'onboarding.create_account_link',stage:'create_account_link',connection_exists:true,
   onboarding_action:'resume_existing_account',account_creation:false,response_status:status,request_id:'req_failure123',diagnostic_id:expect.any(String)
  }))
  expect(console.error).toHaveBeenCalledWith('[Stripe Connect][Onboarding]',expect.objectContaining({stage:'create_account_link',stripe_http_status:'statusCode' in failure?failure.statusCode:null}))
 })
 it('isola a chave ausente na etapa de configuração Stripe',async()=>{
  const f=fixture();mocks.stripe.mockImplementationOnce(()=>{throw Object.assign(new Error('missing'),{code:'STRIPE_NOT_CONFIGURED'})})
  const out=response();await handler(request,out)
  expect(out.statusCode).toBe(500);expect(f.createLink).not.toHaveBeenCalled()
  expect(console.error).toHaveBeenCalledWith('[Stripe Connect][Onboarding]',expect.objectContaining({stage:'stripe_configuration',connection_exists:true,code:'STRIPE_NOT_CONFIGURED',response_status:500}))
 })
 it('registra ausência de configuração Supabase sem supor existência de conta',async()=>{
  fixture();vi.stubEnv('SUPABASE_URL','');vi.stubEnv('VITE_SUPABASE_URL','')
  const out=response();await handler(request,out)
  expect(out.statusCode).toBe(500)
  expect(console.error).toHaveBeenCalledWith('[Stripe Connect][Onboarding]',expect.objectContaining({stage:'database_configuration',connection_exists:null,response_status:500}))
 })
 it('indisponibilidade da autenticação não é tratada como sessão expirada',async()=>{
  const f=fixture();f.database.auth.getUser.mockResolvedValue({data:{user:null},error:{status:503}} as any)
  const out=response();await handler(request,out)
  expect(out).toMatchObject({statusCode:503,body:{code:'AUTH_UNAVAILABLE'}})
  expect(f.createLink).not.toHaveBeenCalled()
 })
 it('erro temporário Supabase mantém 503 e etapa de consulta',async()=>{
  const f=fixture();f.maybeSingle.mockResolvedValue({data:null,error:{code:'08006',message:'private database details'}})
  const out=response();await handler(request,out)
  expect(out.statusCode).toBe(503)
  expect(console.error).toHaveBeenCalledWith('[Stripe Connect][Onboarding]',expect.objectContaining({stage:'find_connection',connection_exists:null,response_status:503}))
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private database details')
 })
 it('identifica fallback para Production em Preview e ignora configuração de taxa',async()=>{
  fixture();vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('STRIPE_SECRET_KEY','sk_test_fixture')
  vi.stubEnv('APP_URL','');vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL','production.example');vi.stubEnv('VERCEL_URL','preview.example')
  vi.stubEnv('STRIPE_PLATFORM_FEE_BPS','invalid')
  const out=response();await handler(request,out)
  expect(out.statusCode).toBe(200)
  expect(console.info).toHaveBeenCalledWith('[Stripe Connect][Onboarding context]',expect.objectContaining({vercel_environment:'preview',app_url_source:'VERCEL_PROJECT_PRODUCTION_URL',stripe_key_mode:'test',return_url:'https://production.example/app/financeiro/stripe/return'}))
 })
})
