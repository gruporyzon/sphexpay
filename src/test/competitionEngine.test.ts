import { describe,expect,it } from 'vitest'
import { competitionConfig,competitionStatus } from '../config/competition'
import { eligibleRevenue,sortStandings,targetReached,type CompetitionEvent,type CompetitionStanding } from '../services/competitionEngine'

const event=(values:Partial<CompetitionEvent>={}):CompetitionEvent=>({transactionId:'tx-1',userId:'user-1',type:'approved',amountCents:1_000_000,occurredAt:'2026-09-02T12:00:00-03:00',...values})
const standing=(values:Partial<CompetitionStanding>={}):CompetitionStanding=>({userId:'user-1',publicName:'Participante',eligibleRevenueCents:0,eligibleSalesCount:0,auditStatus:'pending',...values})

describe('competição SphexPay',()=>{
 it('calcula estados antes, durante e depois do período',()=>{
  expect(competitionStatus(new Date('2026-08-31T12:00:00-03:00'))).toBe('upcoming')
  expect(competitionStatus(new Date('2026-09-15T12:00:00-03:00'))).toBe('active')
  expect(competitionStatus(new Date('2026-10-02T12:00:00-03:00'))).toBe('ended')
  expect(competitionStatus(new Date(), 'audit')).toBe('audit')
 })
 it('soma somente aprovações únicas e exclui reembolso e chargeback',()=>{
  expect(eligibleRevenue([event(),event(),event({transactionId:'tx-2',amountCents:500_000}),event({transactionId:'tx-2',type:'refunded',amountCents:500_000}),event({transactionId:'tx-3',type:'chargeback'})])).toBe(1_000_000)
 })
 it('registra a primeira transação que alcança a meta',()=>{
  const result=targetReached([event({transactionId:'a',amountCents:2_000_000}),event({transactionId:'b',amountCents:competitionConfig.targetCents-2_000_000,occurredAt:'2026-09-03T10:00:00-03:00'}),event({transactionId:'c',amountCents:1_000_000,occurredAt:'2026-09-04T10:00:00-03:00'})])
  expect(result).toEqual({targetReachedAt:'2026-09-03T10:00:00-03:00',qualifyingTransactionId:'b'})
 })
 it('desempata por receita, alcance da meta e venda mais antiga',()=>{
  const rows=sortStandings([
   standing({userId:'late',eligibleRevenueCents:3_100_000,targetReachedAt:'2026-09-05T10:00:00-03:00'}),
   standing({userId:'early',eligibleRevenueCents:3_100_000,targetReachedAt:'2026-09-04T10:00:00-03:00'}),
   standing({userId:'lower',eligibleRevenueCents:2_900_000})
  ])
  expect(rows.map(row=>row.userId)).toEqual(['early','late','lower'])
 })
 it('não cria participantes quando não recebe dados reais',()=>{expect(sortStandings([])).toEqual([])})
})
