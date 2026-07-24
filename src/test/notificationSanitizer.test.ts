import {describe,expect,it} from 'vitest'
import {sanitizeNotificationBody} from '../lib/notificationSanitizer'

describe('sanitizeNotificationBody',()=>{
 it.each([
  ['from SphexPay\nSua comissão: R$ 17,65','Sua comissão: R$ 17,65'],
  ['From SphexPay — Sua comissão: US$ 6.45','Sua comissão: US$ 6.45'],
  ['enviado por SphexPay\nSua comissão: € 15,71','Sua comissão: € 15,71'],
 ])('remove somente o prefixo de marca legado', (value,expected)=>expect(sanitizeNotificationBody(value)).toBe(expected))
 it('preserva textos válidos e trata valores desconhecidos',()=>{
  expect(sanitizeNotificationBody('Sua comissão: R$ 13,52')).toBe('Sua comissão: R$ 13,52')
  expect(sanitizeNotificationBody('Relatório from SphexPay validado')).toBe('Relatório from SphexPay validado')
  expect(sanitizeNotificationBody(null)).toBe('')
 })
})
