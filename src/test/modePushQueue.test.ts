import {afterEach,describe,expect,it,vi} from 'vitest'
import {defaultModePushConfig} from '../demo/demoSimulationEngine'
import type {DemoTransaction} from '../demo/types'
import {ModePushQueue} from '../lib/modePushQueue'

const sale=(id:string,status:DemoTransaction['status']='approved',createdAt='2026-07-30T15:00:01.000Z'):DemoTransaction=>({
 transactionId:id,demo:true,source:'mode',eventId:`event-${id}`,productId:null,productName:'Produto interno',productPriceCents:10000,
 buyerName:'Cliente',customerDisplayName:'Cliente',customerEmail:'safe@example.com',customerId:'customer',countryCode:'BR',countryName:'Brasil',cityName:'São Paulo',
 paymentMethod:'Pix',status,amountCents:10000,grossAmountCents:10000,discountCents:0,feeCents:100,netAmountCents:9900,commissionCents:6000,currency:'BRL',
 occurredAt:createdAt,createdAt,approvedAt:status==='approved'?createdAt:undefined,updatedAt:createdAt
})
const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve()}

afterEach(()=>vi.useRealTimers())
describe('ModePushQueue',()=>{
 it('gera exatamente um Push por venda aprovada e reutiliza a chave idempotente',async()=>{
  const send=vi.fn().mockResolvedValue({ok:true,sent:2,failed:0,expired:0}),queue=new ModePushQueue({send})
  const config={...defaultModePushConfig(),enabledAt:'2026-07-30T15:00:00.000Z'}
  expect(queue.enqueue('session-1',sale('1'),config)).toBe(true)
  expect(queue.enqueue('session-1',sale('1'),config)).toBe(false)
  await flush()
  expect(send).toHaveBeenCalledTimes(1)
  expect(send.mock.calls[0][0]).toMatchObject({eventId:'mode-sale:session-1:event-1',target:'all',notificationType:'pix_paid'})
  expect(send.mock.calls[0][0].body).not.toContain('Produto interno')
  expect(queue.snapshot()).toMatchObject({attempted:1,sent:2,skipped:1})
 })
 it('ignora pending, evento antigo e evento restaurado sem interromper o modo',async()=>{
  const send=vi.fn(),queue=new ModePushQueue({send}),config={...defaultModePushConfig(),enabledAt:'2026-07-30T15:00:02.000Z'}
  queue.markKnown('session',[sale('restored','pending')])
  expect(queue.enqueue('session',sale('pending','pending'),config)).toBe(false)
  expect(queue.enqueue('session',sale('old','approved','2026-07-30T15:00:01.000Z'),config)).toBe(false)
  expect(queue.enqueue('session',sale('restored'),{...config,enabledAt:'2026-07-30T14:00:00.000Z'})).toBe(false)
  expect(queue.enqueue('session',sale('old','approved','2026-07-30T15:00:01.000Z'),config)).toBe(false)
  await flush();expect(send).not.toHaveBeenCalled()
 })
 it('pausa, continua somente eventos novos e encerra descartando a fila pendente',async()=>{
  let resolveFirst:(value:{ok:boolean;sent:number})=>void=()=>undefined
  const send=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{resolveFirst=resolve})).mockResolvedValue({ok:true,sent:1})
  const queue=new ModePushQueue({send}),config={...defaultModePushConfig(),enabledAt:'2026-07-30T15:00:00.000Z'}
  queue.enqueue('session',sale('1'),config);queue.pause()
  expect(queue.enqueue('session',sale('2'),config)).toBe(false)
  resolveFirst({ok:true,sent:1});await flush();queue.resume()
  expect(queue.enqueue('session',sale('3'),config)).toBe(true);await flush()
  queue.stop();expect(queue.enqueue('session',sale('4'),config)).toBe(false)
  expect(send.mock.calls.map(call=>call[0].eventId)).toEqual(['mode-sale:session:event-1','mode-sale:session:event-3'])
 })
 it('limita concorrência a dois e falha de Push não bloqueia eventos seguintes',async()=>{
  let active=0,max=0
  const resolvers:Array<()=>void>=[],send=vi.fn().mockImplementation(()=>new Promise(resolve=>{active++;max=Math.max(max,active);resolvers.push(()=>{active--;resolve({ok:false,failed:1,message:'falha isolada'})})}))
  const queue=new ModePushQueue({send}),config={...defaultModePushConfig(),enabledAt:'2026-07-30T15:00:00.000Z'}
  for(let index=1;index<=4;index++)queue.enqueue('session',sale(String(index)),config)
  expect(send).toHaveBeenCalledTimes(2);expect(max).toBe(2)
  resolvers.shift()?.();resolvers.shift()?.();await flush()
  expect(send).toHaveBeenCalledTimes(4)
  resolvers.shift()?.();resolvers.shift()?.();await flush()
  expect(queue.snapshot()).toMatchObject({attempted:4,failed:4})
 })
 it('aplica frequência somente ao Push, seleciona dispositivos e mantém vendas fora da fila',async()=>{
  let now=1_000
  const send=vi.fn().mockResolvedValue({ok:true,sent:1}),queue=new ModePushQueue({send,now:()=>now})
  const config={...defaultModePushConfig(),enabledAt:'2026-07-30T15:00:00.000Z',frequency:'5s' as const,destination:'selected' as const,deviceIds:['11111111-1111-4111-8111-111111111111']}
  queue.enqueue('session',sale('1'),config);await flush();now=3_000
  expect(queue.enqueue('session',sale('2'),config)).toBe(false);now=6_001
  expect(queue.enqueue('session',sale('3'),config)).toBe(true);await flush()
  expect(send).toHaveBeenCalledTimes(2)
  expect(send.mock.calls[0][0]).toMatchObject({target:'devices',deviceIds:config.deviceIds})
 })
 it('agrupa resumo usando a mesma fila e um único timer',async()=>{
  vi.useFakeTimers()
  const send=vi.fn().mockResolvedValue({ok:true,sent:1}),queue=new ModePushQueue({send})
  const config={...defaultModePushConfig(),enabledAt:'2026-07-30T15:00:00.000Z',frequency:'summary' as const}
  queue.enqueue('session',sale('1'),config);queue.enqueue('session',sale('2'),config)
  expect(vi.getTimerCount()).toBe(1)
  await vi.advanceTimersByTimeAsync(15_000);await flush()
  expect(send).toHaveBeenCalledTimes(1)
  expect(send.mock.calls[0][0]).toMatchObject({title:'2 vendas aprovadas',body:'Total do período: R$ 200,00'})
 })
})
