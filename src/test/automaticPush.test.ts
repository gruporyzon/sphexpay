import {afterEach,describe,expect,it,vi} from 'vitest'

const sendPushToUser=vi.fn(async()=>({success:true,sent:1}))
vi.mock('../../server/push/send-service.js',()=>({sendPushToUser:(...args:unknown[])=>sendPushToUser(...(args as []))}))
// @ts-expect-error Backend JavaScript stays outside the frontend bundle.
const {brasilia,handleAutomatic,isAutomaticRequest}=await import('../../server/push/automatic.js')

const sale={user_id:'seller-1',transaction_id:'stripe:acct:pi_1',provider:'stripe',status:'approved',amount_cents:19700,currency:'BRL'}
const fakeClient=({row=sale,targets=[] as unknown[],claimed=true,tokenOk=true}={})=>{
 const upserts:unknown[]=[]
 return{upserts,
  rpc:vi.fn(async(name:string)=>name==='sphex_notify_token_ok'?{data:tokenOk,error:null}:{data:targets,error:null}),
  from:(table:string)=>{
   const chain:Record<string,unknown>={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:table==='payment_transactions'?row:null,error:null}),
    upsert:(value:unknown)=>{upserts.push(value);return{select:async()=>({data:claimed?[value]:[],error:null})}}}
   return chain
  }}
}
afterEach(()=>sendPushToUser.mockClear())

describe('envio automático pedido pelo banco',()=>{
 it('só aceita o token interno conferido no banco',async()=>{
  const client=fakeClient()
  expect(await isAutomaticRequest(client,'curto')).toBe(false)
  expect(client.rpc).not.toHaveBeenCalled()
  expect(await isAutomaticRequest(client,'a'.repeat(64))).toBe(true)
  expect(await isAutomaticRequest(fakeClient({tokenOk:false}),'a'.repeat(64))).toBe(false)
 })
 it('venda aprovada sai só com o status e o valor da venda',async()=>{
  const result=await handleAutomatic(fakeClient(),{kind:'sale',transactionId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'})
  expect(result.status).toBe(200)
  expect(sendPushToUser).toHaveBeenCalledWith(expect.objectContaining({userId:'seller-1',eventId:'sale:stripe:acct:pi_1:approved',title:'Venda aprovada!',body:'Valor: R$\u00a0197,00',type:'sale_approved'}))
 })
 it('ignora venda recusada e identificador inválido',async()=>{
  expect((await handleAutomatic(fakeClient({row:{...sale,status:'declined'}}),{kind:'sale',transactionId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'})).body).toMatchObject({skipped:true})
  expect((await handleAutomatic(fakeClient(),{kind:'sale',transactionId:'x'})).status).toBe(400)
  expect(sendPushToUser).not.toHaveBeenCalled()
 })
 it('lembretes só nos horários de Brasília e uma vez por horário',async()=>{
  const targets=[{user_id:'seller-1',style:'professional',first_name:'Ana',revenue_cents:125000,sales:3}]
  // 15:00 UTC = 12h em Brasília.
  const noon=new Date('2026-10-22T15:00:00Z')
  expect(brasilia(noon)).toEqual({date:'2026-10-22',hour:12})
  const client=fakeClient({targets})
  const result=await handleAutomatic(client,{kind:'reminders'},{now:noon})
  expect(result.body).toMatchObject({success:true,hour:12,users:1,sent:1})
  expect(client.upserts).toEqual([{user_id:'seller-1',slot:'2026-10-22T12'}])
  expect(client.rpc).toHaveBeenCalledWith('revenue_reminder_targets',{p_hour:12,p_day:'2026-10-22'})
  expect(sendPushToUser).toHaveBeenCalledWith(expect.objectContaining({eventId:'reminder:2026-10-22T12',title:'Resumo do meio-dia',body:expect.stringContaining('R$\u00a01.250,00')}))
  sendPushToUser.mockClear()
  await handleAutomatic(fakeClient({targets,claimed:false}),{kind:'reminders'},{now:noon})
  expect(sendPushToUser).not.toHaveBeenCalled()
  expect((await handleAutomatic(fakeClient({targets}),{kind:'reminders'},{now:new Date('2026-10-22T13:00:00Z')})).body).toMatchObject({skipped:true,hour:10})
 })
 it('meia-noite fecha o dia anterior',async()=>{
  const client=fakeClient({targets:[]})
  await handleAutomatic(client,{kind:'reminders'},{now:new Date('2026-10-23T03:00:00Z')})
  expect(client.rpc).toHaveBeenCalledWith('revenue_reminder_targets',{p_hour:0,p_day:'2026-10-22'})
 })
})
