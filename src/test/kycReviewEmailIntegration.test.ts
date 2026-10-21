import {readFileSync} from 'node:fs'
import ts from 'typescript'
import {describe,it,expect,vi} from 'vitest'
import {kycEmail} from '../../supabase/functions/_shared/kycEmail'
const id='11111111-1111-4111-8111-111111111111'
function runtime(role:string|null='admin',queueFailure=false,job?:Record<string,unknown>){
 let handler:(request:Request)=>Promise<Response>=()=>Promise.reject(new Error('NOT_STARTED'))
 const pending:Promise<unknown>[]=[]
 const updates:unknown[]=[]
 const admin={
  auth:{admin:{getUserById:async()=>({data:{user:{email:'merchant@example.invalid'}}})}},
  from:vi.fn((table:string)=>({
   select:()=>({eq:()=>({maybeSingle:async()=>({data:{status:'approved',reviewed_at:'2026-10-21T10:00:00Z'}})})}),
   insert:vi.fn().mockResolvedValue({}),
   update:vi.fn((value:unknown)=>{updates.push({table,value});return {eq:()=>({select:()=>({maybeSingle:async()=>({data:{user_id:id,id,status:'approved',reviewed_at:'2026-10-21T10:00:00Z'}})})})}}),
  })),
  rpc:vi.fn().mockResolvedValue(queueFailure?{error:{code:'unavailable'}}:{data:job?[job]:[]}),
 }
 const client={auth:{getUser:async()=>({data:{user:role===null?null:{id,app_metadata:{role},user_metadata:{role:'admin'}}}})}}
 const code=ts.transpileModule(readFileSync('supabase/functions/kyc-review/index.ts','utf8').replace(/^import .*$/gm,''),{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText
 const send=vi.fn().mockResolvedValue({ok:true,retryable:false})
 const createClient=vi.fn((...args:unknown[])=>args[1]==='service-role'?admin:client)
 new Function('Deno','EdgeRuntime','createClient','kycEmail','sendEmail',code)({env:{get:(key:string)=>({SUPABASE_URL:'https://sphexpay-qa.invalid',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service-role',RESEND_API_KEY:'test-key'}[key])},serve:(value:typeof handler)=>{handler=value}},{waitUntil:(promise:Promise<unknown>)=>pending.push(promise)},createClient,kycEmail,send)
 return {invoke:(body:unknown)=>handler(new Request('https://sphexpay-qa.invalid/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})),pending,updates,admin,createClient,send}
}
describe('análise e envio de e-mail',()=>{
 it.each([[null,401],['user',403]] as const)('recusa %s antes de criar cliente privilegiado ou enviar',async(role,status)=>{
  const app=runtime(role)
  expect((await app.invoke({action:'dispatch_emails'})).status).toBe(status)
  expect(app.createClient).toHaveBeenCalledTimes(1)
  expect(app.pending).toHaveLength(0)
 })
 it.each(['document','profile'])('decisão %s é persistida antes do envio em segundo plano',async target=>{
  const app=runtime()
  const response=await app.invoke({action:'review',target,id,userId:id,decision:'approved'})
  expect(response.status).toBe(200)
  expect((await response.json()).emailDelivery).toEqual({status:'queued'})
  expect(app.updates).toContainEqual({table:target==='document'?'kyc_documents':'kyc_profiles',value:expect.objectContaining({status:'approved',reviewed_by:id})})
  expect(app.pending).toHaveLength(1)
  await Promise.all(app.pending)
 })
 it('falha da fila não reverte nem oculta uma análise salva',async()=>{
  const app=runtime('admin',true)
  const response=await app.invoke({action:'review',target:'profile',userId:id,decision:'approved'})
  await Promise.all(app.pending)
  expect(response.status).toBe(200)
  expect((await response.json()).profile.status).toBe('approved')
 })
 it('cliente não escolhe destinatário nem conteúdo na ação de reenvio',async()=>{
  const app=runtime()
  const response=await app.invoke({action:'dispatch_emails',to:'outsider@example.invalid',html:'arbitrary'})
  expect(response.status).toBe(200)
  expect(app.admin.rpc).toHaveBeenCalledWith('claim_kyc_emails',{p_limit:5})
 })
 it('worker envia só o destinatário obtido no Auth e marca o evento enviado',async()=>{
  const job={id:'event-id',user_id:id,target:'profile',target_id:id,decision:'approved',reviewed_at:'2026-10-21T10:00:00Z',attempts:1}
  const app=runtime('admin',false,job)
  await app.invoke({action:'dispatch_emails',to:'outsider@example.invalid'})
  expect(app.send).toHaveBeenCalledWith(expect.objectContaining({to:['merchant@example.invalid'],idempotencyKey:'kyc-review/event-id',subject:'Verificação aprovada — SphexPay'}))
  expect(app.updates).toContainEqual({table:'kyc_email_outbox',value:expect.objectContaining({status:'sent'})})
 })
 it('worker cancela um aviso superado sem enviar resultado antigo',async()=>{
  const app=runtime('admin',false,{id:'event-id',user_id:id,target:'profile',target_id:id,decision:'rejected',reviewed_at:'2026-10-21T09:00:00Z',attempts:1})
  await app.invoke({action:'dispatch_emails'})
  expect(app.send).not.toHaveBeenCalled()
  expect(app.updates).toContainEqual({table:'kyc_email_outbox',value:{status:'cancelled'}})
 })

})
