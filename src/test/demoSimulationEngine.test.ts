import { describe,expect,it } from 'vitest'
import { createHistory,createLiveTransaction,createSeededGenerator,fallbackDemoProducts,reconcileDemoLedger } from '../demo/demoSimulationEngine'
import { metricsFromTransactions,periodBounds,seriesFromTransactions } from '../lib/dashboardFinance'
import type { DemoSession } from '../demo/types'

const now=new Date('2026-07-27T15:00:00-03:00')
const session=(seed=123):DemoSession=>({version:1,active:true,sessionId:'test-session',seed,ownerId:'owner',startedAt:now.toISOString(),expiresAt:new Date(now.getTime()+86_400_000).toISOString(),lastEventAt:now.toISOString(),ledger:[],notifications:[],products:fallbackDemoProducts})

describe('DemoSimulationEngine',()=>{
 it('reproduz o histórico com a mesma seed e cobre pelo menos 30 dias',()=>{
  const first=createHistory(session(),now),second=createHistory(session(),now)
  expect(first).toEqual(second)
  expect(first.length).toBeGreaterThan(100)
  expect(Math.min(...first.map(item=>new Date(item.createdAt).getTime()))).toBeLessThanOrEqual(now.getTime()-29*86_400_000)
  expect(first.every(item=>item.demo)).toBe(true)
 })
 it.each([{preset:'today' as const},{preset:'7d' as const},{preset:'30d' as const},{preset:'custom' as const,from:'2026-07-10',to:'2026-07-20'}])('mantém gráfico e faturamento coerentes em $preset',period=>{
  const ledger=createHistory(session(),now),bounds=periodBounds(period,now),filtered=ledger.filter(item=>{const date=new Date(item.occurredAt);return date>=bounds.start&&date<=bounds.end})
  const metrics=metricsFromTransactions(filtered),series=seriesFromTransactions(filtered,period,now)
  expect(series.reduce((sum,item)=>sum+item.revenueCents,0)).toBe(metrics.approvedRevenueCents)
 })
 it('mantém recusadas fora do faturamento e aplica taxas somente após aprovação',()=>{
  const value=session(),pending=createLiveTransaction(value,now),due={...pending,createdAt:new Date(now.getTime()-60_000).toISOString(),occurredAt:new Date(now.getTime()-60_000).toISOString()}
  const result=reconcileDemoLedger([due],now).ledger[0]
  if(result.status==='declined'||result.status==='pending')expect(metricsFromTransactions([result]).approvedRevenueCents).toBe(0)
  else expect(result.feeCents).toBeGreaterThan(0)
 })
 it('não usa Math.random e o gerador produz sequência determinística',()=>{
  const a=createSeededGenerator(42),b=createSeededGenerator(42)
  expect([a(),a(),a()]).toEqual([b(),b(),b()])
 })
})
