import {translate as uiText} from '../i18n'
import {useAppLocale} from '../i18n/localeStore'
import {T} from '../i18n'
import { useEffect,useMemo,useState } from 'react'
import { Activity,ArrowUpRight,Globe2,MapPin,Radio,Trophy } from 'lucide-react'
import { Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts'
import { Card,PageTitle } from '../components/ui'
import { WorldSalesMap } from '../components/live-sales/WorldSalesMap'
import { useAuth } from '../hooks/useAuth'
import { useLiveSales } from '../hooks/useLiveSales'
import { convertDemoCents } from '../demo/demoSimulationEngine'
import { formatCents } from '../lib/currencyFormat'
import { globalEventFromTransaction,regionTotals,relativeSaleTime } from '../lib/liveSalesMap'
import { useDashboardData } from '../providers/DashboardDataProvider'
import type { PeriodFilter } from '../types'

const today:PeriodFilter={preset:'today'}

export default function LiveSalesWorld(){useAppLocale(state=>state.locale);
 const {user}=useAuth(),mode=useDashboardData(),live=useLiveSales(user?.id,today),[clock,setClock]=useState(Date.now())
 useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer)},[])
 const events=useMemo(()=>live.sales.filter(transaction=>transaction.demo).map(globalEventFromTransaction),[live.sales])
 const approved=events.filter(event=>event.transaction.status==='approved')
 const total=approved.reduce((sum,event)=>sum+convertDemoCents(event.transaction.amountCents,event.transaction.currency,'BRL'),0)
 const countries=new Set(events.map(event=>event.country.name)),destination=events.reduce<Record<string,number>>((result,event)=>({...result,[event.country.name]:(result[event.country.name]??0)+1}),{})
 const topDestination=Object.entries(destination).sort((a,b)=>b[1]-a[1])[0]?.[0]??'—'
 const chart=regionTotals(events),recentHour=events.filter(event=>clock-new Date(event.occurredAt).getTime()<3_600_000).length,previousHour=events.filter(event=>{const age=clock-new Date(event.occurredAt).getTime();return age>=3_600_000&&age<7_200_000}).length
 const growth=previousHour?Math.round((recentHour-previousHour)/previousHour*100):recentHour?100:0
 return <div className="live-world-page page-enter">
  <PageTitle title={uiText("Vendas ao Vivo")} subtitle={uiText("Acompanhe transações globais em tempo real")} action={<div className="live-world-head-actions"><span className="live-world-status"><i/><T> Ao vivo</T></span></div>}/>
  <section className="live-world-kpis" aria-label={uiText("Indicadores globais")}>
   <Kpi icon={Activity} label="Vendas ao vivo" value={String(approved.length)} detail="confirmadas hoje"/>
   <Kpi icon={ArrowUpRight} label="Valor movimentado" value={formatCents(total,'BRL')} detail="total global"/>
   <Kpi icon={Globe2} label="Países alcançados" value={String(countries.size)} detail="destinos ativos"/>
   <Kpi icon={MapPin} label="Maior destino" value={topDestination} detail="no momento"/>
   <Kpi icon={Trophy} label="Atividade" value={`${growth>=0?'+':''}${growth}%`} detail="última hora"/>
  </section>
  <div className="live-world-layout">
   <Card className="live-world-map-card"><header><div><span><T>REDE GLOBAL SPHEXPAY</T></span><h2><T>Operação internacional</T></h2><p><T>Fluxos recentes a partir da sua operação</T></p></div><small><i/><T> Atualização automática</T></small></header><WorldSalesMap events={events}/></Card>
   <Card className="live-world-feed"><header><div><span><T>ATIVIDADE AO VIVO</T></span><h2><T>Últimas transações</T></h2></div><Radio/></header><div className="live-world-feed-list scrollbar">{events.slice(0,10).map(event=><article key={event.transaction.transactionId}><span className="live-world-flag" aria-hidden="true">{event.country.flag}</span><div><strong>{event.country.name}</strong><p>{event.activity} · {event.transaction.productName}</p><small>{relativeSaleTime(event.occurredAt,clock)}</small></div><div><b>{formatCents(event.transaction.amountCents,event.transaction.currency)}</b><span className={`live-world-event-status ${event.transaction.status}`}>{event.statusLabel}</span></div></article>)}{!events.length&&<div className="live-world-feed-empty"><Globe2/><strong><T>Nenhuma atividade global agora</T></strong><p><T>{mode.active?'A próxima venda aparecerá automaticamente.':'Configure a atividade em Configurações → Modo.'}</T></p></div>}</div></Card>
  </div>
  <Card className="live-world-regions"><header><div><span><T>FLUXO POR REGIÃO</T></span><h2><T>Distribuição das transações de hoje</T></h2></div><small>{events.length}<T> eventos monitorados</T></small></header><div className="live-world-chart"><ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}><BarChart data={chart} margin={{top:10,right:8,left:-24,bottom:2}}><CartesianGrid stroke="var(--line)" vertical={false}/><XAxis dataKey="region" tick={{fill:'var(--muted)',fontSize:9}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fill:'var(--muted)',fontSize:9}} axisLine={false} tickLine={false}/><Tooltip cursor={{fill:'var(--orange-soft)'}} contentStyle={{background:'var(--panel)',border:'1px solid var(--line)',borderRadius:12,fontSize:10}}/><Bar dataKey="total" name="Transações" fill="var(--orange)" radius={[7,7,2,2]}/></BarChart></ResponsiveContainer></div></Card>
  {live.error&&<p className="live-world-error" role="alert">{live.error}</p>}
 </div>
}

function Kpi({icon:Icon,label,value,detail}:{icon:typeof Activity;label:string;value:string;detail:string}){useAppLocale(state=>state.locale);
 return <Card><Icon/><span><small><T>{label}</T></small><strong>{value}</strong><em>{detail}</em></span></Card>
}
