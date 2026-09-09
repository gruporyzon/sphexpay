import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({database:vi.fn(),stripe:vi.fn()}))
vi.mock('@supabase/supabase-js',()=>({createClient:mocks.database}))
vi.mock('../../server/stripe/client.js',async importOriginal=>({...await importOriginal<object>(),getStripe:mocks.stripe}))
// @ts-expect-error Backend JavaScript stays outside the frontend bundle.
import statusHandler from '../../api/stripe/connect/status.js'
// @ts-expect-error Backend JavaScript stays outside the frontend bundle.
import onboardingHandler from '../../api/stripe/connect/onboarding.js'
const owner='11111111-1111-4111-8111-111111111111'
const response=()=>({statusCode:0,body:null as any,setHeader:vi.fn(),status(code:number){this.statusCode=code;return this},json(body:any){this.body=body;return this}})
function fixture(modes:string[]){
 const rows=modes.map(mode=>({user_id:owner,stripe_mode:mode,stripe_account_id:`acct_${mode}`,stripe_account_type:'express'}))
 const database={auth:{getUser:vi.fn(async()=>({data:{user:{id:owner}},error:null}))},rpc:vi.fn(async(_name:string,args:any)=>({data:args.p_parameters,error:null})),from:vi.fn(()=>{
  const filters:((r:any)=>boolean)[]=[];let patch:any
  const selected=()=>rows.filter(row=>filters.every(f=>f(row)))
  const q:any={select:()=>q,eq:(key:string,value:any)=>{filters.push(row=>row[key]===value);return q},maybeSingle:async()=>({data:selected()[0]||null,error:null}),
   update:(value:any)=>{patch=value;return q},upsert:(value:any)=>{rows.push(value);filters.push(row=>row.stripe_mode===value.stripe_mode);return q},
   single:async()=>{const row=selected()[0];if(patch)Object.assign(row,patch);return{data:row,error:null}}}
  return q
 })}
 const mode=process.env.STRIPE_SECRET_KEY?.includes('_test_')?'test':'live'
 const retrieve=vi.fn(async(id:string)=>({id,details_submitted:true,charges_enabled:true,payouts_enabled:true}))
 const create=vi.fn(async()=>({id:`acct_${mode}`}))
 const link=vi.fn(async(input:any)=>({account:input.account,url:'https://connect.stripe.com/setup/fixture'}))
 mocks.database.mockReturnValue(database);mocks.stripe.mockReturnValue({accounts:{retrieve},v2:{core:{accounts:{create},accountLinks:{create:link}}}})
 return{rows,retrieve,create,link,database}
}
beforeEach(()=>{
 vi.stubEnv('SUPABASE_URL','https://project.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-service-key');vi.stubEnv('APP_URL','https://sphexpay.example')
 vi.spyOn(console,'info').mockImplementation(()=>{});vi.spyOn(console,'error').mockImplementation(()=>{})
})
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();vi.clearAllMocks()})
describe.each(['test','live'])('rotas Connect com backend %s',mode=>{
 const other=mode==='test'?'live':'test'
 const request={headers:{authorization:'Bearer synthetic-session'},query:{mode:other},body:{mode:other,accountId:`acct_${other}`}}
 beforeEach(()=>vi.stubEnv('STRIPE_SECRET_KEY',`sk_${mode}_fixture`))
 it('GET sem vínculo atual responde 200 e contrato completo sem retrieve do modo oposto',async()=>{
  const f=fixture([other]),out=response();await statusHandler({...request,method:'GET'},out)
  expect(out).toMatchObject({statusCode:200,body:{mode,connected:false,onboardingComplete:false,chargesEnabled:false,payoutsEnabled:false}})
  expect(f.retrieve).not.toHaveBeenCalled();expect(f.create).not.toHaveBeenCalled()
 })
 it('GET consulta somente modo backend mesmo com modo e ID forjados pelo cliente',async()=>{
  const f=fixture([other,mode]),out=response();await statusHandler({...request,method:'GET'},out)
  expect(out).toMatchObject({statusCode:200,body:{mode,connected:true,onboardingComplete:true,chargesEnabled:true,payoutsEnabled:true}})
  expect(f.retrieve).toHaveBeenCalledExactlyOnceWith(`acct_${mode}`)
 })
 it('POST onboarding cria somente modo atual e refresh reutiliza a mesma conta',async()=>{
  const f=fixture([other]);const previous=structuredClone(f.rows[0])
  for(let i=0;i<2;i++){
   const out=response();await onboardingHandler({...request,method:'POST'},out)
   expect(out).toMatchObject({statusCode:200,body:{url:'https://connect.stripe.com/setup/fixture'}})
  }
  expect(f.rows[0]).toEqual(previous);expect(f.rows).toHaveLength(2)
  expect(f.create).toHaveBeenCalledTimes(1);expect(f.link).toHaveBeenCalledTimes(2)
  for(const [input] of f.link.mock.calls)expect(input.account).toBe(`acct_${mode}`)
 })
 it('POST onboarding existente nunca utiliza o vínculo oposto',async()=>{
  const f=fixture([other,mode]),out=response();await onboardingHandler({...request,method:'POST'},out)
  expect(out.statusCode).toBe(200);expect(f.create).not.toHaveBeenCalled()
  expect(f.link).toHaveBeenCalledWith(expect.objectContaining({account:`acct_${mode}`}))
 })
})
it('Live com legado não cria conta e explica a classificação pendente',async()=>{
 vi.stubEnv('STRIPE_SECRET_KEY','sk_live_fixture');const f=fixture(['legacy'])
 f.database.rpc.mockResolvedValue({data:null,error:{message:'CONNECT_LEGACY_CLASSIFICATION_REQUIRED'}} as any)
 const out=response();await onboardingHandler({method:'POST',headers:{authorization:'Bearer synthetic-session'}},out)
 expect(out).toMatchObject({statusCode:409,body:{code:'CONNECT_LEGACY_CLASSIFICATION_REQUIRED'}})
 expect(f.create).not.toHaveBeenCalled();expect(f.link).not.toHaveBeenCalled()
})
