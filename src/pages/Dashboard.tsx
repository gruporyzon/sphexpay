import { useCallback,useEffect,useMemo,useState,type ReactNode } from 'react'
import { ArrowDownRight,BadgeDollarSign,CircleDollarSign,CreditCard,Percent,ReceiptText,ShieldAlert,Wallet } from 'lucide-react'
import { Card,PageTitle } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useDashboardPeriod } from '../hooks/useDashboardPeriod'
import { useDashboardCurrency } from '../hooks/useDashboardCurrency'
import { useLiveSales } from '../hooks/useLiveSales'
import { useFinancialMetrics } from '../hooks/useFinancialMetrics'
import { useScenarioPlanner } from '../hooks/useScenarioPlanner'
import { useDashboardAdmin } from '../hooks/useDashboardAdmin'
import { convertCents,deriveScenarioMetrics,generatePeriodSeries,generateSalesTimeline,periodTitle,seriesFromTransactions,type ExchangeRate,type FinancialTransaction } from '../lib/dashboardFinance'
import { dashboardService } from '../services/dashboardService'
import { OverviewHeroCarousel } from '../components/dashboard/OverviewHeroCarousel'
import { NextAwardCard } from '../components/dashboard/NextAwardCard'
import { PremiumStatCard,type PremiumStat } from '../components/dashboard/PremiumStatCard'
import { DashboardCurrencySelector,DashboardPeriodFilter } from '../components/dashboard/DashboardControls'
import { DashboardScenarioEditor } from '../components/dashboard/DashboardScenarioEditor'
import { formatCents } from '../lib/currencyFormat'
import { RevenueSection } from '../components/dashboard/RevenueSection'
import { LiveSalesFeedContent,LiveSalesSkeleton } from '../components/dashboard/LiveSalesTicker'
import { RealtimeStatus } from '../components/dashboard/RealtimeStatus'
import { LiveOperationsPanel } from '../components/dashboard/LiveOperationsPanel'
import { demoExchangeRates } from '../demo/demoSimulationEngine'
import { useDashboardLayout } from '../hooks/useDashboardLayout'
import { DashboardLayoutButton,DashboardLayoutEditor } from '../components/dashboard/DashboardLayoutEditor'
import { DashboardOverviewVisual } from '../components/dashboard/DashboardOverviewVisual'
import type { DashboardWidgetId } from '../lib/dashboardLayout'

const number=(value:number)=>Math.round(value).toLocaleString('pt-BR')

