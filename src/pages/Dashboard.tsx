import { useEffect,useMemo,useRef,useState } from 'react'
import { ArrowDownRight,ArrowUpRight,BadgeDollarSign,CircleDollarSign,CreditCard,Filter,Percent,ReceiptText,RefreshCcw,ShieldAlert,Wallet } from 'lucide-react'
import { Card,PageTitle } from '../components/ui'
import { money } from '../lib/utils'
import { useDemoStore } from '../store/useDemoStore'
import type { DashboardKpis,Sale } from '../types'
import { chartForPeriod,filterSales,smartMetrics } from '../services/analyticsService'
import { NextAwardCard } from '../components/dashboard/NextAwardCard'
import { OverviewHeroCarousel } from '../components/dashboard/OverviewHeroCarousel'
import { periodRevenueLabel } from '../lib/dashboardIntelligence'
import { PremiumStatCard,type PremiumStat } from '../components/dashboard/PremiumStatCard'
import { RevenueSection,type PerformanceMetric } from '../components/dashboard/RevenueSection'
import { LiveSalesSkeleton,LiveSalesTicker } from '../components/dashboard/LiveSalesTicker'
import { selectDashboardSales } from '../services/dashboardDataSource'
import { DashboardScenarioEditor } from '../components/dashboard/DashboardScenarioEditor'
import { useAuth } from '../hooks/useAuth'

type MetricKey=PerformanceMetric

const number=(value:number)=>Math.round(value).toLocaleString('pt-BR')
const metricFormat=(format:PremiumStat['format'],currency:Sale['currency'])=>(value:number)=>format==='money'?money(value,currency):format==='percent'?`${value.toFixed(1)}%`:number(value)

