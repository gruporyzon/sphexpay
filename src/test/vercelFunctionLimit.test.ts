import {readdirSync,statSync} from 'node:fs'
import {join,relative,sep} from 'node:path'
import {describe,expect,it} from 'vitest'

const functionFiles=(directory:string):string[]=>readdirSync(directory).flatMap(name=>{
 const path=join(directory,name)
 return statSync(path).isDirectory()?functionFiles(path):/\.(?:js|ts)$/.test(name)?[path]:[]
})
const asPosix=(path:string)=>relative(process.cwd(),path).split(sep).join('/')

describe('limite de funções da Vercel Hobby',()=>{
 it('mantém no máximo 12 handlers públicos dentro de api',()=>{
  const files=functionFiles(join(process.cwd(),'api')).map(asPosix)
  expect(files).toEqual(expect.arrayContaining([
   'api/stripe/connect/account.js',
   'api/stripe/connect/onboarding.js',
   'api/stripe/connect/status.js'
  ]))
  expect(files.length).toBeLessThanOrEqual(12)
 })

 it('mantém serviços reutilizáveis fora da pasta de funções',()=>{
  const internal=functionFiles(join(process.cwd(),'server'))
  expect(internal.map(asPosix)).toEqual(expect.arrayContaining([
   'server/notifications/generation-service.js',
   'server/payments/process-payment-event.js',
   'server/push/config.js',
   'server/push/financial-events.js',
   'server/push/send-service.js'
  ]))
 })
})
