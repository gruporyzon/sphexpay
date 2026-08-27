import {describe,expect,it} from 'vitest'
import {canAccessDemo,DEMO_EMAIL_ALLOWLIST,isDemoEmailAllowed,normalizeDemoEmail} from '../lib/demoAccess'

describe('acesso ao modo demo',()=>{
 it.each([
  'ironaldydriguez@gmail.com',
  'kaysilva15@icloud.com',
  '  IRONALDYDRIGUEZ@GMAIL.COM  ',
  '\tKAYSILVA15@ICLOUD.COM\n',
 ])('autoriza e-mail normalizado: %s',email=>expect(isDemoEmailAllowed(email)).toBe(true))

 it.each(['usuario@producao.com','ironaldydriguez+outro@gmail.com','',undefined,null])('mantém fora da allowlist: %s',email=>expect(isDemoEmailAllowed(email)).toBe(false))

 it('normaliza com trim e lowercase sem ampliar a lista',()=>{
  expect(normalizeDemoEmail('  User@Example.COM ')).toBe('user@example.com')
  expect([...DEMO_EMAIL_ALLOWLIST]).toEqual(['ironaldydriguez@gmail.com','kaysilva15@icloud.com'])
 })

 it('preserva o acesso já concedido a administradores sem promover usuários demo',()=>{
  expect(canAccessDemo('usuario@producao.com',true)).toBe(true)
  expect(canAccessDemo('usuario@producao.com',false)).toBe(false)
  expect(canAccessDemo('ironaldydriguez@gmail.com',false)).toBe(true)
 })
})
