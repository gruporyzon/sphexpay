import { createHmac } from 'node:crypto'
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'

const {createClientMock,processPaymentEventMock}=vi.hoisted(()=>({
 createClientMock:vi.fn(),
 processPaymentEventMock:vi.fn()
}))
vi.mock('@supabase/supabase-js',()=>({createClient:createClientMock}))
vi.mock('../../server/payments/process-payment-event.js',()=>({processPaymentEvent:processPaymentEventMock}))
// @ts-expect-error rota serverless JavaScript fora do bundle TypeScript
import handler from '../../api/payments/webhook.js'

const SECRET='whsec_test_secret'
const body=JSON.stringify({provider:'partner',eventId:'evt-1',externalTransactionId:'pay-1',eventType:'payment_approved'})
const sign=(secret:string,timestamp:string,raw:string)=>`sha256=${createHmac('sha256',secret).update(`${timestamp}.${raw}`).digest('hex')}`

const response=()=>{const result={statusCode:200,body:null as unknown};return{result,status(code:number){result.statusCode=code;return this},json(payload:unknown){result.body=payload;return this}}}
const request=(overrides:Record<string,unknown>={})=>{
 const timestamp=String(Math.floor(Date.now()/1000))
 return{
  method:'POST',
  headers:{
   'x-sphexpay-timestamp':timestamp,
   'x-sphexpay-signature':sign(SECRET,timestamp,body),
   'x-forwarded-for':'203.0.113.10',
   'user-agent':'partner-webhook/1.0',
   ...(overrides.headers as Record<string,string>||{})
  },
  body:overrides.body!==undefined?overrides.body:body
 }
}

describe('segurança do webhook de pagamento',()=>{
 beforeEach(()=>{
  vi.stubEnv('PAYMENT_WEBHOOK_SECRET',SECRET)
  vi.stubEnv('SUPABASE_URL','https://project.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','service-role-key')
  const insert=vi.fn(async()=>({error:null}))
  createClientMock.mockReturnValue({from:vi.fn(()=>({insert})),rpc:vi.fn()})
  processPaymentEventMock.mockResolvedValue({duplicate:false,publicTransactionId:'partner:pay-1'})
 })
 afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks()})

 it('recusa métodos diferentes de POST',async()=>{
  const output=response()
  await handler({method:'GET',headers:{}},output)
  expect(output.result.statusCode).toBe(405)
 })

 it('responde 503 quando o segredo não está configurado',async()=>{
  vi.stubEnv('PAYMENT_WEBHOOK_SECRET','')
  const output=response()
  await handler(request(),output)
  expect(output.result).toMatchObject({statusCode:503,body:{code:'PAYMENT_WEBHOOK_NOT_CONFIGURED'}})
 })

 it('aceita assinatura válida e timestamp recente',async()=>{
  const output=response()
  await handler(request(),output)
  expect(output.result).toMatchObject({statusCode:200,body:{success:true,transactionId:'partner:pay-1'}})
  expect(processPaymentEventMock).toHaveBeenCalledOnce()
 })

 it('rejeita assinatura inválida',async()=>{
  const output=response()
  await handler(request({headers:{'x-sphexpay-signature':'sha256=deadbeef'}}),output)
  expect(output.result).toMatchObject({statusCode:401,body:{code:'INVALID_WEBHOOK_SIGNATURE'}})
  expect(processPaymentEventMock).not.toHaveBeenCalled()
 })

 it('rejeita timestamp fora da tolerância (replay)',async()=>{
  const old=String(Math.floor(Date.now()/1000)-3600)
  const output=response()
  await handler(request({headers:{'x-sphexpay-timestamp':old,'x-sphexpay-signature':sign(SECRET,old,body)}}),output)
  expect(output.result).toMatchObject({statusCode:401,body:{code:'STALE_WEBHOOK'}})
 })

 it('exige o header de timestamp',async()=>{
  const output=response()
  await handler(request({headers:{'x-sphexpay-timestamp':''}}),output)
  expect(output.result).toMatchObject({statusCode:400,body:{code:'MISSING_TIMESTAMP'}})
 })

 it('aceita assinatura feita com o segredo anterior durante a rotação',async()=>{
  vi.stubEnv('PAYMENT_WEBHOOK_SECRET','whsec_new_secret')
  vi.stubEnv('PAYMENT_WEBHOOK_SECRET_PREVIOUS',SECRET)
  const output=response()
  await handler(request(),output)
  expect(output.result.statusCode).toBe(200)
 })

 it('bloqueia origem fora da allowlist de IP quando configurada',async()=>{
  vi.stubEnv('PAYMENT_WEBHOOK_IP_ALLOWLIST','198.51.100.7')
  const output=response()
  await handler(request(),output)
  expect(output.result).toMatchObject({statusCode:403,body:{code:'IP_NOT_ALLOWED'}})
 })
})
