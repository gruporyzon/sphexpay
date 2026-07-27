import { afterEach,describe,expect,it,vi } from 'vitest'
import { createECDH } from 'node:crypto'
const {createClientMock}=vi.hoisted(()=>({createClientMock:vi.fn()}))
vi.mock('@supabase/supabase-js',()=>({createClient:createClientMock}))
// @ts-expect-error As rotas serverless são JavaScript e não fazem parte do bundle do frontend.
import healthHandler from '../../api/push/health.js'
// @ts-expect-error As rotas serverless são JavaScript e não fazem parte do bundle do frontend.
import { pushConfiguration } from '../../api/push/config.js'
// @ts-expect-error As rotas serverless são JavaScript e não fazem parte do bundle do frontend.
import sendHandler from '../../api/push/send.js'
// @ts-expect-error As rotas serverless são JavaScript e não fazem parte do bundle do frontend.
import subscribeHandler from '../../api/push/subscribe.js'

type ApiResult={statusCode:number;body:unknown}

function response(){
 const result:ApiResult={statusCode:200,body:null}
 return{
  result,
  status(code:number){result.statusCode=code;return this},
  json(body:unknown){result.body=body;return this}
 }
}

describe('backend de Push',()=>{
 afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks()})

 const configureVapid=()=>{
  const privateBytes=Buffer.from(Uint8Array.from({length:32},(_,index)=>index+1))
  const ecdh=createECDH('prime256v1')
  ecdh.setPrivateKey(privateBytes)
  const publicKey=ecdh.getPublicKey().toString('base64url')
  vi.stubEnv('VAPID_PUBLIC_KEY',publicKey)
  vi.stubEnv('VAPID_PRIVATE_KEY',privateBytes.toString('base64url'))
  vi.stubEnv('VAPID_SUBJECT','mailto:suporte@sphexpay.com')
 }

 it('valida publicKey P-256 de 65 bytes e privateKey de 32 bytes',()=>{
  configureVapid()
  expect(pushConfiguration().vapidConfigured).toBe(true)
  vi.stubEnv('VAPID_PRIVATE_KEY','invalid')
  expect(pushConfiguration().vapidConfigured).toBe(false)
 })

 it('não depende da variável VITE pública no ambiente server-side',()=>{
  configureVapid()
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY',Buffer.from(Uint8Array.from({length:65},(_,index)=>index===0?4:255-index)).toString('base64url'))
  expect(pushConfiguration().vapidConfigured).toBe(true)
  expect(pushConfiguration().vapid.checks.keyPairValid).toBe(true)
 })

 it('normaliza padding e espaços das chaves VAPID sem alterar o par',()=>{
  configureVapid()
  vi.stubEnv('VAPID_PUBLIC_KEY',`${process.env.VAPID_PUBLIC_KEY}=\n`)
  vi.stubEnv('VAPID_PRIVATE_KEY',` ${process.env.VAPID_PRIVATE_KEY}`)
  expect(pushConfiguration().vapidConfigured).toBe(true)
 })

 it('informa separadamente VAPID, armazenamento e envio sem depender de subscription',async()=>{
  configureVapid()
  const output=response()
  await healthHandler({method:'GET'},output)
  expect(output.result).toMatchObject({statusCode:200,body:{success:true,vapidConfigured:true,storageConfigured:false,sendConfigured:false,checks:{vapidPublicKeyPresent:true,publicKeyLength65:true,publicKeyFirstByte04:true,privateKeyPresent:true,keyPairValid:true,subjectValid:true},codes:['SUPABASE_SERVER_CREDENTIALS_MISSING','PUSH_SEND_NOT_CONFIGURED']}})
  vi.stubEnv('SUPABASE_URL','https://project.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','server-only-key')
  const tableQuery={select:vi.fn(()=>tableQuery),limit:vi.fn(async()=>({error:null}))}
  createClientMock.mockReturnValue({from:vi.fn(()=>tableQuery)})
  const configuredOutput=response()
  await healthHandler({method:'GET'},configuredOutput)
  expect(configuredOutput.result).toMatchObject({statusCode:200,body:{success:true,vapidConfigured:true,storageConfigured:true,sendConfigured:true,checks:{supabaseUrlPresent:true,serviceRolePresent:true,subscriptionsTableAccessible:true,deliveryLogTableAccessible:true},codes:[]}})
 })

 it('bloqueia métodos não permitidos nas rotas de cadastro e envio',async()=>{
  const subscriptionOutput=response(),sendOutput=response()
  await subscribeHandler({method:'PATCH'},subscriptionOutput)
  await sendHandler({method:'GET'},sendOutput)
  expect(subscriptionOutput.result.statusCode).toBe(405)
  expect(sendOutput.result.statusCode).toBe(405)
 })

 it('exige autenticação para cadastrar dispositivo',async()=>{
  vi.stubEnv('SUPABASE_URL','https://project.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','server-only-key')
  const output=response()
  await subscribeHandler({method:'POST',headers:{},body:{}},output)
  expect(output.result).toMatchObject({statusCode:401,body:{registered:false,code:'SESSION_MISSING'}})
 })

 it('retorna 400 para subscription com chaves inválidas',async()=>{
  vi.stubEnv('SUPABASE_URL','https://project.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','server-only-key')
  const client={auth:{getUser:vi.fn(async()=>({data:{user:{id:'user-1'}},error:null}))}}
  createClientMock.mockReturnValue(client)
  const output=response()
  await subscribeHandler({method:'POST',headers:{authorization:'Bearer token'},body:{endpoint:'https://push.example/device',keys:{p256dh:'invalid',auth:'invalid'}}},output)
  expect(output.result).toMatchObject({statusCode:400,body:{registered:false,code:'INVALID_SUBSCRIPTION'}})
 })

 it('não inicia envio real sem configuração VAPID e armazenamento',async()=>{
  const output=response()
  await sendHandler({method:'POST'},output)
  expect(output.result).toEqual({statusCode:503,body:{success:false,code:'VAPID_NOT_CONFIGURED',message:'O envio Push não está configurado.'}})
 })

 it('informa credenciais server-side ausentes sem usar chave publicável',async()=>{
  configureVapid()
  vi.stubEnv('VITE_SUPABASE_URL','https://project.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY','public-client-key')
  const output=response()
  await sendHandler({method:'POST'},output)
  expect(output.result.body).toEqual({success:false,code:'SUPABASE_SERVER_CREDENTIALS_MISSING',message:'O armazenamento server-side não está configurado.'})
 })

 it('ignora SUPABASE_URL inválida e usa a URL pública válida como fallback seguro',()=>{
  configureVapid()
  vi.stubEnv('SUPABASE_URL','valor-invalido')
  vi.stubEnv('VITE_SUPABASE_URL','https://project.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','server-only-key')
  expect(pushConfiguration()).toMatchObject({storageConfigured:true,sendConfigured:true})
 })

 it('registra e confirma no Supabase com upsert por usuário e endpoint',async()=>{
  vi.stubEnv('SUPABASE_URL','https://project.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','server-only-key')
  const maybeSingle=vi.fn(async()=>({data:{id:'device-1',enabled:true,user_id:'user-1'},error:null}))
  const eqEnabled=vi.fn(()=>({maybeSingle}))
  const eqEndpoint=vi.fn(()=>({eq:eqEnabled}))
  const eqUser=vi.fn(()=>({eq:eqEndpoint}))
  const select=vi.fn(()=>({eq:eqUser}))
  const upsert=vi.fn(async()=>({error:null}))
  const client={auth:{getUser:vi.fn(async()=>({data:{user:{id:'user-1'}}}))},from:vi.fn(()=>({upsert,select}))}
  createClientMock.mockReturnValue(client)
  const output=response()
  const p256dh=Buffer.from(Uint8Array.from({length:65},(_,index)=>index===0?4:index)).toString('base64url')
  const auth=Buffer.from(Uint8Array.from({length:16},(_,index)=>index+1)).toString('base64url')
  await subscribeHandler({method:'POST',headers:{authorization:'Bearer token'},body:{endpoint:'https://push.example/device',expirationTime:null,keys:{p256dh,auth},deviceName:'MacBook'}},output)
  expect(output.result.statusCode).toBe(200)
  expect(client.from).toHaveBeenCalledWith('push_subscriptions')
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({user_id:'user-1',endpoint:'https://push.example/device',enabled:true}),{onConflict:'user_id,endpoint'})
  expect(output.result.body).toEqual({registered:true,active:true,deviceId:'device-1'})
 })
})
