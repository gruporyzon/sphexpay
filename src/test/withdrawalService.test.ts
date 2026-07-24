import { describe,expect,it } from 'vitest'
import { withdrawalAmountToMinor,withdrawalMoney } from '../services/withdrawalService'

describe('valores monetários de saque',()=>{
 it('converte entrada decimal para centavos inteiros',()=>{
  expect(withdrawalAmountToMinor('5.000,00')).toBe(500000)
  expect(withdrawalAmountToMinor('1000.25')).toBe(100025)
  expect(withdrawalAmountToMinor('0')).toBe(0)
  expect(Number.isNaN(withdrawalAmountToMinor('inválido'))).toBe(true)
 })

 it('formata BRL, USD e EUR sem conversão de moeda',()=>{
  expect(withdrawalMoney(500000,'BRL')).toBe('R$ 5.000,00')
  expect(withdrawalMoney(500000,'USD')).toBe('US$5,000.00')
  expect(withdrawalMoney(500000,'EUR')).toBe('€ 5.000,00')
 })
})
