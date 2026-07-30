import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {ManualNotificationScheduler,type ManualSequenceSnapshot} from '../lib/manualNotificationScheduler'

const flush=async()=>{await Promise.resolve();await Promise.resolve()}

describe('scheduler manual de Push',()=>{
 beforeEach(()=>vi.useFakeTimers())
 afterEach(()=>vi.useRealTimers())

 function setup(plannedCount=3,intervalMs=5000){
  const calls:Array<{index:number;eventId:string;at:number}>=[]
  const snapshots:ManualSequenceSnapshot[]=[]
  const scheduler=new ManualNotificationScheduler({
   sequenceId:'sequence-test',plannedCount,intervalMs,
   attempt:vi.fn(async(index,eventId)=>{calls.push({index,eventId,at:Date.now()});return{deviceDeliveries:2,deviceFailures:0,expiredDevices:0}}),
   onChange:snapshot=>snapshots.push(snapshot)
  })
  return{scheduler,calls,snapshots}
 }

 it('envia imediatamente, em ordem, no intervalo e sem exceder a quantidade',async()=>{
  const {scheduler,calls}=setup(5)
  scheduler.start();await flush()
  expect(calls).toEqual([{index:0,eventId:'sequence-test:1',at:Date.now()}])
  expect(scheduler.getSnapshot()).toMatchObject({attemptedCount:1,notificationSuccessCount:1,deviceDeliveryCount:2,remainingCount:4})
  await vi.advanceTimersByTimeAsync(4999);expect(calls).toHaveLength(1)
  await vi.advanceTimersByTimeAsync(1);expect(calls.map(call=>call.index)).toEqual([0,1])
  await vi.advanceTimersByTimeAsync(5000);expect(calls.map(call=>call.index)).toEqual([0,1,2])
  await vi.advanceTimersByTimeAsync(10000);expect(calls.map(call=>call.index)).toEqual([0,1,2,3,4])
  await vi.advanceTimersByTimeAsync(20000);expect(calls).toHaveLength(5)
  expect(scheduler.getSnapshot()).toMatchObject({status:'completed',attemptedCount:5,notificationSuccessCount:5,deviceDeliveryCount:10,remainingCount:0})
 })

 it('mantém somente um envio pendente e uma chave idempotente por índice',async()=>{
  const {scheduler,calls}=setup(2)
  scheduler.start();scheduler.start();await flush()
  expect(calls.map(call=>call.eventId)).toEqual(['sequence-test:1'])
  await vi.advanceTimersByTimeAsync(5000)
  expect(calls.map(call=>call.eventId)).toEqual(['sequence-test:1','sequence-test:2'])
 })

 it('pausa preservando o atraso restante e continua sem repetir',async()=>{
  const {scheduler,calls}=setup()
  scheduler.start();await flush()
  await vi.advanceTimersByTimeAsync(2000);scheduler.pause()
  await vi.advanceTimersByTimeAsync(20000);expect(calls).toHaveLength(1)
  scheduler.resume()
  await vi.advanceTimersByTimeAsync(2999);expect(calls).toHaveLength(1)
  await vi.advanceTimersByTimeAsync(1);expect(calls.map(call=>call.index)).toEqual([0,1])
 })

 it('cancela e limpa o próximo envio',async()=>{
  const {scheduler,calls}=setup(5)
  scheduler.start();await flush();scheduler.cancel()
  await vi.advanceTimersByTimeAsync(30000)
  expect(calls).toHaveLength(1)
  expect(scheduler.getSnapshot()).toMatchObject({status:'cancelled',attemptedCount:1})
 })

 it('registra falha e encerra somente depois da resposta da última tentativa',async()=>{
  let finish:((value:{deviceDeliveries:number;deviceFailures:number;expiredDevices:number})=>void)|undefined
  const scheduler=new ManualNotificationScheduler({
   sequenceId:'sequence-wait',plannedCount:1,intervalMs:1000,
   attempt:()=>new Promise(resolve=>{finish=resolve}),
   onChange:()=>undefined
  })
  scheduler.start();await flush()
  expect(scheduler.getSnapshot()).toMatchObject({status:'running',attemptedCount:0})
  finish?.({deviceDeliveries:0,deviceFailures:1,expiredDevices:0});await flush()
  expect(scheduler.getSnapshot()).toMatchObject({status:'completed',attemptedCount:1,notificationFailureCount:1,deviceFailureCount:1})
 })

 it('interrompe no cleanup e não deixa timer órfão',async()=>{
  const {scheduler,calls}=setup()
  scheduler.start();await flush();scheduler.interrupt('route_changed')
  await vi.advanceTimersByTimeAsync(10000)
  expect(calls).toHaveLength(1)
  expect(scheduler.getSnapshot()).toMatchObject({status:'interrupted',interruptionReason:'route_changed'})
 })

 it('continua após falha parcial em um dispositivo',async()=>{
  const calls:number[]=[]
  const scheduler=new ManualNotificationScheduler({
   sequenceId:'sequence-partial',plannedCount:2,intervalMs:5000,
   attempt:vi.fn(async index=>{calls.push(index);return{deviceDeliveries:1,deviceFailures:1,expiredDevices:0}}),
   onChange:()=>undefined
  })
  scheduler.start();await flush()
  expect(scheduler.getSnapshot()).toMatchObject({status:'running',attemptedCount:1,notificationSuccessCount:1,deviceDeliveryCount:1,deviceFailureCount:1})
  await vi.advanceTimersByTimeAsync(5000)
  expect(calls).toEqual([0,1])
  expect(scheduler.getSnapshot()).toMatchObject({status:'completed',attemptedCount:2,notificationSuccessCount:2})
 })

 it('tolera clique duplo em Pausar, Continuar e Cancelar',async()=>{
  const {scheduler,calls}=setup(5)
  scheduler.start();await flush()
  scheduler.pause();scheduler.pause()
  expect(scheduler.getSnapshot().status).toBe('paused')
  scheduler.resume();scheduler.resume()
  expect(vi.getTimerCount()).toBe(1)
  scheduler.cancel();scheduler.cancel()
  await vi.advanceTimersByTimeAsync(30000)
  expect(calls).toHaveLength(1)
  expect(scheduler.getSnapshot().status).toBe('cancelled')
 })

 it('mantém o mesmo eventId quando a camada de envio faz retry',async()=>{
  const eventIds:string[]=[]
  const scheduler=new ManualNotificationScheduler({
   sequenceId:'sequence-retry',plannedCount:1,intervalMs:5000,
   attempt:vi.fn(async(_index,eventId)=>{
    eventIds.push(eventId,eventId)
    return{deviceDeliveries:1,deviceFailures:0,expiredDevices:0}
   }),
   onChange:()=>undefined
  })
  scheduler.start();await flush()
  expect(eventIds).toEqual(['sequence-retry:1','sequence-retry:1'])
  expect(scheduler.getSnapshot().attemptedCount).toBe(1)
 })

 it('respeita Retry-After uma vez com o mesmo índice e sem loop',async()=>{
  const eventIds:string[]=[]
  const attempt=vi.fn(async(_index:number,eventId:string)=>{
   eventIds.push(eventId)
   return eventIds.length===1
    ?{deviceDeliveries:0,deviceFailures:1,expiredDevices:0,retryAfterMs:7000}
    :{deviceDeliveries:2,deviceFailures:0,expiredDevices:0}
  })
  const scheduler=new ManualNotificationScheduler({sequenceId:'sequence-rate',plannedCount:1,intervalMs:5000,attempt,onChange:()=>undefined})
  scheduler.start();await flush()
  expect(scheduler.getSnapshot()).toMatchObject({status:'running',attemptedCount:0})
  await vi.advanceTimersByTimeAsync(6999);expect(attempt).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(eventIds).toEqual(['sequence-rate:1','sequence-rate:1'])
  expect(scheduler.getSnapshot()).toMatchObject({status:'completed',attemptedCount:1,deviceDeliveryCount:2})
 })
})
