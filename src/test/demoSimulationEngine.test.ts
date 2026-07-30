import { describe,expect,it } from 'vitest'
import { calculateDynamicInterval,createHistory,createLiveTransaction,createSeededGenerator,defaultDemoConfig,demoPresets,fallbackDemoProducts,reconcileDemoLedger,selectWeighted,validateDemoConfig } from '../demo/demoSimulationEngine'
import { metricsFromTransactions,periodBounds,seriesFromTransactions } from '../lib/dashboardFinance'
import type { DemoSession } from '../demo/types'

const now=new Date('2026-07-27T15:00:00-03:00')
const session=(seed=123):DemoSession=>({version:2,active:true,paused:false,sessionId:'test-session',seed,ownerId:'owner',startedAt:now.toISOString(),expiresAt:new Date(now.getTime()+86_400_000).toISOString(),lastEventAt:now.toISOString(),ledger:[],notifications:[],products:fallbackDemoProducts,config:defaultDemoConfig(),eventCount:0,approvedCount:0,sessionVolumeCents:0,intensity:1,exchangeRates:{BRL:1,USD:.19,EUR:.17}})

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
 it('valida limites, pesos e taxas antes de aplicar',()=>{
  expect(validateDemoConfig({...defaultDemoConfig(),minFrequency:20,maxFrequency:10})).toContain('A frequência mínima não pode superar a máxima.')
  expect(validateDemoConfig({...defaultDemoConfig(),minAmountCents:50000,maxAmountCents:10000})).toContain('O valor mínimo não pode superar o máximo.')
  expect(validateDemoConfig({...defaultDemoConfig(),approvalRate:90})).toContain('As taxas de status devem totalizar 100%.')
  expect(validateDemoConfig(defaultDemoConfig())).toEqual([])
 })
 it('oferece presets editáveis e seleção ponderada reproduzível',()=>{
  expect(Object.keys(demoPresets)).toEqual(expect.arrayContaining(['light','normal','high','launch','peak','subscriptions','international']))
  const a=createSeededGenerator(99),b=createSeededGenerator(99),weights=defaultDemoConfig().methods
  expect(Array.from({length:20},()=>selectWeighted(weights,a))).toEqual(Array.from({length:20},()=>selectWeighted(weights,b)))
 })
 it('gera país, cidade, cliente reservado e moedas no mesmo ledger',()=>{
  const value={...session(),config:demoPresets.international},event=createLiveTransaction(value,now)
  expect(event.countryCode).toMatch(/^[A-Z]{2}$/)
  expect(event.countryName).toBeTruthy()
  expect(event.cityName).toBeTruthy()
  expect(event.customerEmail).toMatch(/^cliente\d{3}@example\.com$/)
  expect(['BRL','USD','EUR']).toContain(event.currency)
  expect(event).toMatchObject({demo:true,source:'mode'})
 })
 it('calcula um único próximo intervalo com intensidade configurável',()=>{
  const value=session(),normal=calculateDynamicInterval(value,now),faster=calculateDynamicInterval({...value,intensity:2},now)
  expect(normal).toBeGreaterThan(0)
  expect(faster).toBeLessThan(normal)
 })
})
