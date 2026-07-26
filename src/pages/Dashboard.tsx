import { useCallback,useEffect,useMemo,useState } from 'react'
import { ArrowDownRight,BadgeDollarSign,CircleDollarSign,CreditCard,Percent,ReceiptText,ShieldAlert,Wallet } from 'lucide-react'
import { Card,PageTitle } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useDashboardPeriod } from '../hooks/useDashboardPeriod'
import { useDashboardCurrency } from '../hooks/useDashboardCurrency'
import { useLiveSales } from '../hooks/useLiveSales'
import { useFinancialMetrics } from '../hooks/useFinancialMetrics'
import { useScenarioPlanner } from '../hooks/useScenarioPlanner'
import { useDashboardAdmin } from '../hooks/useDashboardAdmin'
import { convertCents,deriveScenarioMetrics,generatePeriodSeries,generateSalesTimeline,maskBuyerName,periodTitle,seriesFromTransactions,type ExchangeRate,type FinancialTransaction } from '../lib/dashboardFinance'
import { dashboardService } from '../services/dashboardService'
import { OverviewHeroCarousel } from '../components/dashboard/OverviewHeroCarousel'
import { NextAwardCard } from '../components/dashboard/NextAwardCard'
import { PremiumStatCard,type PremiumStat } from '../components/dashboard/PremiumStatCard'
import { DashboardCurrencySelector,DashboardModeIndicator,DashboardPeriodFilter } from '../components/dashboard/DashboardControls'
import { DashboardScenarioEditor } from '../components/dashboard/DashboardScenarioEditor'
import { formatCents } from '../lib/currencyFormat'
import { RevenueSection } from '../components/dashboard/RevenueSection'
import { LiveSalesFeedContent,LiveSalesSkeleton } from '../components/dashboard/LiveSalesTicker'
import { RealtimeStatus } from '../components/dashboard/RealtimeStatus'

const number=(value:number)=>Math.round(value).toLocaleString('pt-BR')

