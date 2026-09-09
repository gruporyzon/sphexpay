import {Readable} from 'node:stream'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({database:vi.fn(),stripe:vi.fn()}))
vi.mock('../../server/stripe/client.js',()=>({getStripe:mocks.stripe}))
vi.mock('../../server/stripe/connect.js',async importOriginal=>({...await importOriginal<object>(),serverDatabase:mocks.database}))
// @ts-expect-error Server-side JavaScript is excluded from frontend compilation.
import handler from '../../api/payments/webhook.js'
// @ts-expect-error Server-side JavaScript is excluded from frontend compilation.
import statusHandler from '../../api/stripe/connect/status.js'
// @ts-expect-error Server-side JavaScript is excluded from frontend compilation.
import * as payments from '../../server/stripe/payments.js'
const response=()=>({statusCode:200,body:null as any,setHeader:vi.fn(),status(code:number){this.statusCode=code;return this},json(body:any){this.body=body;return this}})
describe('roteamento HTTP Stripe',()=>{
 beforeEach(()=>{vi.stubEnv('STRIPE_WEBHOOK_SECRET','whsec_fixture');mocks.stripe.mockReturnValue({webhooks:{constructEvent:vi.fn(()=>{throw new Error('invalid')})}})})
 afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();vi.restoreAllMocks()})
 it.each(['/api/stripe/webhook','/api/payments/webhook?stripeAction=webhook'])('não permite fallback sem assinatura em %s',async url=>{
  const req=Object.assign(Readable.from(['{}']),{url,method:'POST',headers:{}}),res=response()
  await handler(req,res);expect(res.statusCode).toBe(400);expect(mocks.database).not.toHaveBeenCalled()
 })
 it('rota privada de configuração exige autenticação',async()=>{
  mocks.database.mockReturnValue({auth:{getUser:vi.fn()}})
  const res=response();await statusHandler({method:'POST',headers:{},body:{productId:'other',enabled:true}},res)
  expect(res.statusCode).toBe(401)
 })
 it('checkout público rejeita preço enviado pelo cliente sem consulta ao banco',async()=>{
  const database={from:vi.fn()};mocks.database.mockReturnValue(database)
  const res=response();await handler({url:'/api/stripe/checkout',method:'POST',headers:{},body:{amount:1}},res)
  expect(res.statusCode).toBe(400);expect(database.from).not.toHaveBeenCalled()
 })
 it('checkout rejeita UUID malformado antes de consultar tabelas',async()=>{
  const database={from:vi.fn()};mocks.database.mockReturnValue(database)
  const res=response();await handler({url:`/api/stripe/checkout?checkoutId=${'-'.repeat(36)}`,method:'GET',headers:{}},res)
  expect(res.statusCode).toBe(400);expect(database.from).not.toHaveBeenCalled()
 })
 it('checkout responde 400 para JSON malformado',async()=>{
  const database={from:vi.fn()};mocks.database.mockReturnValue(database)
  const res=response();await handler({url:'/api/stripe/checkout',method:'POST',headers:{},body:'{'},res)
  expect(res).toMatchObject({statusCode:400,body:{code:'INVALID_JSON'}});expect(database.from).not.toHaveBeenCalled()
 })
 it('checkout lê JSON do stream com bodyParser desativado pelo webhook compartilhado',async()=>{
  const input={checkoutId:'11111111-1111-4111-8111-111111111111',requestKey:'22222222-2222-4222-8222-222222222222',buyer:{name:'Synthetic Buyer',email:'synthetic@example.test'}}
  const create=vi.spyOn(payments,'createCheckout').mockResolvedValue({url:'https://checkout.stripe.com/fixture'})
  const database={from:vi.fn()};mocks.database.mockReturnValue(database)
  const request=Object.assign(Readable.from([JSON.stringify(input)]),{url:'/api/stripe/checkout',method:'POST',headers:{}})
  const res=response();await handler(request,res)
  expect(res).toMatchObject({statusCode:200,body:{url:'https://checkout.stripe.com/fixture'}})
  expect(create).toHaveBeenCalledWith(database,input)
 })
 it('checkout rejeita stream maior que o limite sem criar sessão',async()=>{
  const create=vi.spyOn(payments,'createCheckout'),database={from:vi.fn()};mocks.database.mockReturnValue(database)
  const request=Object.assign(Readable.from(['x'.repeat(1_000_001)]),{url:'/api/stripe/checkout',method:'POST',headers:{}})
  const res=response();await handler(request,res)
  expect(res).toMatchObject({statusCode:413,body:{code:'PAYLOAD_TOO_LARGE'}})
  expect(create).not.toHaveBeenCalled()
 })
 it('configuração autenticada responde 400 para JSON malformado',async()=>{
  const database={auth:{getUser:vi.fn(async()=>({data:{user:{id:'seller'}},error:null}))},from:vi.fn()};mocks.database.mockReturnValue(database)
  const res=response();await statusHandler({method:'POST',headers:{authorization:'Bearer synthetic'},body:'{'},res)
  expect(res).toMatchObject({statusCode:400,body:{code:'INVALID_JSON'}});expect(database.from).not.toHaveBeenCalled()
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control','no-store')
 })
})
