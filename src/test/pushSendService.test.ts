import { describe,expect,it,vi } from 'vitest'
// @ts-expect-error API serverless JavaScript fora do bundle TypeScript.
import { sendPushToUser } from '../../api/push/send-service.js'
// @ts-expect-error API serverless JavaScript fora do bundle TypeScript.
import { formatMoney,notifyConfirmedFinancialEvent } from '../../api/push/financial-events.js'

type Subscription={id:string;endpoint:string;p256dh:string;auth:string}

function fakeClient(subscriptions:Subscription[],duplicateIds:string[]=[]){
 const logs:{subscriptionId:string;eventId:string;status:string;httpStatus?:number|null;errorCode?:string|null}[]=[]
 const enabled=new Map(subscriptions.map(item=>[item.id,true]))
 const from=vi.fn((table:string)=>{
  if(table==='push_subscriptions'){
   const query={
    select:()=>query,eq:()=>query,
    update:(values:Record<string,unknown>)=>({eq:(_field:string,id:string)=>{if(values.enabled===false)enabled.set(id,false);return Promise.resolve({error:null})}}),
    then:(resolve:(value:unknown)=>void)=>resolve({data:subscriptions,error:null})
   }
   return query
  }
  const query={
   insert:async(record:Record<string,string>)=>{
    if(duplicateIds.includes(record.subscription_id))return{error:{code:'23505'}}
    logs.push({subscriptionId:record.subscription_id,eventId:record.event_id,status:record.status})
    return{error:null}
   },
   update:(values:Record<string,unknown>)=>({
    eq:()=>({eq:(_field:string,eventId:string)=>{
     const log=logs.find(item=>item.eventId===eventId&&item.status==='sending')
     if(log){log.status=String(values.status);log.httpStatus=values.http_status as number|null;log.errorCode=values.error_code as string|null}
     return Promise.resolve({error:null})
    }})
   })
  }
  return query
 })
 return{client:{from},logs,enabled}
}

const subscription=(id:string):Subscription=>({id,endpoint:`https://push.example/${id}`,p256dh:`p256dh-${id}`,auth:`auth-${id}`})
const input=(client:unknown)=>({client,userId:'user-1',eventId:'event-1',type:'sale_approved',title:'Venda aprovada!',body:'Sua comissão: R$ 17,65',route:'/app/vendas'})

describe('sendPushToUser',()=>{
 it('retorna NO_ACTIVE_SUBSCRIPTIONS sem dispositivo',async()=>{
  const {client}=fakeClient([])
  expect(await sendPushToUser({...input(client),pushClient:{sendNotification:vi.fn()}})).toMatchObject({success:false,code:'NO_ACTIVE_SUBSCRIPTIONS',sent:0})
 })

 it('envia para um ou vários dispositivos e registra a entrega',async()=>{
  const {client,logs}=fakeClient([subscription('one'),subscription('two')])
  const sendNotification=vi.fn(async()=>({statusCode:201}))
  const result=await sendPushToUser({...input(client),pushClient:{sendNotification}})
  expect(result).toMatchObject({success:true,sent:2,failed:0,duplicates:0})
  expect(sendNotification).toHaveBeenCalledTimes(2)
  expect(logs.every(log=>log.status==='delivered'&&log.httpStatus===201)).toBe(true)
 })

 it('tolera falha parcial sem cancelar entregas aceitas',async()=>{
  const {client}=fakeClient([subscription('one'),subscription('two')])
  const sendNotification=vi.fn()
   .mockResolvedValueOnce({statusCode:201})
   .mockRejectedValueOnce(Object.assign(new Error('temporary'),{statusCode:503}))
  expect(await sendPushToUser({...input(client),pushClient:{sendNotification}})).toMatchObject({success:true,sent:1,failed:1,duplicates:0})
 })

 it.each([404,410])('desativa subscription expirada em resposta %s e retorna código técnico',async statusCode=>{
  const {client,enabled}=fakeClient([subscription('expired')])
  const error=Object.assign(new Error('gone'),{statusCode})
  const result=await sendPushToUser({...input(client),pushClient:{sendNotification:vi.fn(async()=>{throw error})}})
  expect(result).toMatchObject({success:false,code:'SUBSCRIPTION_EXPIRED',failed:1})
  expect(enabled.get('expired')).toBe(false)
 })

 it('envia o teste de infraestrutura com tag estável e eventId único',async()=>{
  const {client}=fakeClient([subscription('one')])
  const sendNotification=vi.fn(async(_subscription:unknown,payload:string)=>{
   expect(JSON.parse(payload)).toMatchObject({type:'infrastructure_test',eventId:'infrastructure-test-unique',tag:'sphexpay-infrastructure-test',title:'SphexPay conectada',body:'As notificações deste dispositivo estão funcionando.',route:'/app/configuracoes'})
   return{statusCode:201}
  })
  const result=await sendPushToUser({client,userId:'user-1',eventId:'infrastructure-test-unique',type:'infrastructure_test',tag:'sphexpay-infrastructure-test',title:'SphexPay conectada',body:'As notificações deste dispositivo estão funcionando.',route:'/app/configuracoes',pushClient:{sendNotification}})
  expect(result).toMatchObject({success:true,sent:1,failed:0})
 })

 it('deduplica por eventId e subscriptionId',async()=>{
  const {client}=fakeClient([subscription('one')],['one'])
  const sendNotification=vi.fn()
  expect(await sendPushToUser({...input(client),pushClient:{sendNotification}})).toMatchObject({success:true,sent:0,failed:0,duplicates:1})
  expect(sendNotification).not.toHaveBeenCalled()
 })
})

describe('eventos financeiros confirmados no servidor',()=>{
 it('formata BRL, USD e EUR e envia venda confirmada',async()=>{
  expect(formatMoney(1765,'BRL')).toContain('17,65')
  expect(formatMoney(1765,'USD')).toContain('17.65')
  expect(formatMoney(1765,'EUR')).toContain('17,65')
  const {client}=fakeClient([subscription('one')])
  const sendNotification=vi.fn(async(_subscription:unknown,payload:string)=>{
   expect(JSON.parse(payload)).toMatchObject({type:'sale_approved',title:'Venda aprovada!',body:expect.stringContaining('17,65')})
   return{statusCode:201}
  })
  const result=await notifyConfirmedFinancialEvent({client,userId:'user-1',eventId:'sale-1',type:'sale_approved',currency:'BRL',commissionMinor:1765,pushClient:{sendNotification}})
  expect(result.success).toBe(true)
 })
})