export default function Dashboard(){
 const {user}=useAuth(),adminAccess=useDashboardAdmin(user?.id),admin=adminAccess.allowed
 const {period,setPeriod}=useDashboardPeriod(),{currency,setCurrency}=useDashboardCurrency()
 const [mode,setMode]=useState<'production'|'planning'>('production'),[rates,setRates]=useState<ExchangeRate[]>([]),[rateError,setRateError]=useState(false)
 const live=useLiveSales(user?.id,period),planner=useScenarioPlanner(user?.id,Boolean(admin))
 useEffect(()=>{let active=true;dashboardService.loadRates().then(value=>{if(active)setRates(value)}).catch(()=>{if(active)setRateError(true)});return()=>{active=false}},[])
 useEffect(()=>{if(!admin&&mode==='planning')setMode('production')},[admin,mode])

 const convertRows=useCallback((rows:FinancialTransaction[])=>rows.flatMap(row=>{const converted=convertCents(row.amountCents,row.currency,currency,rates),fee=convertCents(row.feeCents,row.currency,currency,rates);return converted&&fee?[{...row,amountCents:converted.amountCents,feeCents:fee.amountCents,currency}]:[]}),[currency,rates])
 const currentConverted=useMemo(()=>convertRows(live.sales),[live.sales,convertRows])
 const previousConverted=useMemo(()=>convertRows(live.previous),[live.previous,convertRows])
 const realMetrics=useFinancialMetrics(currentConverted,previousConverted)
 const unavailableConversions=live.sales.filter(row=>row.currency!==currency&&!convertCents(row.amountCents,row.currency,currency,rates)).length

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
 const paymentStats=useMemo(()=>{const rows=planning?[]:currentConverted;return[...new Set(rows.map(row=>row.paymentMethod))].map(method=>{const items=rows.filter(row=>row.paymentMethod===method),approved=items.filter(row=>row.status==='approved');return{method,count:items.length,approved:approved.length,total:approved.reduce((sum,row)=>sum+row.amountCents,0)}})},[planning,currentConverted])
 const buyers=useMemo(()=>{if(planning)return[];const grouped=new Map<string,{name:string;count:number;total:number}>();for(const row of currentConverted.filter(item=>item.status==='approved')){const name=maskBuyerName(row.buyerName),current=grouped.get(name)??{name,count:0,total:0};current.count++;current.total+=row.amountCents;grouped.set(name,current)}return[...grouped.values()].sort((a,b)=>b.total-a.total).slice(0,4)},[planning,currentConverted])
 const loading=planning?planner.loading:live.loading,error=planning?planner.error:live.error
 const saveRates=async(next:ExchangeRate[])=>{if(!user?.id)throw new Error('EXCHANGE_RATE_SAVE_FORBIDDEN');await dashboardService.saveRates(user.id,next);setRates(await dashboardService.loadRates());setRateError(false)}

 return <div className="page-enter dashboard-page">
  <OverviewHeroCarousel/>
  <PageTitle title="Dashboard" subtitle="Resultados financeiros persistidos e planejamento administrativo isolado." action={<div className="dashboard-header-actions"><DashboardModeIndicator mode={planning?'planning':'production'}/>{adminAccess.loading?<span className="dashboard-admin-state">Validando acesso administrativo...</span>:admin?<button className="btn" onClick={()=>setMode(current=>current==='production'?'planning':'production')}>{planning?'Ver produção':'Editar planejamento'}</button>:null}{planning&&<DashboardScenarioEditor scenario={planner.scenario} rates={rates} onSave={planner.save} onSaveRates={saveRates}/>}</div>}/>
  {adminAccess.error&&<p className="dashboard-admin-warning">{adminAccess.error}</p>}
  <Card className="dashboard-filter-bar"><DashboardPeriodFilter period={period} onChange={setPeriod}/><DashboardCurrencySelector currency={currency} onChange={setCurrency}/>{!planning&&<RealtimeStatus status={live.realtime} updatedAt={live.updatedAt} onRefresh={()=>void live.refresh()} loading={live.loading}/>}</Card>
  {(rateError||unavailableConversions>0)&&!planning&&<p className="dashboard-conversion-notice">{unavailableConversions?`${unavailableConversions} transação(ões) permanecem na moeda original e não entram no total convertido porque não há taxa disponível.`:'As taxas de conversão estão temporariamente indisponíveis. Valores originais foram preservados.'}</p>}
  {!planning&&<NextAwardCard currentRevenue={metrics.approvedRevenueCents/100}/>}
  <section className={`dashboard-metrics dashboard-metrics-compact ${loading?'is-loading':''}`} aria-label="Indicadores financeiros">{cards.map((stat,index)=><PremiumStatCard key={stat.label} stat={stat} index={index} refreshing={loading} format={formatMetric(stat.format)}/>)}</section>
  <section className="dashboard-content"><RevenueSection label={periodTitle(period)} totalCents={chartTotal} growth={metrics.growthRate} data={series} currency={planning?planner.scenario.currency:currency} loading={loading} error={error} planning={Boolean(planning)}/>{loading?<LiveSalesSkeleton/>:<LiveSalesFeedContent sales={feed} displayCurrency={planning?planner.scenario.currency:currency} rates={planning?[]:rates} planning={Boolean(planning)}/>}</section>
  <section className="dashboard-insight-grid">
   <Card><div className="insight-heading"><div><span className="section-eyebrow"><Wallet/> MEIOS DE PAGAMENTO</span><h2>Desempenho por canal</h2></div></div>{planning?<div className="dashboard-inline-empty">Canais reais não são misturados ao planejamento.</div>:<div className="payment-performance">{paymentStats.map(item=><div className="payment-performance-row" key={item.method}><div className="payment-performance-title"><b>{item.method}</b><span>{item.count} transações · {item.approved} aprovadas</span></div><strong>{formatCents(item.total,currency)}</strong></div>)}{!paymentStats.length&&<div className="dashboard-inline-empty">Nenhuma venda registrada neste período.</div>}</div>}</Card>
   <Card><div className="insight-heading"><div><span className="section-eyebrow"><ShieldAlert/> INTEGRIDADE</span><h2>{planning?'Cenário isolado':'Fonte financeira'}</h2></div></div><p>{planning?'A timeline e os indicadores são projeções determinísticas. Nada é persistido como venda ou enviado a notificações e relatórios.':'Somente transações persistidas para esta conta, protegidas por RLS, entram nos indicadores.'}</p></Card>
  </section>
  <section className="dashboard-bottom-grid"><Card><div className="insight-heading"><div><span className="section-eyebrow"><i/> RELACIONAMENTO</span><h2>Top compradores</h2></div></div>{planning?<div className="dashboard-inline-empty">Compradores reais não aparecem no planejamento.</div>:<div className="dashboard-buyers">{buyers.map(buyer=><div key={buyer.name}><span><b>{buyer.name}</b><small>{buyer.count} compras</small></span><strong>{formatCents(buyer.total,currency)}</strong></div>)}{!buyers.length&&<div className="dashboard-inline-empty">Nenhum comprador registrado neste período.</div>}</div>}</Card><Card className="dashboard-alert-card"><div className="insight-heading"><div><span className="section-eyebrow"><ShieldAlert/> COERÊNCIA</span><h2>Resumo</h2></div></div><p><b>{metrics.approvedSales} vendas aprovadas.</b> Ticket médio de {formatCents(metrics.averageTicketCents,planning?planner.scenario.currency:currency)} e faturamento de {formatCents(metrics.approvedRevenueCents,planning?planner.scenario.currency:currency)}.</p></Card></section>
 </div>
}
