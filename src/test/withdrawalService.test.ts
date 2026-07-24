import { beforeEach,describe,expect,it } from 'vitest'
import { INITIAL_BALANCE_IN_CENTS,WITHDRAWAL_ACCOUNT_KEY,WITHDRAWAL_BALANCE_KEY,WITHDRAWALS_KEY,withdrawalAmountToMinor,withdrawalMoney,withdrawalService } from '../services/withdrawalService'

describe('valores monetários de saque',()=>{
 beforeEach(()=>localStorage.clear())

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

 it('inicializa e mantém os dados locais esperados',()=>{
  const first=withdrawalService.load()
  expect(first.availableBalanceInCents).toBe(INITIAL_BALANCE_IN_CENTS)
  expect(first.account).toMatchObject({name:'Conta cadastrada',bankName:'Conta principal',agency:'0001',accountNumber:'84821-0',lastDigits:'4821'})
  expect(localStorage.getItem(WITHDRAWAL_BALANCE_KEY)).toBe(String(INITIAL_BALANCE_IN_CENTS))
  expect(localStorage.getItem(WITHDRAWAL_ACCOUNT_KEY)).toContain('"lastDigits":"4821"')
  expect(localStorage.getItem(WITHDRAWALS_KEY)).toBe('[]')
 })

 it('desconta valores inteiros, persiste o histórico e rejeita saldo insuficiente',()=>{
  const account=withdrawalService.load().account
  const result=withdrawalService.request(50000,account.id)
  expect(result.availableBalanceInCents).toBe(INITIAL_BALANCE_IN_CENTS-50000)
  expect(withdrawalService.load().withdrawals[0]).toMatchObject({amountInCents:50000,status:'completed',destinationLastDigits:'4821'})
  expect(()=>withdrawalService.request(INITIAL_BALANCE_IN_CENTS,account.id)).toThrow('Saldo insuficiente para realizar este saque.')
 })
})
