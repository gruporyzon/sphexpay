import { useEffect,useMemo,useRef,useState } from 'react'
import { ArrowDownRight,ArrowUpRight,BadgeDollarSign,CircleDollarSign,CreditCard,Filter,Percent,ReceiptText,RefreshCcw,RotateCcw,ShieldAlert,Wallet } from 'lucide-react'
import { Avatar,Card,PageTitle } from '../components/ui'
import { money } from '../lib/utils'
import { useDemoStore } from '../store/useDemoStore'
import type { DashboardKpis } from '../types'
import { chartForPeriod,filterSales,periodRatio,smartMetrics } from '../services/analyticsService'
import { NextAwardCard } from '../components/dashboard/NextAwardCard'
import { OverviewHeroCarousel } from '../components/dashboard/OverviewHeroCarousel'
import { DashboardScenarioEditor } from '../components/dashboard/DashboardScenarioEditor'
import { periodRevenueLabel } from '../lib/dashboardIntelligence'
import { PremiumStatCard,type PremiumStat } from '../components/dashboard/PremiumStatCard'
import { RevenueSection,type PerformanceMetric } from '../components/dashboard/RevenueSection'
import { LiveSalesSkeleton,LiveSalesTicker } from '../components/dashboard/LiveSalesTicker'
import { DemoModeBadge } from '../components/dashboard/DemoModeBadge'
import { getDashboardDataMode,selectDashboardSales } from '../services/dashboardDataSource'

type MetricKey=PerformanceMetric

const number=(value:number)=>Math.round(value).toLocaleString('pt-BR')
const metricFormat=(format:PremiumStat['format'])=>(value:number)=>format==='money'?money(value):format==='percent'?`${value.toFixed(1)}%`:number(value)

