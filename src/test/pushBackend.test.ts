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
// @ts-expect-error As rotas serverless são JavaScript e não fazem parte do bundle do frontend.
import devicesHandler from '../../api/push/devices.js'

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
  expect(output.result).toMatchObject({statusCode:401,body:{registered:false,code:'AUTH_REQUIRED'}})
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

 it('aceita payload manual seguro e limita a busca aos dispositivos do usuário',async()=>{
  configureVapid()
  vi.stubEnv('SUPABASE_URL','https://project.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','server-only-key')
  const query={eq:vi.fn(()=>query),in:vi.fn(()=>query),then:(resolve:(value:unknown)=>void)=>resolve({data:[],error:null})}
  const client={auth:{getUser:vi.fn(async()=>({data:{user:{id:'user-1'}}}))},from:vi.fn(()=>({select:vi.fn(()=>query)}))}
  createClientMock.mockReturnValue(client)
  const output=response()
  await sendHandler({method:'POST',headers:{authorization:'Bearer token'},body:{eventId:'manual-11111111-1111-4111-8111-111111111111',type:'manual_notification',notificationType:'sale_approved',title:'Venda aprovada!',body:'Plano • R$ 10,00',route:'/app/transacoes',icon:'/icons/sphexpay-app-192.png',targetDeviceIds:['22222222-2222-4222-8222-222222222222'],metadata:{currency:'BRL'}}},output)
  expect(output.result).toMatchObject({statusCode:404,body:{success:false,code:'NO_ACTIVE_SUBSCRIPTIONS'}})
  expect(query.eq).toHaveBeenCalledWith('user_id','user-1')
  expect(query.in).toHaveBeenCalledWith('device_id',['22222222-2222-4222-8222-222222222222'])
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
  const deviceId='22222222-2222-4222-8222-222222222222'
  const maybeSingle=vi.fn()
   .mockResolvedValueOnce({data:null,error:null})
   .mockResolvedValueOnce({data:{id:'11111111-1111-4111-8111-111111111111',device_id:deviceId,device_name:'Chrome no macOS',automatic_name:'Chrome no macOS',browser:'Chrome',operating_system:'macOS',enabled:true,user_id:'user-1',last_seen_at:'2026-07-27T12:00:00Z'},error:null})
  const query={eq:vi.fn(()=>query),maybeSingle}
  const select=vi.fn(()=>query)
  const upsert=vi.fn(async()=>({error:null}))
  const client={auth:{getUser:vi.fn(async()=>({data:{user:{id:'user-1'}}}))},from:vi.fn(()=>({upsert,select}))}
  createClientMock.mockReturnValue(client)
  const output=response()
  const p256dh=Buffer.from(Uint8Array.from({length:65},(_,index)=>index===0?4:index)).toString('base64url')
  const auth=Buffer.from(Uint8Array.from({length:16},(_,index)=>index+1)).toString('base64url')
  await subscribeHandler({method:'POST',headers:{authorization:'Bearer token'},body:{deviceId,subscription:{endpoint:'https://push.example/device',expirationTime:null,keys:{p256dh,auth}},automaticName:'Chrome no macOS',browser:'Chrome',operatingSystem:'macOS',platform:'desktop',displayMode:'browser',locale:'pt-BR',timezone:'America/Sao_Paulo'}},output)
  expect(output.result.statusCode).toBe(200)
  expect(client.from).toHaveBeenCalledWith('push_subscriptions')
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({user_id:'user-1',device_id:deviceId,endpoint_hash:expect.any(String),enabled:true}),{onConflict:'user_id,device_id'})
  expect(output.result.body).toMatchObject({registered:true,device:{deviceId,name:'Chrome no macOS',enabled:true}})
 })

 it('lista somente dispositivos do usuário e identifica o atual',async()=>{
  vi.stubEnv('SUPABASE_URL','https://project.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','server-only-key')
  const deviceId='22222222-2222-4222-8222-222222222222'
  const order=vi.fn(async()=>({data:[{id:'11111111-1111-4111-8111-111111111111',device_id:deviceId,device_name:'MacBook do Ronaldy',browser:'Chrome',operating_system:'macOS',platform:'desktop',display_mode:'browser',enabled:true,last_seen_at:new Date().toISOString(),last_success_at:null,last_error:null,failure_count:0}],error:null}))
  const query={eq:vi.fn(()=>({order})),order}
  const client={auth:{getUser:vi.fn(async()=>({data:{user:{id:'user-1'}},error:null}))},from:vi.fn(()=>({select:vi.fn(()=>query)}))}
  createClientMock.mockReturnValue(client)
  const output=response()
  await devicesHandler({method:'GET',headers:{authorization:'Bearer token'},query:{currentDeviceId:deviceId}},output)
  expect(output.result).toMatchObject({statusCode:200,body:{success:true,devices:[{deviceId,name:'MacBook do Ronaldy',isCurrentDevice:true,status:'Conectado'}]}})
  expect(query.eq).toHaveBeenCalledWith('user_id','user-1')
 })

 it('permite renomear somente dispositivo pertencente ao usuário',async()=>{
  vi.stubEnv('SUPABASE_URL','https://project.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','server-only-key')
  const maybeSingle=vi.fn(async()=>({data:{id:'11111111-1111-4111-8111-111111111111',device_id:'22222222-2222-4222-8222-222222222222'},error:null}))
  const ownerQuery={eq:vi.fn(()=>ownerQuery),maybeSingle}
  const updateQuery={eq:vi.fn(()=>updateQuery),then:(resolve:(value:unknown)=>void)=>resolve({error:null})}
  const client={auth:{getUser:vi.fn(async()=>({data:{user:{id:'user-1'}},error:null}))},from:vi.fn(()=>({select:vi.fn(()=>ownerQuery),update:vi.fn(()=>updateQuery)}))}
  createClientMock.mockReturnValue(client)
  const output=response()
  await devicesHandler({method:'PATCH',headers:{authorization:'Bearer token'},query:{id:'11111111-1111-4111-8111-111111111111'},body:{deviceName:'MacBook do Ronaldy'}},output)
  expect(output.result).toMatchObject({statusCode:200,body:{success:true}})
 })

 it.each([['PATCH',{enabled:false}],['DELETE',undefined]])('%s desativa dispositivo pertencente ao usuário',async(method,body)=>{
  vi.stubEnv('SUPABASE_URL','https://project.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','server-only-key')
  const maybeSingle=vi.fn(async()=>({data:{id:'11111111-1111-4111-8111-111111111111',device_id:'22222222-2222-4222-8222-222222222222'},error:null}))
  const ownerQuery={eq:vi.fn(()=>ownerQuery),maybeSingle},updateQuery={eq:vi.fn(()=>updateQuery),then:(resolve:(value:unknown)=>void)=>resolve({error:null})}
  const update=vi.fn(()=>updateQuery),client={auth:{getUser:vi.fn(async()=>({data:{user:{id:'user-1'}},error:null}))},from:vi.fn(()=>({select:vi.fn(()=>ownerQuery),update}))}
  createClientMock.mockReturnValue(client)
  const output=response()
  await devicesHandler({method,headers:{authorization:'Bearer token'},query:{id:'11111111-1111-4111-8111-111111111111'},body},output)
  expect(output.result).toMatchObject({statusCode:200,body:{success:true}})
  expect(update).toHaveBeenCalledWith(expect.objectContaining({enabled:false}))
 })

 it('não permite acessar dispositivo de outra conta',async()=>{
  vi.stubEnv('SUPABASE_URL','https://project.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','server-only-key')
  const ownerQuery={eq:vi.fn(()=>ownerQuery),maybeSingle:vi.fn(async()=>({data:null,error:null}))}
  const client={auth:{getUser:vi.fn(async()=>({data:{user:{id:'user-1'}},error:null}))},from:vi.fn(()=>({select:vi.fn(()=>ownerQuery)}))}
  createClientMock.mockReturnValue(client)
  const output=response()
  await devicesHandler({method:'DELETE',headers:{authorization:'Bearer token'},query:{id:'11111111-1111-4111-8111-111111111111'}},output)
  expect(output.result).toMatchObject({statusCode:404,body:{code:'DEVICE_NOT_FOUND'}})
 })
})
