import { useState } from 'react'
import { Activity, BarChart3, Bell, CalendarDays, ChevronDown, CircleDollarSign, CreditCard, LayoutDashboard, Menu, Package, RadioTower, Settings, ShoppingBag, Users, WalletCards, X } from 'lucide-react'
import { SphexPayLogo } from '../components/branding/SphexPayLogo'
import { DashboardOverviewVisual } from '../components/dashboard/DashboardOverviewVisual'
import type { PremiumStat } from '../components/dashboard/PremiumStatCard'
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
 const [mobileOpen,setMobileOpen]=useState(false),[tab,setTab]=useState('Receita')
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
   <main className="dev-preview-main"><div className="dev-preview-notice"><Activity/> Nenhuma consulta, gravação ou ação financeira é executada nesta rota.</div><DashboardOverviewVisual stats={stats} formatMetric={format=>value=>format==='money'?formatCents(value,'BRL'):format==='percent'?`${value.toFixed(1)}%`:Math.round(value).toLocaleString('pt-BR')} balanceCents={2141820} currency="BRL" chartLabel={tab.toUpperCase()} chartTotalCents={2486040} growth={.124} data={points} loading={false} error="" planning feed={sales} rates={[]} heading="Resultados em contexto" eyebrow="RESUMO DA OPERAÇÃO" showPeriodFilters tabs={['Receita','Pedidos','Conversão'].map(label=>({label,active:tab===label,onSelect:()=>setTab(label)}))} activity={{title:'ATIVIDADE DO PREVIEW',description:'Fluxo monitorado',items:[{label:'Sincronização visual',detail:'Sem persistência ou chamadas externas'},{label:'Layout responsivo',detail:'Desktop, tablet e mobile'}]}}/></main>
  </div>
 </div>
}
