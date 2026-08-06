import { useState } from 'react'
import { Activity, ArrowDownRight, BarChart3, Bell, CalendarDays, Check, ChevronDown, CircleDollarSign, CreditCard, Filter, LayoutDashboard, Menu, Package, RadioTower, Settings, ShoppingBag, TrendingUp, Users, WalletCards, X } from 'lucide-react'
import { SphexPayLogo } from '../components/branding/SphexPayLogo'
import { Card } from '../components/ui'
import { LiveSalesFeedContent } from '../components/dashboard/LiveSalesTicker'
import { PremiumStatCard, type PremiumStat } from '../components/dashboard/PremiumStatCard'
import { RevenueSection } from '../components/dashboard/RevenueSection'
import type { FinancialPoint, FinancialTransaction } from '../lib/dashboardFinance'
import { formatCents } from '../lib/currencyFormat'

const pointSeed=[
 {label:'Seg',revenueCents:1824000,sales:6},{label:'Ter',revenueCents:2940000,sales:9},{label:'Qua',revenueCents:2180000,sales:7},{label:'Qui',revenueCents:3760000,sales:12},{label:'Sex',revenueCents:4320000,sales:14},{label:'Sáb',revenueCents:3980000,sales:13},{label:'Hoje',revenueCents:3860400,sales:11},
]
const points:FinancialPoint[]=pointSeed.map((point,index)=>({...point,occurredAt:new Date(Date.now()-(6-index)*86400000).toISOString()}))
const sales:FinancialTransaction[]=[
 {transactionId:'preview-001',buyerName:'Cliente demonstração',productName:'Plano Scale',paymentMethod:'Pix',status:'approved',amountCents:129700,feeCents:6485,currency:'BRL',occurredAt:new Date().toISOString(),demo:true},
 {transactionId:'preview-002',buyerName:'Conta de teste',productName:'Oferta Pro',paymentMethod:'Cartão',status:'approved',amountCents:89700,feeCents:4485,currency:'BRL',occurredAt:new Date(Date.now()-18*60000).toISOString(),demo:true},
 {transactionId:'preview-003',buyerName:'Operação fictícia',productName:'Assinatura Plus',paymentMethod:'Pix',status:'approved',amountCents:59700,feeCents:2985,currency:'BRL',occurredAt:new Date(Date.now()-42*60000).toISOString(),demo:true},
]
const nav=[['Visão geral',LayoutDashboard],['Vendas ao vivo',RadioTower],['Vendas',ShoppingBag],['Produtos',Package],['Clientes',Users],['Financeiro',WalletCards],['Notificações',Bell],['Configurações',Settings]] as const

export default function DevDashboardPreview(){
 const [mobileOpen,setMobileOpen]=useState(false),[range,setRange]=useState('7 dias'),[tab,setTab]=useState('Receita')
 const stats:PremiumStat[]=[
  {label:'Faturamento demonstrativo',value:2486040,format:'money',delta:12.4,icon:CircleDollarSign,featured:true},
  {label:'Receita líquida demonstrativa',value:2141820,format:'money',delta:9.8,icon:WalletCards,featured:true},
  {label:'Vendas demonstrativas',value:72,format:'number',delta:6.2,icon:BarChart3},
  {label:'Ticket médio demonstrativo',value:34528,format:'money',delta:3.4,icon:CreditCard},
 ]
 const close=()=>setMobileOpen(false)
 return <div className="dev-preview-shell dashboard-preview-content" data-preview-theme="dark">
  <aside className={`dev-preview-sidebar ${mobileOpen?'open':''}`}>
   <div className="dev-preview-brand"><SphexPayLogo showName={mobileOpen} priority/><button className="btn btn-ghost icon-btn dev-preview-close" onClick={close} aria-label="Fechar menu"><X/></button></div>
   <div className="dev-preview-nav">{nav.map(([label,Icon],index)=><button key={label} className={`dev-preview-nav-item ${index===0?'active':''}`} title={label}><Icon/><span>{label}</span></button>)}</div>
   <div className="dev-preview-sidebar-foot"><span className="dev-preview-user-dot"/><span>Preview local</span></div>
  </aside>
  {mobileOpen&&<button className="dev-preview-backdrop" onClick={close} aria-label="Fechar menu"/>}
  <div className="dev-preview-viewport">
   <header className="dev-preview-topbar"><button className="btn btn-ghost icon-btn dev-preview-menu" onClick={()=>setMobileOpen(true)} aria-label="Abrir menu"><Menu/></button><div><span className="dev-preview-eyebrow">MODO DE PRÉ-VISUALIZAÇÃO</span><h1>Visão geral</h1><p>Dados demonstrativos para validar o novo layout.</p></div><div className="dev-preview-actions"><button className="btn dev-preview-filter"><CalendarDays/> Últimos 7 dias <ChevronDown/></button><span className="dev-preview-live"><i/> Preview local</span></div></header>
   <main className="dev-preview-main"><div className="dev-preview-notice"><Activity/> Nenhuma consulta, gravação ou ação financeira é executada nesta rota.</div><div className="dashboard-preview-heading"><div><span className="section-eyebrow"><TrendingUp/> RESUMO DA OPERAÇÃO</span><h2>Resultados em contexto</h2></div><div className="dashboard-preview-filters"><Filter/><span>Período</span>{['Hoje','7 dias','30 dias'].map(value=><button key={value} className={range===value?'active':''} onClick={()=>setRange(value)}>{value}</button>)}</div></div><section className="internal-dashboard-layout"><aside className="dashboard-preview-summary"><div className="dashboard-preview-balance"><span>Saldo disponível</span><strong>{formatCents(2141820,'BRL')}</strong><small><Check/> Atualizado nesta demonstração</small></div><div className="dashboard-preview-metrics">{stats.slice(0,2).map((stat,index)=><PremiumStatCard key={stat.label} stat={stat} index={index} refreshing={false} format={value=>formatCents(value,'BRL')}/>)}</div><div className="dashboard-preview-mini-list"><div><span>Pedidos aprovados</span><b>72</b></div><div><span>Taxa de conversão</span><b>84,6%</b></div><div><span>Ticket médio</span><b>{formatCents(34528,'BRL')}</b></div></div></aside><section className="dashboard-preview-chart-panel"><header><div><span className="section-eyebrow"><BarChart3/> RECEITA DEMONSTRATIVA</span><strong>{formatCents(2486040,'BRL')}</strong><small>+12,4% sobre o período anterior</small></div><div className="dashboard-preview-tabs">{['Receita','Pedidos','Conversão'].map(value=><button key={value} className={tab===value?'active':''} onClick={()=>setTab(value)}>{value}</button>)}</div></header><RevenueSection label={tab.toUpperCase()} totalCents={2486040} growth={.124} data={points} currency="BRL" loading={false} error="" planning/></section></section><section className="dashboard-preview-lower"><LiveSalesFeedContent sales={sales} displayCurrency="BRL" rates={[]} planning limit={3}/><Card className="dashboard-preview-activity"><div className="section-eyebrow"><ArrowDownRight/> ATIVIDADE DO PREVIEW</div><h2>Fluxo monitorado</h2><p>Os eventos exibidos são fixos e claramente demonstrativos.</p><div className="dashboard-preview-event"><i/><span>Sincronização visual<br/><small>Sem persistência ou chamadas externas</small></span></div><div className="dashboard-preview-event"><i/><span>Layout responsivo<br/><small>Desktop, tablet e mobile</small></span></div></Card></section></main>
  </div>
 </div>
}