export default function Dashboard(){
 const {user}=useAuth(),adminAccess=useDashboardAdmin(user?.id),admin=adminAccess.allowed
 const layoutEditor=useDashboardLayout(user?.id)
 const {period,setPeriod}=useDashboardPeriod(),{currency,setCurrency}=useDashboardCurrency()
 const [mode,setMode]=useState<'production'|'planning'>('production'),[rates,setRates]=useState<ExchangeRate[]>([]),[rateError,setRateError]=useState(false)
 const live=useLiveSales(user?.id,period),planner=useScenarioPlanner(user?.id,Boolean(admin))
 useEffect(()=>{let active=true;dashboardService.loadRates().then(value=>{if(active)setRates(value)}).catch(()=>{if(active)setRateError(true)});return()=>{active=false}},[])
 useEffect(()=>{if(!admin&&mode==='planning')setMode('production')},[admin,mode])

 const effectiveRates=useMemo<ExchangeRate[]>(()=>live.demo?Object.entries(demoExchangeRates).filter(([base])=>base!=='BRL').flatMap(([base,rate])=>[{baseCurrency:base as 'USD'|'EUR',quoteCurrency:'BRL' as const,rate:1/rate,source:'taxa de referência',observedAt:new Date().toISOString()},{baseCurrency:'BRL' as const,quoteCurrency:base as 'USD'|'EUR',rate,source:'taxa de referência',observedAt:new Date().toISOString()}]):rates,[live.demo,rates])
 const convertRows=useCallback((rows:FinancialTransaction[])=>rows.flatMap(row=>{const converted=convertCents(row.amountCents,row.currency,currency,effectiveRates),fee=convertCents(row.feeCents,row.currency,currency,effectiveRates);return converted&&fee?[{...row,amountCents:converted.amountCents,feeCents:fee.amountCents,currency}]:[]}),[currency,effectiveRates])
 const currentConverted=useMemo(()=>convertRows(live.sales),[live.sales,convertRows])
 const previousConverted=useMemo(()=>convertRows(live.previous),[live.previous,convertRows])
 const realMetrics=useFinancialMetrics(currentConverted,previousConverted)
 const unavailableConversions=live.sales.filter(row=>row.currency!==currency&&!convertCents(row.amountCents,row.currency,currency,effectiveRates)).length

 const scenarioSeries=useMemo(()=>generatePeriodSeries(planner.scenario,period),[planner.scenario,period])
 const scenarioBase=useMemo(()=>deriveScenarioMetrics(planner.scenario),[planner.scenario])
 const scenarioTotal=scenarioSeries.reduce((sum,point)=>sum+point.revenueCents,0),scenarioSales=scenarioSeries.reduce((sum,point)=>sum+point.sales,0)
 const scenarioMetrics={...scenarioBase,approvedRevenueCents:scenarioTotal,approvedSales:scenarioSales,averageTicketCents:scenarioSales?Math.round(scenarioTotal/scenarioSales):0,growthRate:planner.scenario.dailyGrowthRate}
 const planning=mode==='planning'&&admin
 const metrics=planning?scenarioMetrics:realMetrics
 const series=planning?scenarioSeries:seriesFromTransactions(currentConverted,period)
 const scenarioFeed=useMemo<FinancialTransaction[]>(()=>generateSalesTimeline(planner.scenario,period).slice(-7).reverse().map(item=>({transactionId:item.id,buyerName:'Registro de cenário',productName:'Projeção de venda',paymentMethod:'Cenário',status:'approved',amountCents:item.amountCents,feeCents:0,currency:planner.scenario.currency,occurredAt:item.occurredAt})),[planner.scenario,period])
 const feed=planning?scenarioFeed:live.sales
 const chartTotal=series.reduce((sum,point)=>sum+point.revenueCents,0)
 const cards:PremiumStat[]=[
  {label:periodTitle(period),value:metrics.approvedRevenueCents,format:'money',delta:metrics.growthRate*100,icon:CircleDollarSign,featured:true},
  {label:'Resultado líquido',value:Math.max(0,metrics.approvedRevenueCents-metrics.feesCents),format:'money',delta:metrics.growthRate*100,icon:Wallet,featured:true},
  {label:'Taxas',value:metrics.feesCents,format:'money',delta:0,icon:BadgeDollarSign},
  {label:'Vendas aprovadas',value:metrics.approvedSales,format:'number',delta:0,icon:ReceiptText},
  {label:'Ticket médio',value:metrics.averageTicketCents,format:'money',delta:0,icon:CreditCard},
  {label:'Taxa de aprovação',value:metrics.approvalRate*100,format:'percent',delta:0,icon:Percent},
  {label:'Reembolsos',value:metrics.refunds,format:'number',delta:0,icon:ArrowDownRight},
  {label:'Chargebacks',value:metrics.chargebacks,format:'number',delta:0,icon:ShieldAlert}
 ]
 const formatMetric=(format:PremiumStat['format'])=>(value:number)=>format==='money'?formatCents(value,currency):format==='percent'?`${value.toFixed(1)}%`:number(value)
 const paymentStats=useMemo(()=>{const rows=planning?[]:currentConverted,total=rows.filter(row=>row.status==='approved').reduce((sum,row)=>sum+row.amountCents,0);return[...new Set(rows.map(row=>row.paymentMethod))].map(method=>{const items=rows.filter(row=>row.paymentMethod===method),approved=items.filter(row=>row.status==='approved'),amount=approved.reduce((sum,row)=>sum+row.amountCents,0);return{method,count:items.length,approved:approved.length,total:amount,share:total?amount/total*100:0}}).sort((a,b)=>b.total-a.total)},[planning,currentConverted])
 const loading=planning?planner.loading:live.loading,error=planning?planner.error:live.error
 const mobileLayout=layoutEditor.breakpoint==='mobile'
 const saveRates=async(next:ExchangeRate[])=>{if(!user?.id)throw new Error('EXCHANGE_RATE_SAVE_FORBIDDEN');await dashboardService.saveRates(user.id,next);setRates(await dashboardService.loadRates());setRateError(false)}
 const widgetIds:DashboardWidgetId[]=['gross-revenue','net-revenue','fees','approved-sales','average-ticket','approval-rate','refunds','chargebacks']
 const widgets=Object.fromEntries([
  ...cards.map((stat,index)=>[widgetIds[index],<PremiumStatCard key={widgetIds[index]} stat={stat} index={index} refreshing={loading} format={formatMetric(stat.format)}/>]),
  ['revenue-chart',<RevenueSection key="revenue-chart" label={periodTitle(period)} totalCents={chartTotal} growth={metrics.growthRate} data={series} currency={planning?planner.scenario.currency:currency} loading={loading} error={error} planning={Boolean(planning)}/>],
  ['recent-sales',loading?<LiveSalesSkeleton key="recent-sales"/>:<LiveSalesFeedContent key="recent-sales" sales={feed} displayCurrency={planning?planner.scenario.currency:currency} rates={planning?[]:effectiveRates} planning={Boolean(planning)}/>]
 ]) as Record<DashboardWidgetId,ReactNode>

 return <div className="page-enter dashboard-page">
  <OverviewHeroCarousel/>
  <PageTitle title="Dashboard" subtitle={live.demo?'Acompanhe resultados, vendas e indicadores em tempo real.':'Resultados financeiros persistidos e planejamento administrativo isolado.'} action={<div className="dashboard-header-actions">{admin&&!live.demo?<button className="btn" onClick={()=>setMode(current=>current==='production'?'planning':'production')}>{planning?'Ver produção':'Editar planejamento'}</button>:null}{planning&&<DashboardScenarioEditor scenario={planner.scenario} rates={rates} onSave={planner.save} onSaveRates={saveRates}/>}</div>}/>
  {adminAccess.error&&<p className="dashboard-admin-warning">{adminAccess.error}</p>}
  <Card className="dashboard-filter-bar"><div className="dashboard-filter-controls"><DashboardPeriodFilter period={period} onChange={setPeriod}/><DashboardCurrencySelector currency={currency} onChange={setCurrency}/></div><div className="dashboard-filter-actions">{adminAccess.loading?<span className="dashboard-admin-state">Validando acesso administrativo...</span>:admin&&!mobileLayout?<DashboardLayoutButton editor={layoutEditor}/>:null}{!planning&&!live.demo&&<RealtimeStatus status={live.realtime} updatedAt={live.updatedAt} onRefresh={()=>void live.refresh()} loading={live.loading}/>}</div></Card>
  {(rateError||unavailableConversions>0)&&!planning&&!live.demo&&<p className="dashboard-conversion-notice">{unavailableConversions?`${unavailableConversions} transação(ões) permanecem na moeda original e não entram no total convertido porque não há taxa disponível.`:'As taxas de conversão estão temporariamente indisponíveis. Valores originais foram preservados.'}</p>}
  {!planning&&<NextAwardCard currentRevenue={live.eligibleRevenueCents/100}/>}
  {layoutEditor.editing?<DashboardLayoutEditor editor={layoutEditor} widgets={widgets}/>:<><DashboardOverviewVisual stats={cards} formatMetric={formatMetric} balanceCents={Math.max(0,metrics.approvedRevenueCents-metrics.feesCents)} currency={planning?planner.scenario.currency:currency} chartLabel={periodTitle(period)} chartTotalCents={chartTotal} growth={metrics.growthRate} data={series} loading={loading} error={error} planning={Boolean(planning)} feed={feed} rates={planning?[]:effectiveRates} heading="Resultados em contexto" eyebrow="RESUMO DA OPERAÇÃO"/><div className="dashboard-layout-legacy" aria-hidden="true"><DashboardLayoutEditor editor={layoutEditor} widgets={widgets}/></div></>}
  <section className="dashboard-payment-section">
   <Card className="dashboard-payment-card"><div className="insight-heading"><div><span className="section-eyebrow"><Wallet/> MEIOS DE PAGAMENTO</span><h2>Desempenho por canal</h2></div>{!planning&&paymentStats.length>0&&<div className="payment-performance-summary"><div><span>Total processado</span><strong>{formatCents(paymentStats.reduce((sum,item)=>sum+item.total,0),currency)}</strong></div><div><span>Método líder</span><strong>{paymentStats[0].method}</strong><small>{paymentStats[0].share.toFixed(1)}% do total</small></div></div>}</div>{planning?<div className="dashboard-inline-empty">Canais reais não são misturados ao planejamento.</div>:<div className="payment-performance">{paymentStats.map(item=><div className="payment-performance-row" key={item.method}><div className="payment-performance-title"><b>{item.method}</b><span>{item.count} transações · {item.approved} aprovadas</span></div><div className="payment-performance-track" role="progressbar" aria-label={`Participação de ${item.method}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(item.share)}><i style={{width:`${item.share}%`}}/></div><div className="payment-performance-value"><strong>{formatCents(item.total,currency)}</strong><span>{item.share.toFixed(1)}%</span></div></div>)}{!paymentStats.length&&<div className="dashboard-inline-empty">Nenhuma venda registrada neste período.</div>}</div>}</Card>
  </section>
  {admin&&mobileLayout&&<div className="dashboard-layout-mobile-action"><DashboardLayoutButton editor={layoutEditor}/></div>}
  {admin&&planning&&<LiveOperationsPanel/>}
 </div>
}
