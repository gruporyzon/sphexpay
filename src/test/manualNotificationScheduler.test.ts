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
   attempt:vi.fn(async(index,eventId)=>{calls.push({index,eventId,at:Date.now()});return{sent:1,failed:0,expired:0}}),
   onChange:snapshot=>snapshots.push(snapshot)
  })
  return{scheduler,calls,snapshots}
 }

 it('envia imediatamente, em ordem, no intervalo e sem exceder a quantidade',async()=>{
  const {scheduler,calls}=setup()
  scheduler.start();await flush()
  expect(calls).toEqual([{index:0,eventId:'sequence-test-1',at:Date.now()}])
  await vi.advanceTimersByTimeAsync(4999);expect(calls).toHaveLength(1)
  await vi.advanceTimersByTimeAsync(1);expect(calls.map(call=>call.index)).toEqual([0,1])
  await vi.advanceTimersByTimeAsync(5000);expect(calls.map(call=>call.index)).toEqual([0,1,2])
  await vi.advanceTimersByTimeAsync(20000);expect(calls).toHaveLength(3)
  expect(scheduler.getSnapshot()).toMatchObject({status:'completed',attemptedCount:3,sentCount:3,remainingCount:0})
 })

 it('mantém somente um envio pendente e uma chave idempotente por índice',async()=>{
  const {scheduler,calls}=setup(2)
  scheduler.start();scheduler.start();await flush()
  expect(calls.map(call=>call.eventId)).toEqual(['sequence-test-1'])
  await vi.advanceTimersByTimeAsync(5000)
  expect(calls.map(call=>call.eventId)).toEqual(['sequence-test-1','sequence-test-2'])
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
  let finish:((value:{sent:number;failed:number;expired:number})=>void)|undefined
  const scheduler=new ManualNotificationScheduler({
   sequenceId:'sequence-wait',plannedCount:1,intervalMs:1000,
   attempt:()=>new Promise(resolve=>{finish=resolve}),
   onChange:()=>undefined
  })
  scheduler.start();await flush()
  expect(scheduler.getSnapshot()).toMatchObject({status:'running',attemptedCount:0})
  finish?.({sent:0,failed:1,expired:0});await flush()
  expect(scheduler.getSnapshot()).toMatchObject({status:'completed',attemptedCount:1,failedCount:1})
 })

 it('interrompe no cleanup e não deixa timer órfão',async()=>{
  const {scheduler,calls}=setup()
  scheduler.start();await flush();scheduler.interrupt()
  await vi.advanceTimersByTimeAsync(10000)
  expect(calls).toHaveLength(1)
  expect(scheduler.getSnapshot().status).toBe('interrupted')
 })
})
