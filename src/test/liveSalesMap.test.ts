import { describe,expect,it } from 'vitest'
import { countryForTransaction,globalEventFromTransaction,regionTotals,relativeSaleTime,salesCountries } from '../lib/liveSalesMap'
import type { FinancialTransaction } from '../lib/dashboardFinance'

const transaction=(id:string):FinancialTransaction=>({transactionId:id,buyerName:'Cliente',productName:'Produto',paymentMethod:'Cartão de crédito',status:'approved',amountCents:19700,feeCents:700,currency:'BRL',occurredAt:'2026-07-28T12:00:00.000Z'})

describe('mapa de vendas ao vivo',()=>{
 it('associa cada transação ao mesmo destino geográfico',()=>{
  expect(countryForTransaction(transaction('sale-42'))).toEqual(countryForTransaction(transaction('sale-42')))
  expect(salesCountries.every(country=>Number.isFinite(country.coordinates[0])&&Number.isFinite(country.coordinates[1]))).toBe(true)
 })
 it('prioriza América do Norte e Europa na distribuição global',()=>{
  const destinations=Array.from({length:200},(_,index)=>countryForTransaction(transaction(`sale-${index}`)))
  expect(destinations.filter(country=>country.region==='América do Norte'||country.region==='Europa').length).toBeGreaterThan(120)
 })
 it('gera atividade, regiões e horário relativo sem alterar a transação',()=>{
  const source=transaction('sale-event'),event=globalEventFromTransaction(source),totals=regionTotals([event])
  expect(event.transaction).toBe(source)
  expect(event.activity).toBeTruthy()
  expect(totals.reduce((sum,item)=>sum+item.total,0)).toBe(1)
  expect(relativeSaleTime('2026-07-28T12:00:00.000Z',new Date('2026-07-28T12:00:08.000Z').getTime())).toBe('há 8s')
 })
})
