import { act,renderHook,waitFor } from '@testing-library/react'
import { afterEach,describe,expect,it,vi } from 'vitest'
import { useLiveSales } from '../hooks/useLiveSales'
import { dashboardService } from '../services/dashboardService'
import type { FinancialTransaction } from '../lib/dashboardFinance'

describe('vendas reais via Realtime',()=>{
 afterEach(()=>vi.restoreAllMocks())
 it('adiciona venda persistida do próprio usuário e deduplica',async()=>{
  vi.spyOn(dashboardService,'loadTransactions').mockResolvedValue([])
  let receive:(transaction:FinancialTransaction)=>void=()=>undefined
  vi.spyOn(dashboardService,'subscribe').mockImplementation((_user,onTransaction,onStatus)=>{receive=onTransaction;onStatus('live');return{unsubscribe:vi.fn(async()=>undefined)} as never})
  const {result}=renderHook(()=>useLiveSales('user-1',{preset:'today'}))
  await waitFor(()=>expect(result.current.loading).toBe(false))
  const transaction:FinancialTransaction={transactionId:'real-1',ownerId:'user-1',buyerName:'Ana Costa',productName:'Produto',paymentMethod:'Pix',status:'approved',amountCents:10000,feeCents:100,currency:'BRL',occurredAt:new Date().toISOString()}
  act(()=>{receive(transaction);receive(transaction)})
  expect(result.current.sales).toEqual([transaction])
 })
 it('ignora evento de outro usuário',async()=>{
  vi.spyOn(dashboardService,'loadTransactions').mockResolvedValue([])
  let receive:(transaction:FinancialTransaction)=>void=()=>undefined
  vi.spyOn(dashboardService,'subscribe').mockImplementation((_user,onTransaction)=>{receive=onTransaction;return{unsubscribe:vi.fn(async()=>undefined)} as never})
  const {result}=renderHook(()=>useLiveSales('user-1',{preset:'today'}))
  await waitFor(()=>expect(result.current.loading).toBe(false))
  act(()=>receive({transactionId:'foreign',ownerId:'user-2',buyerName:null,productName:'Produto',paymentMethod:'Pix',status:'approved',amountCents:100,feeCents:0,currency:'BRL',occurredAt:new Date().toISOString()}))
  expect(result.current.sales).toHaveLength(0)
 })
})
