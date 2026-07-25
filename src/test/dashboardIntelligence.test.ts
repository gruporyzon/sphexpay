import { describe,expect,it } from 'vitest'
import { awardProgress,deriveDashboardKpis,periodRevenueLabel,rebalanceChart } from '../lib/dashboardIntelligence'
import type { DashboardKpis } from '../types'
import { nextAwardProgress } from '../services/awardProgressService'
import { dedupeSalesById,getDashboardDataMode,selectDashboardSales } from '../services/dashboardDataSource'
import { initialData,newLiveSale } from '../data/demo'

const current:DashboardKpis={revenue:100000,sales:250,ticket:400,goal:200000,progress:50,approval:96,pending:10000,profit:72000,growth:12}

describe('inteligência do dashboard',()=>{
 it.each([
  ['today','Faturamento de hoje'],
  ['7d','Faturamento dos últimos 7 dias'],
  ['30d','Faturamento dos últimos 30 dias'],
  ['custom','Faturamento do período selecionado']
 ] as const)('usa o título correto para %s',(preset,label)=>expect(periodRevenueLabel({preset})).toBe(label))

 it('recalcula vendas e ticket ao editar faturamento',()=>{
  const result=deriveDashboardKpis(current,{revenue:200000})
  expect(result.sales).toBe(500)
  expect(result.ticket).toBe(400)
  expect(result.progress).toBe(100)
 })

 it('recalcula ticket ao editar quantidade de vendas',()=>{
  const result=deriveDashboardKpis(current,{sales:200})
  expect(result.revenue).toBe(100000)
  expect(result.ticket).toBe(500)
 })

 it('recalcula faturamento ao editar ticket médio',()=>{
  const result=deriveDashboardKpis(current,{ticket:500})
  expect(result.revenue).toBe(125000)
  expect(result.sales).toBe(250)
 })

 it('recalcula progresso ao editar a meta',()=>{
  expect(deriveDashboardKpis(current,{goal:125000}).progress).toBe(80)
 })

 it('redistribui gráfico preservando totais coerentes',()=>{
  const data=[{label:'1',revenue:20,profit:14,sales:1},{label:'2',revenue:30,profit:22,sales:2},{label:'3',revenue:50,profit:36,sales:3}]
  const result=rebalanceChart(data,current)
  expect(result.reduce((sum,point)=>sum+point.revenue,0)).toBe(current.revenue)
  expect(result.reduce((sum,point)=>sum+point.sales,0)).toBe(current.sales)
  expect(result.every(point=>point.profit===Math.round(point.revenue*.72))).toBe(true)
 })

 it('calcula progresso da próxima premiação com limites seguros',()=>{
  expect(awardProgress(250000,500000)).toEqual({progress:50,remaining:250000})
  expect(awardProgress(600000,500000)).toEqual({progress:100,remaining:0})
 })

 it('escolhe automaticamente a próxima placa e não inventa uma após a última',()=>{
  expect(nextAwardProgress(120000,initialData.achievements).next?.id).toBe('250k')
  expect(nextAwardProgress(6000000,initialData.achievements)).toMatchObject({next:undefined,complete:true,progress:100})
 })

 it('deduplica eventos em tempo real pelo identificador',()=>{
  const sale=newLiveSale(123456)
  expect(dedupeSalesById([sale,sale])).toEqual([sale])
 })

 it('separa produção e demonstração sem expor transações simuladas em produção',()=>{
  expect(getDashboardDataMode('demo')).toBe('demo')
  expect(getDashboardDataMode('production')).toBe('production')
  expect(selectDashboardSales(initialData.sales,'production')).toEqual([])
  expect(selectDashboardSales(initialData.sales,'demo')).toHaveLength(initialData.sales.length)
 })
})
