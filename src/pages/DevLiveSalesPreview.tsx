import { useMemo,useState } from 'react'
import { Activity,ArrowUpRight,CalendarDays,ChevronDown,Filter,LayoutDashboard,Menu,Package,Radio,RadioTower,Settings,ShoppingBag,Users,WalletCards,X } from 'lucide-react'
import { Card } from '../components/ui'
import { SphexPayLogo } from '../components/branding/SphexPayLogo'
import { WorldSalesMap } from '../components/live-sales/WorldSalesMap'
import { Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts'
import { convertDemoCents } from '../demo/demoSimulationEngine'
import { formatCents } from '../lib/currencyFormat'
import { globalEventFromTransaction,regionTotals,relativeSaleTime } from '../lib/liveSalesMap'
import type { FinancialTransaction } from '../lib/dashboardFinance'

type PreviewTransaction=FinancialTransaction&{countryCode:string}
const previewTransactions:PreviewTransaction[]=[
 {transactionId:'live-preview-001',buyerName:'Cliente demonstração',productName:'Plano Scale',paymentMethod:'Pix',status:'approved',amountCents:129700,feeCents:6485,currency:'BRL',occurredAt:new Date().toISOString(),demo:true,countryCode:'BR'},
 {transactionId:'live-preview-002',buyerName:'Conta de teste',productName:'Oferta Pro',paymentMethod:'Cartão',status:'approved',amountCents:89700,feeCents:4485,currency:'BRL',occurredAt:new Date(Date.now()-8*60000).toISOString(),demo:true,countryCode:'US'},
 {transactionId:'live-preview-003',buyerName:'Operação fictícia',productName:'Assinatura Plus',paymentMethod:'Pix',status:'approved',amountCents:59700,feeCents:2985,currency:'BRL',occurredAt:new Date(Date.now()-21*60000).toISOString(),demo:true,countryCode:'PT'},
 {transactionId:'live-preview-004',buyerName:'Conta de teste',productName:'Checkout Express',paymentMethod:'Cartão',status:'pending',amountCents:43800,feeCents:2190,currency:'BRL',occurredAt:new Date(Date.now()-34*60000).toISOString(),demo:true,countryCode:'DE'},
 {transactionId:'live-preview-005',buyerName:'Cliente demonstração',productName:'Plano Growth',paymentMethod:'Pix',status:'approved',amountCents:182400,feeCents:9120,currency:'BRL',occurredAt:new Date(Date.now()-48*60000).toISOString(),demo:true,countryCode:'GB'},
]
const nav=[['Visão geral',LayoutDashboard],['Vendas ao vivo',RadioTower],['Vendas',ShoppingBag],['Produtos',Package],['Clientes',Users],['Financeiro',WalletCards],['Configurações',Settings]] as const

export default function DevLiveSalesPreview(){
 const [mobileOpen,setMobileOpen]=useState(false),[range,setRange]=useState('Hoje'),[status,setStatus]=useState('Todos')
 const events=useMemo(()=>previewTransactions.map(globalEventFromTransaction).filter(event=>status==='Todos'||(status==='Confirmadas'?event.transaction.status==='approved':event.transaction.status==='pending')),[status])
 const approved=events.filter(event=>event.transaction.status==='approved')
 const total=approved.reduce((sum,event)=>sum+convertDemoCents(event.transaction.amountCents,event.transaction.currency,'BRL'),0)
 const regions=regionTotals(events)
 const close=()=>setMobileOpen(false)
 return <div className="dev-live-preview-shell" data-preview-theme="dark">
  <aside className={`dev-live-preview-sidebar ${mobileOpen?'open':''}`}>
   <div className="dev-live-preview-brand"><SphexPayLogo showName={mobileOpen} priority/><button className="btn btn-ghost icon-btn dev-live-preview-close" onClick={close} aria-label="Fechar menu"><X/></button></div>
   <nav className="dev-live-preview-nav" aria-label="Módulos do preview">{nav.map(([label,Icon],index)=><button type="button" key={label} className={`dev-live-preview-nav-item ${index===1?'active':''}`} title={label}><Icon/><span>{label}</span></button>)}</nav>
   <div className="dev-live-preview-user"><i/> Preview local</div>
  </aside>
  {mobileOpen&&<button type="button" className="dev-live-preview-backdrop" onClick={close} aria-label="Fechar menu"/>}
  <div className="dev-live-preview-main">
   <header className="dev-live-preview-topbar"><button type="button" className="btn btn-ghost icon-btn dev-live-preview-menu" onClick={()=>setMobileOpen(true)} aria-label="Abrir menu"><Menu/></button><div className="dev-live-preview-title"><span>MODO DE PRÉ-VISUALIZAÇÃO</span><h1>Vendas ao Vivo</h1><p>Uma leitura visual dos movimentos globais da operação.</p></div><div className="dev-live-preview-actions"><button type="button" className="dev-live-preview-date"><CalendarDays/> {range}<ChevronDown/></button><span className="dev-live-preview-status"><i/> Preview local</span></div></header>
   <main className="dev-live-preview-content">
    <div className="dev-live-preview-notice"><Activity/> Nenhuma consulta, gravação ou ação financeira é executada nesta rota.</div>
    <section className="dev-live-preview-heading"><div><span>REDE GLOBAL SPHEX</span><h2>Operação em movimento</h2><p>Eventos demonstrativos distribuídos por região, com leitura rápida do que acontece agora.</p></div><div className="dev-live-preview-filters"><Filter/><label htmlFor="live-range">Período</label><select id="live-range" value={range} onChange={event=>setRange(event.target.value)}><option>Hoje</option><option>7 dias</option><option>30 dias</option></select><label htmlFor="live-status">Status</label><select id="live-status" value={status} onChange={event=>setStatus(event.target.value)}><option>Todos</option><option>Confirmadas</option><option>Processando</option></select></div></section>
    <section className="dev-live-preview-kpis" aria-label="Resumo de vendas ao vivo"><Kpi label="Vendas confirmadas" value={String(approved.length)} detail="nesta demonstração"/><Kpi label="Valor movimentado" value={formatCents(total,'BRL')} detail="volume ilustrativo"/><Kpi label="Destinos ativos" value={String(new Set(events.map(event=>event.country.name)).size)} detail="países monitorados"/><Kpi label="Status da rede" value="Estável" detail="atualização visual"/></section>
    <section className="dev-live-preview-layout"><Card className="dev-live-preview-map"><header><div><span>MAPA DE ATIVIDADE</span><h2>Alcance global</h2><p>Rotas e destinos recentes da operação.</p></div><span className="dev-live-preview-live"><i/> Ao vivo</span></header><WorldSalesMap events={events}/></Card><Card className="dev-live-preview-feed"><header><div><span>ATIVIDADE AO VIVO</span><h2>Últimos eventos</h2></div><Radio/></header><div className="dev-live-preview-feed-list">{events.map(event=><article key={event.transaction.transactionId}><span className="dev-live-preview-dot"/><div><strong>{event.country.name}</strong><p>{event.activity} · {event.transaction.productName}</p><small>{relativeSaleTime(event.occurredAt)}</small></div><div><b>{formatCents(event.transaction.amountCents,event.transaction.currency)}</b><em className={event.transaction.status}>{event.statusLabel}</em></div></article>)}</div></Card></section>
    <Card className="dev-live-preview-regions"><header><div><span>DISTRIBUIÇÃO REGIONAL</span><h2>Onde a operação está acontecendo</h2></div><small>{events.length} eventos demonstrativos</small></header><div className="dev-live-preview-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={regions} margin={{top:10,right:8,left:-20,bottom:0}}><CartesianGrid stroke="var(--internal-border-subtle)" vertical={false}/><XAxis dataKey="region" tick={{fill:'var(--internal-text-muted)',fontSize:9}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fill:'var(--internal-text-muted)',fontSize:9}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:'var(--internal-surface-2)',border:'1px solid var(--internal-border-default)',borderRadius:10,fontSize:11,color:'var(--internal-text-primary)'}}/><Bar dataKey="total" name="Eventos" fill="var(--internal-accent)" radius={[6,6,2,2]}/></BarChart></ResponsiveContainer></div></Card>
   </main>
  </div>
 </div>
}

function Kpi({label,value,detail}:{label:string;value:string;detail:string}){return <Card className="dev-live-preview-kpi"><span>{label}</span><strong>{value}</strong><small><ArrowUpRight/> {detail}</small></Card>}
