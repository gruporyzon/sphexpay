import { describe,expect,it } from 'vitest'
import { convertCents,deriveScenarioMetrics,generatePeriodSeries,generateSalesTimeline,maskBuyerName,metricsFromTransactions,normalizeTransactions,periodBounds,periodTitle,type ExchangeRate,type FinancialTransaction,type ScenarioInput } from '../lib/dashboardFinance'

const scenario:ScenarioInput={todayRevenueCents:100000,todayApprovedSales:10,averageTicketCents:10000,approvalRate:.8,refundRate:0,chargebackRate:0,dailyGrowthRate:.02,weekdayFactors:[.7,1,1,1,1,1,.8],hourlyDistribution:Array(24).fill(1),seed:42,currency:'BRL'}
const sale=(value:Partial<FinancialTransaction>={}):FinancialTransaction=>({transactionId:'tx-1',buyerName:'João Marques Silva',productName:'Produto',paymentMethod:'Pix',status:'approved',amountCents:10000,feeCents:200,currency:'BRL',occurredAt:'2026-07-26T15:00:00-03:00',...value})
const rates:ExchangeRate[]=[{baseCurrency:'BRL',quoteCurrency:'USD',rate:.2,source:'Configuração administrativa',observedAt:'2026-07-26T12:00:00Z'},{baseCurrency:'BRL',quoteCurrency:'EUR',rate:.16,source:'Provedor oficial',observedAt:'2026-07-26T12:00:00Z'}]

describe('inteligência financeira do Dashboard',()=>{
 it('retorna o título de Hoje',()=>expect(periodTitle({preset:'today'})).toBe('Faturamento de hoje'))
 it('retorna o título de 7 dias',()=>expect(periodTitle({preset:'7d'})).toBe('Faturamento dos últimos 7 dias'))
 it('retorna o título de 30 dias',()=>expect(periodTitle({preset:'30d'})).toBe('Faturamento dos últimos 30 dias'))
 it('retorna o título personalizado',()=>expect(periodTitle({preset:'custom',from:'2026-07-01',to:'2026-07-10'})).toBe('Faturamento do período selecionado'))
 it('usa exatamente as datas personalizadas',()=>{const bounds=periodBounds({preset:'custom',from:'2026-07-02',to:'2026-07-11'});expect(bounds.start.toISOString()).toContain('2026-07-02');expect(bounds.end.toISOString()).toContain('2026-07-12T02:59:59')})
 it('mantém a soma da série igual ao total determinístico',()=>{const points=generatePeriodSeries(scenario,{preset:'today'});expect(points.reduce((sum,point)=>sum+point.revenueCents,0)).toBe(deriveScenarioMetrics(scenario).approvedRevenueCents)})
 it('não multiplica linearmente sete dias',()=>{const points=generatePeriodSeries(scenario,{preset:'7d'});expect(points.reduce((sum,point)=>sum+point.revenueCents,0)).not.toBe(deriveScenarioMetrics(scenario).approvedRevenueCents*7)})
 it('calcula ticket médio pela receita elegível',()=>expect(metricsFromTransactions([sale(),sale({transactionId:'tx-2',amountCents:20000})]).averageTicketCents).toBe(15000))
 it('exclui reembolso da receita aprovada',()=>expect(metricsFromTransactions([sale(),sale({transactionId:'refund',status:'refunded',amountCents:5000})])).toMatchObject({approvedRevenueCents:10000,refunds:1}))
 it('exclui chargeback da receita aprovada',()=>expect(metricsFromTransactions([sale(),sale({transactionId:'cb',status:'chargeback',amountCents:5000})])).toMatchObject({approvedRevenueCents:10000,chargebacks:1}))
 it('converte BRL sem alterar quando a exibição é BRL',()=>expect(convertCents(10000,'BRL','BRL',rates)).toMatchObject({amountCents:10000,converted:false}))
 it('converte BRL para USD com taxa registrada',()=>expect(convertCents(10000,'BRL','USD',rates)).toMatchObject({amountCents:2000,rate:.2}))
 it('converte BRL para EUR com taxa registrada',()=>expect(convertCents(10000,'BRL','EUR',rates)).toMatchObject({amountCents:1600,rate:.16}))
 it('não converte na ausência de taxa',()=>expect(convertCents(10000,'USD','EUR',rates)).toBeNull())
 it('preserva a moeda original da transação',()=>{const row=sale();convertCents(row.amountCents,row.currency,'USD',rates);expect(row.currency).toBe('BRL')})
 it('deduplica eventos Realtime por transaction_id',()=>expect(normalizeTransactions([sale(),sale()])).toHaveLength(1))
 it('incorpora uma nova venda real aos resultados',()=>expect(metricsFromTransactions([sale(),sale({transactionId:'tx-2'})])).toMatchObject({approvedSales:2,approvedRevenueCents:20000}))
 it('mantém usuário sem vendas zerado',()=>expect(metricsFromTransactions([])).toMatchObject({approvedSales:0,approvedRevenueCents:0,averageTicketCents:0}))
 it('timeline de cenário é identificada e não altera a entrada',()=>{const original=structuredClone(scenario),timeline=generateSalesTimeline(scenario,{preset:'today'});expect(timeline.every(item=>item.scenario)).toBe(true);expect(scenario).toEqual(original)})
 it('moeda não altera identidade do comprador',()=>{const before=maskBuyerName('Michael Richards');convertCents(10000,'BRL','USD',rates);expect(maskBuyerName('Michael Richards')).toBe(before)})
 it('mascara sobrenomes sem expor contato',()=>expect(maskBuyerName('Sophie Dupont')).toBe('Sophie D.'))
})