export default function Dashboard(){
 const state=useDemoStore()
 const {user}=useAuth()
 const admin=user?.app_metadata?.role==='admin'
 const [metric,setMetric]=useState<MetricKey>('revenue')
 const [currency,setCurrency]=useState<Sale['currency']>('BRL')
 const [typeFilter,setTypeFilter]=useState('Todos')
 const [productFilter,setProductFilter]=useState('Todos')
 const [updated,setUpdated]=useState('Agora')
 const [refreshing,setRefreshing]=useState(false)
 const refreshTimer=useRef<number|undefined>(undefined)
 const sourceSales=selectDashboardSales(state.sales)
 useEffect(()=>()=>{if(refreshTimer.current)window.clearTimeout(refreshTimer.current)},[])
 const periodSales=useMemo(()=>filterSales(sourceSales,state.period).filter(sale=>sale.currency===currency&&(typeFilter==='Todos'||sale.method===typeFilter)&&(productFilter==='Todos'||sale.product===productFilter)),[sourceSales,state.period,currency,typeFilter,productFilter])
 const calculated=useMemo(()=>smartMetrics(periodSales,0),[periodSales])
 const visibleChart=useMemo(()=>chartForPeriod(state.chart,state.period).map(point=>({...point,revenue:0,profit:0,sales:0})),[state.chart,state.period])
 const chartTotal=useMemo(()=>visibleChart.reduce((sum,point)=>sum+point[metric],0),[visibleChart,metric])
 const previousTotal=0
 const chartGrowth=previousTotal?(chartTotal-previousTotal)/previousTotal*100:0
 const baseline:DashboardKpis=useMemo(()=>{
  const revenue=calculated.revenue
  const sales=calculated.total
  const ticket=sales?revenue/sales:0
  const goal=0
  return{revenue,sales,ticket,goal,progress:0,approval:calculated.approval,pending:calculated.pending,profit:calculated.profit,growth:revenue?chartGrowth:0}
 },[calculated,chartGrowth])
 const manual=admin&&state.dashboardScenario?.preset===state.period.preset?state.dashboardScenario:undefined
 const kpis=manual??baseline
 const revenueLabel=periodRevenueLabel(state.period)
 const metrics:PremiumStat[]=[
  {label:revenueLabel,value:kpis.revenue,format:'money',delta:kpis.growth,icon:CircleDollarSign,featured:true},
  {label:'Saldo disponível',value:calculated.profit,format:'money',delta:0,icon:Wallet,featured:true},
  {label:'Saldo pendente',value:kpis.pending,format:'money',delta:0,icon:BadgeDollarSign},
  {label:'Total de vendas',value:kpis.sales,format:'number',delta:0,icon:ReceiptText},
  {label:'Ticket médio',value:kpis.ticket,format:'money',delta:0,icon:CreditCard},
  {label:'Taxa de aprovação',value:kpis.approval,format:'percent',delta:0,icon:Percent},
  {label:'Reembolsos',value:calculated.refunds,format:'number',delta:0,icon:ArrowDownRight},
  {label:'Chargebacks',value:0,format:'number',delta:0,icon:ShieldAlert}
 ]
 const paymentMethods=['Pix','Cartão de crédito','Boleto','Assinatura','Link de pagamento']
 const paymentStats=paymentMethods.map(method=>{const rows=periodSales.filter(sale=>sale.method===method),total=rows.reduce((sum,sale)=>sum+(sale.status==='Aprovado'?sale.amount:0),0),approved=rows.filter(sale=>sale.status==='Aprovado').length;return{method,total,approved,count:rows.length,share:periodSales.length?rows.length/periodSales.length*100:0}})
 const topProducts=[] as typeof state.products
 const displayedTotal=metric==='revenue'?kpis.revenue:metric==='profit'?kpis.profit:kpis.sales
 const refresh=()=>{setRefreshing(true);setUpdated('Sincronizando');if(refreshTimer.current)window.clearTimeout(refreshTimer.current);refreshTimer.current=window.setTimeout(()=>{setRefreshing(false);setUpdated('Atualizado agora')},520)}

 return <div className="page-enter dashboard-page">
  <OverviewHeroCarousel/>
  <PageTitle title="Dashboard" subtitle="Performance, ritmo de vendas e decisões em uma visão executiva." action={admin?<DashboardScenarioEditor kpis={kpis} currency={currency} onSave={changes=>state.applyDashboardScenario(kpis,changes,state.period)}/>:undefined}/>
  <Card className="dashboard-filter-bar">
   <div className="dashboard-filter-title"><Filter size={16}/><div><b>Leitura do painel</b><span>Refine os indicadores da operação</span></div></div>
   <label><span>Tipo</span><select value={typeFilter} onChange={event=>setTypeFilter(event.target.value)}><option>Todos</option>{['Pix','Cartão de crédito','Boleto','Assinatura'].map(value=><option key={value}>{value}</option>)}</select></label>
   <label><span>Produtos</span><select value={productFilter} onChange={event=>setProductFilter(event.target.value)}><option>Todos</option></select></label>
   <label><span>Moeda</span><select value={currency} onChange={event=>setCurrency(event.target.value as Sale['currency'])}><option value="BRL">BRL</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
   <label><span>Período</span><select value={state.period.preset} onChange={event=>state.setPeriod({...state.period,preset:event.target.value as typeof state.period.preset})}><option value="today">Hoje</option><option value="7d">Últimos 7 dias</option><option value="30d">Últimos 30 dias</option><option value="month">Este mês</option><option value="lastMonth">Mês passado</option><option value="custom">Personalizado</option></select></label>
   {state.period.preset==='custom'&&<><label><span>De</span><input type="date" value={state.period.from??''} onChange={event=>state.setPeriod({...state.period,from:event.target.value})}/></label><label><span>Até</span><input type="date" min={state.period.from} value={state.period.to??''} onChange={event=>state.setPeriod({...state.period,to:event.target.value})}/></label></>}
   <button className="btn dashboard-refresh" onClick={refresh} disabled={refreshing}><RefreshCcw className={refreshing?'spin':''}/> Atualizar <small>{updated}</small></button>
  </Card>
  <NextAwardCard currentRevenue={kpis.revenue}/>
  <section className={`dashboard-metrics dashboard-metrics-compact ${refreshing?'is-loading':''}`} aria-label="Indicadores financeiros">
   {metrics.map((stat,index)=><PremiumStatCard key={stat.label} stat={stat} index={index} refreshing={refreshing} format={metricFormat(stat.format,currency)}/>)}
  </section>
  <section className="dashboard-content">
   <RevenueSection label={revenueLabel} total={displayedTotal} growth={kpis.growth} manual={Boolean(manual)} data={visibleChart} metric={metric} refreshing={refreshing} currency={currency} onMetric={value=>setMetric(value)}/>
   {refreshing?<LiveSalesSkeleton/>:<LiveSalesTicker sales={periodSales} limit={state.preferences.sales.recentCount}/>}
  </section>
  <section className="dashboard-insight-grid">
   <Card><div className="insight-heading"><div><span className="section-eyebrow"><Wallet/> MEIOS DE PAGAMENTO</span><h2>Desempenho por canal</h2></div><span className="insight-caption">Participação no período</span></div><div className="payment-performance">{paymentStats.map(item=><div className="payment-performance-row" key={item.method}><div className="payment-performance-title"><b>{item.method}</b><span>{item.count} transações · {item.approved} aprovadas</span></div><div className="payment-bar"><i style={{width:`${Math.max(3,item.share)}%`}}/></div><strong>{item.total?money(item.total,currency):'—'}</strong></div>)}</div></Card>
   <Card><div className="insight-heading"><div><span className="section-eyebrow"><ArrowUpRight/> PERFORMANCE</span><h2>Produtos em destaque</h2></div></div><div className="dashboard-product-list">{topProducts.map((product,index)=><div key={product.id}><span>{String(index+1).padStart(2,'0')}</span><div><b>{product.name}</b><small>{product.sales} vendas · {money(product.price)}</small></div><strong>{money(product.revenue)}</strong></div>)}{!topProducts.length&&<div className="dashboard-inline-empty">Nenhum produto com vendas neste período.</div>}</div></Card>
  </section>
  <section className="dashboard-bottom-grid">
   <Card><div className="insight-heading"><div><span className="section-eyebrow"><i/> RELACIONAMENTO</span><h2>Top compradores</h2></div></div><div className="dashboard-buyers"><div className="dashboard-inline-empty">Nenhum comprador registrado neste período.</div></div></Card>
   <Card className="dashboard-alert-card"><div className="insight-heading"><div><span className="section-eyebrow"><ShieldAlert/> INTELIGÊNCIA</span><h2>Insights rápidos</h2></div></div><p><b>Nenhuma venda registrada neste período.</b> Os indicadores serão atualizados quando uma fonte autorizada registrar transações reais.</p></Card>
 </section>
 </div>
}
