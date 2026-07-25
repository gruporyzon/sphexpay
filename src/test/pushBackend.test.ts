import { afterEach,describe,expect,it,vi } from 'vitest'
// @ts-expect-error As rotas serverless são JavaScript e não fazem parte do bundle do frontend.
import healthHandler from '../../api/push/health.js'
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
 afterEach(()=>vi.unstubAllEnvs())

 it('informa separadamente a configuração VAPID e do armazenamento',()=>{
  vi.stubEnv('VAPID_PUBLIC_KEY','public')
  vi.stubEnv('VAPID_PRIVATE_KEY','private')
  vi.stubEnv('VAPID_SUBJECT','mailto:push@sphexpay.com')
  const output=response()
  healthHandler({method:'GET'},output)
  expect(output.result).toEqual({statusCode:200,body:{success:true,configured:false,vapidConfigured:true,storageConfigured:false}})
 })

 it('bloqueia métodos não permitidos nas rotas de cadastro e envio',async()=>{
  const subscriptionOutput=response(),sendOutput=response()
  await subscribeHandler({method:'PATCH'},subscriptionOutput)
  await sendHandler({method:'GET'},sendOutput)
  expect(subscriptionOutput.result.statusCode).toBe(405)
  expect(sendOutput.result.statusCode).toBe(405)
 })

 it('não inicia envio real sem configuração VAPID e armazenamento',async()=>{
  const output=response()
  await sendHandler({method:'POST'},output)
  expect(output.result).toEqual({statusCode:503,body:{success:false,code:'VAPID_NOT_CONFIGURED',message:'O servidor de notificações ainda não foi configurado.'}})
 })
})
