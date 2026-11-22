import {describe,expect,it} from 'vitest'
import type {FinancialTransaction} from '../lib/dashboardFinance'
import {bpsToPercent,percentToBps,reserveFor,summarizeTaxReserve,taxReportCsv} from '../features/finance/taxService'

const sale=(over:Partial<FinancialTransaction>):FinancialTransaction=>({transactionId:'t1',buyerName:'Ana',productName:'Curso',paymentMethod:'card',status:'approved',amountCents:10000,feeCents:250,currency:'BRL',occurredAt:'2026-11-20T12:00:00Z',...over})

describe('Reserva de imposto',()=>{
 it('converte porcentagem digitada em pontos-base',()=>{
  expect(percentToBps('6')).toBe(600)
  expect(percentToBps('6,5')).toBe(650)
  expect(percentToBps('15.75%')).toBe(1575)
  expect(percentToBps('0')).toBe(0)
  expect(percentToBps('100')).toBe(10000)
  expect(percentToBps('100,01')).toBeNull()
  expect(percentToBps('-1')).toBeNull()
  expect(percentToBps('abc')).toBeNull()
  expect(percentToBps('6,555')).toBeNull()
  expect(bpsToPercent(650)).toBe('6,5')
 })
 it('calcula a reserva sobre o valor bruto e arredonda ao centavo',()=>{
  expect(reserveFor(10000,600)).toBe(600)
  expect(reserveFor(999,650)).toBe(65)
  expect(reserveFor(-500,600)).toBe(0)
 })
 it('soma só vendas aprovadas em reais e desconta taxa e reserva do líquido',()=>{
  const summary=summarizeTaxReserve([
   sale({transactionId:'a',grossAmountCents:20000,amountCents:20000,feeCents:500,occurredAt:'2026-11-21T10:00:00Z'}),
   sale({transactionId:'b'}),
   sale({transactionId:'c',status:'refunded'}),
   sale({transactionId:'d',status:'pending'}),
   sale({transactionId:'e',currency:'USD'})
  ],600)
  expect(summary.count).toBe(2)
  expect(summary.grossCents).toBe(30000)
  expect(summary.feesCents).toBe(750)
  expect(summary.reserveCents).toBe(1800)
  expect(summary.netAfterTaxCents).toBe(30000-750-1800)
  expect(summary.rows[0].id).toBe('a')
 })
 it('gera o relatório para o contador com regime e porcentagem',()=>{
  const rows=taxReportCsv(summarizeTaxReserve([sale({})],600),{regime:'simples',reserveBps:600})
  expect(rows[0]).toMatchObject({produto:'Curso',valor_bruto:'100.00',taxa_sphexpay:'2.50',reserva_imposto:'6.00',liquido_apos_imposto:'91.50',regime:'Simples Nacional',porcentagem_reserva:'6'})
 })
})
