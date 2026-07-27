import { describe,expect,it,vi } from 'vitest'
// @ts-expect-error API serverless JavaScript fora do bundle TypeScript.
import { processPaymentEvent,validatePaymentEvent } from '../../api/payments/process-payment-event.js'

const event=(patch:Record<string,unknown>={})=>({
 provider:'official-provider',eventId:'evt-1',externalTransactionId:'pay-1',
 eventType:'payment_approved',status:'approved',
 productId:'11111111-1111-4111-8111-111111111111',
 sellerId:'22222222-2222-4222-8222-222222222222',
 currency:'BRL',paymentMethod:'pix',occurredAt:'2026-07-26T20:00:00Z',
 amounts:{grossCents:19700,discountCents:0,finalCents:19700,feeCents:700,commissionCents:19000},
 customer:{displayName:'João da Silva'},...patch
})

describe('processamento oficial de pagamentos',()=>{
 it('preserva valores inteiros em centavos e aceita produto real identificado',()=>{
  expect(validatePaymentEvent(event()).amounts).toEqual({
   grossCents:19700,discountCents:0,finalCents:19700,feeCents:700,commissionCents:19000
  })
 })
 it('rejeita preço final incompatível com o desconto',()=>{
  expect(()=>validatePaymentEvent(event({amounts:{grossCents:19700,discountCents:1000,finalCents:19700,feeCents:0,commissionCents:0}}))).toThrow('INVALID_PAYMENT_EVENT')
 })
 it('não envia Push para evento duplicado',async()=>{
  const client={rpc:vi.fn().mockResolvedValue({data:{duplicate:true,transactionId:'tx'},error:null}),from:vi.fn()}
  const result=await processPaymentEvent({client,input:event(),pushClient:{sendNotification:vi.fn()}})
  expect(result.duplicate).toBe(true)
  expect(client.from).not.toHaveBeenCalled()
 })
 it('falha de Push não cancela a venda persistida',async()=>{
  const update={eq:vi.fn().mockResolvedValue({error:null})}
  const client={
   rpc:vi.fn().mockResolvedValue({data:{duplicate:false,publicTransactionId:'provider:pay-1',productName:'Produto real',outboxEventType:'sale_approved'},error:null}),
   from:vi.fn((table:string)=>{
    if(table==='push_subscriptions')return{select:()=>({eq:()=>({eq:()=>Promise.resolve({data:[],error:null})})})}
    return{update:vi.fn(()=>update)}
   })
  }
  const result=await processPaymentEvent({client,input:event()})
  expect(result.publicTransactionId).toBe('provider:pay-1')
  expect(result.push?.success).toBe(false)
  expect(client.rpc).toHaveBeenCalledOnce()
 })
})
