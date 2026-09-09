import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
// @ts-expect-error Backend JavaScript stays outside the frontend bundle.
import {findConnection,ensureConnectedAccount,retrieveAndSync,createOnboardingLink,safeStatus} from '../../server/stripe/connect.js'
// @ts-expect-error Backend JavaScript stays outside the frontend bundle.
import {getStripeMode,getStripe,resetStripeClient} from '../../server/stripe/client.js'
// @ts-expect-error Backend JavaScript stays outside the frontend bundle.
import {processStripeEvent} from '../../server/stripe/webhook.js'
const user={id:'owner',email:'owner@example.test'}
const row=(mode:string)=>({user_id:user.id,stripe_mode:mode,stripe_account_id:`acct_${mode}`,stripe_account_type:'express',stripe_details_submitted:false,stripe_charges_enabled:false,stripe_payouts_enabled:false,stripe_onboarding_status:'pending'})
function fixture(modes:string[]){
 const rows=modes.map(row)
 const database={rpc:vi.fn(async(_name:string,args:any)=>({data:args.p_parameters,error:null})),from:vi.fn(()=>{
  const filters:((r:any)=>boolean)[]=[];let patch:any
  const selected=()=>rows.filter(r=>filters.every(f=>f(r)))
  const q:any={select:()=>q,eq:(key:string,value:unknown)=>{filters.push(r=>r[key]===value);return q},
   maybeSingle:async()=>({data:selected()[0]||null,error:null}),
   upsert:vi.fn((record:any,options:any)=>{
    const keys=options.onConflict.split(',');const previous=rows.find((r:any)=>keys.every((k:string)=>r[k]===record[k]))
    if(previous)Object.assign(previous,record);else rows.push(record)
    filters.push(r=>keys.every((k:string)=>r[k]===record[k]));return q
   }),update:(record:any)=>{patch=record;return q},single:async()=>{const r=selected()[0];if(patch&&r)Object.assign(r,patch);return{data:r,error:null}}}
  return q
 })}
 const stripe={accounts:{retrieve:vi.fn(async(id:string)=>({id,type:'none',details_submitted:true,charges_enabled:true,payouts_enabled:true,metadata:{sphex_user_id:user.id}}))},v2:{core:{
  accounts:{create:vi.fn(async()=>({id:`acct_${getStripeMode()}`,object:'v2.core.account'}))},
  accountLinks:{create:vi.fn(async(input:any)=>({account:input.account,url:'https://connect.stripe.com/setup/fixture'}))}
 }}}
 return{rows,database,stripe}
}
beforeEach(()=>{vi.stubEnv('APP_URL','https://sphexpay.example');vi.spyOn(console,'info').mockImplementation(()=>{})})
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();resetStripeClient()})
describe.each(['test','live'])('isolamento Connect em %s',mode=>{
 const other=mode==='test'?'live':'test'
 beforeEach(()=>vi.stubEnv('STRIPE_SECRET_KEY',`sk_${mode}_fixture`))
 it('sem conta do modo, status não consulta a conta oposta',async()=>{
  const f=fixture([other]);const record=await findConnection(f.database,user.id)
  expect(record).toBeNull()
  expect(safeStatus(record)).toMatchObject({mode,connected:false,onboardingComplete:false,chargesEnabled:false,payoutsEnabled:false})
  expect(f.stripe.accounts.retrieve).not.toHaveBeenCalled()
 })
 it('criação preserva a conta e os flags do modo oposto',async()=>{
  const f=fixture([other]);const before=structuredClone(f.rows[0])
  const created=await ensureConnectedAccount(f.database,user,f.stripe)
  expect(created).toMatchObject(row(mode));expect(f.rows).toHaveLength(2);expect(f.rows[0]).toEqual(before)
  expect(f.database.rpc).toHaveBeenCalledWith('reserve_stripe_account_for_mode',expect.objectContaining({p_user_id:user.id,p_mode:mode}))
  await ensureConnectedAccount(f.database,user,f.stripe)
  expect(f.stripe.v2.core.accounts.create).toHaveBeenCalledTimes(1)
 })
 it('cria a primeira conta quando não há nenhum vínculo',async()=>{
  const f=fixture([]);expect(await ensureConnectedAccount(f.database,user,f.stripe)).toMatchObject(row(mode))
 })
 it('status sincroniza exclusivamente a conta do modo selecionado',async()=>{
  const f=fixture([other,mode]);const before=structuredClone(f.rows[0])
  const record=await findConnection(f.database,user.id)
  const result=await retrieveAndSync(f.database,user.id,record,f.stripe)
  expect(f.stripe.accounts.retrieve).toHaveBeenCalledExactlyOnceWith(`acct_${mode}`)
  expect(safeStatus(result)).toMatchObject({mode,connected:true,onboardingComplete:true,chargesEnabled:true,payoutsEnabled:true})
  expect(f.rows[0]).toEqual(before)
 })
 it('onboarding e retomada reutilizam exclusivamente o modo atual',async()=>{
  const f=fixture([other,mode])
  for(let i=0;i<2;i++)await createOnboardingLink(await ensureConnectedAccount(f.database,user,f.stripe),f.stripe)
  expect(f.stripe.v2.core.accounts.create).not.toHaveBeenCalled()
  expect(f.stripe.v2.core.accountLinks.create).toHaveBeenCalledTimes(2)
  for(const [input] of f.stripe.v2.core.accountLinks.create.mock.calls)expect(input.account).toBe(`acct_${mode}`)
 })
 it.each([other,'legacy',undefined])('recusa objeto %s antes de consultar Stripe ou gerar link',async suppliedMode=>{
  const f=fixture([]),record={...row('legacy'),stripe_mode:suppliedMode}
  await expect(retrieveAndSync(f.database,user.id,record,f.stripe)).rejects.toMatchObject({code:'CONNECT_MODE_MISMATCH'})
  await expect(createOnboardingLink(record,f.stripe)).rejects.toMatchObject({code:'CONNECT_MODE_MISMATCH'})
  expect(f.stripe.accounts.retrieve).not.toHaveBeenCalled();expect(f.stripe.v2.core.accountLinks.create).not.toHaveBeenCalled()
 })
 it('ignora webhook do modo oposto antes de consultar banco ou Stripe',async()=>{
  const f=fixture([other,mode])
  expect(await processStripeEvent(f.database,{livemode:mode!=='live',type:'account.updated'},f.stripe)).toEqual({ignored:true})
  expect(f.database.from).not.toHaveBeenCalled();expect(f.stripe.accounts.retrieve).not.toHaveBeenCalled()
 })
})
it('Test preserva legado desconhecido e cria vínculo independente',async()=>{
 vi.stubEnv('STRIPE_SECRET_KEY','sk_test_fixture');const f=fixture(['legacy']);const before=structuredClone(f.rows[0])
 expect(await findConnection(f.database,user.id)).toBeNull()
 await createOnboardingLink(await ensureConnectedAccount(f.database,user,f.stripe),f.stripe)
 expect(f.rows[0]).toEqual(before);expect(f.rows[1]).toMatchObject(row('test'))
})
it('idempotência separa Test e Live para o mesmo usuário',async()=>{
 const keys=[]
 for(const mode of ['test','live']){
  vi.stubEnv('STRIPE_SECRET_KEY',`sk_${mode}_fixture`);const f=fixture([])
  await ensureConnectedAccount(f.database,user,f.stripe)
  keys.push((f.stripe.v2.core.accounts.create.mock.calls as unknown as any[][])[0][1].idempotencyKey)
 }
 expect(keys[0]).not.toBe(keys[1])
})
it('troca de chave recria cliente e modo juntos, inclusive rotação no mesmo modo',()=>{
 vi.stubEnv('STRIPE_SECRET_KEY','sk_test_fixture');const test=getStripe();expect(getStripeMode()).toBe('test');expect(getStripe()).toBe(test)
 vi.stubEnv('STRIPE_SECRET_KEY','sk_live_fixture');const live=getStripe();expect(getStripeMode()).toBe('live');expect(live).not.toBe(test)
 vi.stubEnv('STRIPE_SECRET_KEY','sk_live_rotated');expect(getStripe()).not.toBe(live)
})
it.each(['','pk_test_fixture','rk_live_fixture','invalid','sk_test_'])('falha fechada para configuração inválida: %s',key=>{
 vi.stubEnv('STRIPE_SECRET_KEY',key);expect(()=>getStripeMode()).toThrow();expect(()=>getStripe()).toThrow()
})
