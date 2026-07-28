import {readdirSync,statSync} from 'node:fs'
import {join} from 'node:path'
import {describe,expect,it} from 'vitest'

const functionFiles=(directory:string):string[]=>readdirSync(directory).flatMap(name=>{
 const path=join(directory,name)
 return statSync(path).isDirectory()?functionFiles(path):/\.(?:js|ts)$/.test(name)?[path]:[]
})

describe('limite de funções da Vercel Hobby',()=>{
 it('mantém no máximo 12 handlers públicos dentro de api',()=>{
  const files=functionFiles(join(process.cwd(),'api'))
  expect(files).toHaveLength(9)
  expect(files.length).toBeLessThanOrEqual(12)
 })

 it('mantém serviços reutilizáveis fora da pasta de funções',()=>{
  const internal=functionFiles(join(process.cwd(),'server'))
  expect(internal.map(path=>path.replace(`${process.cwd()}/`,''))).toEqual(expect.arrayContaining([
   'server/notifications/generation-service.js',
   'server/payments/process-payment-event.js',
   'server/push/config.js',
   'server/push/financial-events.js',
   'server/push/send-service.js'
  ]))
 })
})
