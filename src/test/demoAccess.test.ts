import {describe,expect,it} from 'vitest'
import {canAccessDemo,DEMO_EMAIL_ALLOWLIST,isDemoEmailAllowed,normalizeDemoEmail} from '../lib/demoAccess'

describe('acesso ao modo demo',()=>{
 it.each([
  'gruporyzon@gmail.com',
  '  GRUPORYZON@GMAIL.COM  ',
  '\tGrupoRyzon@Gmail.com\n',
  'ironaldydriguez@gmail.com',
  ' IronaldyDriguez@Gmail.com ',
 ])('autoriza e-mail normalizado: %s',email=>expect(isDemoEmailAllowed(email)).toBe(true))

 it.each(['usuario@producao.com','gruporyzon+outro@gmail.com','ironaldydriguez+x@gmail.com','kaysilva15@icloud.com','',undefined,null])('mantém fora da allowlist: %s',email=>expect(isDemoEmailAllowed(email)).toBe(false))

 it('normaliza com trim e lowercase sem ampliar a lista',()=>{
  expect(normalizeDemoEmail('  User@Example.COM ')).toBe('user@example.com')
  expect([...DEMO_EMAIL_ALLOWLIST]).toEqual(['gruporyzon@gmail.com','ironaldydriguez@gmail.com'])
 })

 it('o cargo de administrador não libera sem o e-mail autorizado',()=>{
  expect(canAccessDemo('usuario@producao.com')).toBe(false)
  expect(canAccessDemo('gruporyzon@gmail.com')).toBe(true)
 })
})