export default function Dashboard(){
 const state=useDemoStore()
 const [metric,setMetric]=useState<MetricKey>('revenue')
 const [typeFilter,setTypeFilter]=useState('Todos')
 const [productFilter,setProductFilter]=useState('Todos')
 const [updated,setUpdated]=useState('Agora')
 const [refreshing,setRefreshing]=useState(false)
 const refreshTimer=useRef<number|undefined>(undefined)
 const mode=getDashboardDataMode()
 const sourceSales=selectDashboardSales(state.sales,mode)
 useEffect(()=>()=>{if(refreshTimer.current)window.clearTimeout(refreshTimer.current)},[])
 const periodSales=useMemo(()=>filterSales(sourceSales,state.period).filter(sale=>(typeFilter==='Todos'||sale.method===typeFilter)&&(productFilter==='Todos'||sale.product===productFilter)),[sourceSales,state.period,typeFilter,productFilter])
 const activeSubscriptions=mode==='demo'?state.subscriptions.filter(item=>item.status==='Ativa'):[]
 const calculated=useMemo(()=>smartMetrics(periodSales,activeSubscriptions.length),[periodSales,activeSubscriptions.length])
 const visibleChart=useMemo(()=>chartForPeriod(state.chart,state.period).map(point=>mode==='demo'?point:{...point,revenue:0,profit:0,sales:0}),[state.chart,state.period,mode])
 const ratio=useMemo(()=>periodRatio(state.chart,state.period),[state.chart,state.period])
 const chartTotal=useMemo(()=>visibleChart.reduce((sum,point)=>sum+point[metric],0),[visibleChart,metric])
 const previousTotal=useMemo(()=>mode==='production'?0:state.chart.slice(Math.max(0,state.chart.length-visibleChart.length*2),Math.max(0,state.chart.length-visibleChart.length)).reduce((sum,point)=>sum+point[metric],0),[state.chart,visibleChart.length,metric,mode])
 const chartGrowth=previousTotal?(chartTotal-previousTotal)/previousTotal*100:12.8
 const manual=mode==='demo'&&state.dashboardScenario?.preset===state.period.preset?state.dashboardScenario:undefined
 const baseline:DashboardKpis=useMemo(()=>{
  const revenue=calculated.revenue||(mode==='demo'?state.revenue*ratio:0)
  const sales=calculated.total||Math.max(1,Math.round(revenue/Math.max(1,calculated.ticket||380)))
  const ticket=sales?revenue/sales:0
  const goal=state.goal
  return{revenue,sales:revenue?sales:0,ticket,goal,progress:Math.min(100,revenue/Math.max(1,goal)*100),approval:calculated.approval||(mode==='demo'?96.8:0),pending:calculated.pending||(mode==='demo'?state.pending*ratio:0),profit:revenue*.72,growth:revenue?chartGrowth:0}
 },[calculated,state.revenue,state.pending,state.goal,ratio,chartGrowth,mode])
 const kpis=manual??baseline
 const recurringRevenue=activeSubscriptions.reduce((sum,item)=>sum+item.amount,0)
 const revenueLabel=periodRevenueLabel(state.period)
 const metrics:PremiumStat[]=[
  {label:revenueLabel,value:kpis.revenue,format:'money',delta:kpis.growth,icon:CircleDollarSign,featured:true},
  {label:'Saldo disponível',value:mode==='demo'?state.available:0,format:'money',delta:8.4,icon:Wallet,featured:true},
  {label:'Saldo pendente',value:kpis.pending,format:'money',delta:3.2,icon:BadgeDollarSign,featured:true},
  {label:'Total de vendas',value:kpis.sales,format:'number',delta:6.7,icon:ReceiptText},
  {label:'Ticket médio',value:kpis.ticket,format:'money',delta:2.1,icon:CreditCard},
  {label:'Taxa de aprovação',value:kpis.approval,format:'percent',delta:1.4,icon:Percent},
  {label:'Assinaturas ativas',value:calculated.recurring,format:'number',delta:9.2,icon:RotateCcw},
  {label:'Receita recorrente',value:recurringRevenue,format:'money',delta:5.4,icon:RotateCcw},
  {label:'Reembolsos',value:calculated.refunds,format:'number',delta:-.8,icon:ArrowDownRight},
  {label:'Chargebacks',value:0,format:'number',delta:0,icon:ShieldAlert}
 ]
 const paymentMethods=['Pix','Cartão de crédito','Boleto','Assinatura','Link de pagamento']
 const paymentStats=paymentMethods.map(method=>{const rows=periodSales.filter(sale=>sale.method===method),total=rows.reduce((sum,sale)=>sum+(sale.status==='Aprovado'?sale.amount:0),0),approved=rows.filter(sale=>sale.status==='Aprovado').length;return{method,total,approved,count:rows.length,share:periodSales.length?rows.length/periodSales.length*100:0}})
 const topProducts=mode==='demo'?[...state.products].sort((a,b)=>b.revenue-a.revenue).slice(0,4):[]
 const displayedTotal=metric==='revenue'?kpis.revenue:metric==='profit'?kpis.profit:kpis.sales
 const refresh=()=>{setRefreshing(true);setUpdated('Sincronizando');if(refreshTimer.current)window.clearTimeout(refreshTimer.current);refreshTimer.current=window.setTimeout(()=>{setRefreshing(false);setUpdated('Atualizado agora')},520)}

 return <div className="page-enter dashboard-page">
  <OverviewHeroCarousel/>
  <PageTitle title="Visão geral" subtitle="Performance, ritmo de vendas e decisões em uma visão executiva." action={<div className="dashboard-header-actions"><DemoModeBadge mode={mode}/>{mode==='demo'&&<DashboardScenarioEditor kpis={kpis} onSave={changes=>state.applyDashboardScenario(kpis,changes,state.period)}/>}</div>}/>
  <Card className="dashboard-filter-bar">
   <div className="dashboard-filter-title"><Filter size={16}/><div><b>Leitura do painel</b><span>Refine os indicadores da operação</span></div></div>
   <label><span>Tipo</span><select value={typeFilter} onChange={event=>setTypeFilter(event.target.value)}><option>Todos</option>{['Pix','Cartão de crédito','Boleto','Assinatura'].map(value=><option key={value}>{value}</option>)}</select></label>
   <label><span>Produtos</span><select value={productFilter} onChange={event=>setProductFilter(event.target.value)}><option>Todos</option>{(mode==='demo'?state.products:[]).map(product=><option key={product.id}>{product.name}</option>)}</select></label>
   <label><span>Período</span><select value={state.period.preset} onChange={event=>state.setPeriod({...state.period,preset:event.target.value as typeof state.period.preset})}><option value="today">Hoje</option><option value="7d">Últimos 7 dias</option><option value="30d">Últimos 30 dias</option><option value="month">Este mês</option><option value="lastMonth">Mês passado</option><option value="custom">Personalizado</option></select></label>
   <button className="btn dashboard-refresh" onClick={refresh} disabled={refreshing}><RefreshCcw className={refreshing?'spin':''}/> Atualizar <small>{updated}</small></button>
  </Card>
  <NextAwardCard currentRevenue={mode==='demo'?state.revenue:0}/>
  <section className={`dashboard-metrics ${refreshing?'is-loading':''}`} aria-label="Indicadores financeiros">
   {metrics.map((stat,index)=><PremiumStatCard key={stat.label} stat={stat} index={index} refreshing={refreshing} format={metricFormat(stat.format)} onRevenueEdit={mode==='demo'?revenue=>state.applyDashboardScenario(kpis,{revenue},state.period):undefined}/>)}
  </section>
  <section className="dashboard-content">
   <RevenueSection label={revenueLabel} total={displayedTotal} growth={kpis.growth} manual={Boolean(manual)} data={visibleChart} metric={metric} refreshing={refreshing} onMetric={value=>setMetric(value)} onChartPoint={value=>state.updateChart(state.chart.length-1,value)}/>
   {refreshing?<LiveSalesSkeleton/>:<LiveSalesTicker sales={periodSales} live={mode==='demo'&&state.liveSales} limit={state.preferences.sales.recentCount} mode={mode} onToggle={mode==='demo'?()=>state.setLiveSales(!state.liveSales):undefined}/>}
  </section>
  <section className="dashboard-insight-grid">
   <Card><div className="insight-heading"><div><span className="section-eyebrow"><Wallet/> MEIOS DE PAGAMENTO</span><h2>Desempenho por canal</h2></div><span className="insight-caption">Participação no período</span></div><div className="payment-performance">{paymentStats.map(item=><div className="payment-performance-row" key={item.method}><div className="payment-performance-title"><b>{item.method}</b><span>{item.count} transações · {item.approved} aprovadas</span></div><div className="payment-bar"><i style={{width:`${Math.max(3,item.share)}%`}}/></div><strong>{item.total?money(item.total):'—'}</strong></div>)}</div></Card>
   <Card><div className="insight-heading"><div><span className="section-eyebrow"><ArrowUpRight/> PERFORMANCE</span><h2>Produtos em destaque</h2></div></div><div className="dashboard-product-list">{topProducts.map((product,index)=><div key={product.id}><span>{String(index+1).padStart(2,'0')}</span><div><b>{product.name}</b><small>{product.sales} vendas · {money(product.price)}</small></div><strong>{money(product.revenue)}</strong></div>)}</div></Card>
  </section>
  <section className="dashboard-bottom-grid">
   <Card><div className="insight-heading"><div><span className="section-eyebrow"><i/> RELACIONAMENTO</span><h2>Top compradores</h2></div></div><div className="dashboard-buyers">{(mode==='demo'?state.customers:[]).slice(0,4).map(customer=><div key={customer.id}><Avatar name={customer.name}/><span><b>{customer.name}</b><small>{customer.purchases} compras</small></span><strong>{money(customer.spent)}</strong></div>)}</div></Card>
   <Card className="dashboard-alert-card"><div className="insight-heading"><div><span className="section-eyebrow"><ShieldAlert/> INTELIGÊNCIA</span><h2>Insights rápidos</h2></div></div><p><b>{kpis.progress>=100?'Meta do período alcançada.':`${kpis.progress.toFixed(1)}% da meta concluída.`}</b> {kpis.progress>=100?'O cenário atual superou o objetivo configurado.':`${money(Math.max(0,kpis.goal-kpis.revenue))} separam a operação da meta.`}</p><p><b>Receita recorrente em destaque.</b> As assinaturas ativas representam {money(recurringRevenue)} por ciclo.</p></Card>
 </section>
 </div>
}
