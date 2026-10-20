import {translate as uiText} from '../../i18n'
import {T,useTranslation} from '../../i18n'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, BadgePercent, Check, ChevronDown, Crown, LayoutGrid, LockKeyhole, Plug, Settings2, Trophy, UserRound } from 'lucide-react'
import type { PeriodFilter } from '../../types'
import type { Currency, ExchangeRate, FinancialPoint, FinancialTransaction } from '../../lib/dashboardFinance'
import { convertCents, maskBuyerName } from '../../lib/dashboardFinance'
import { formatCents } from '../../lib/currencyFormat'
import { useCompetition } from '../../hooks/useCompetition'
import { useAwardProgress } from '../../hooks/useAwardProgress'
import { useDemoStore } from '../../store/useDemoStore'
import { stripeConnectService, type StripeConnectStatus } from '../../services/stripeConnectService'
import { AnimatedMetric } from './AnimatedMetric'
import { DashboardPeriodFilter } from './DashboardControls'

type ReferenceMetrics = { approvedRevenueCents:number; approvedSales:number; averageTicketCents:number; feesCents:number; approvalRate:number; chargebacks:number }
type Props = {
 name:string;userId?:string;period:PeriodFilter;setPeriod:(period:PeriodFilter)=>void;currency:Currency;setCurrency:(currency:Currency)=>void
 metrics:ReferenceMetrics;series:FinancialPoint[];sales:FinancialTransaction[];rates:ExchangeRate[];eligibleRevenueCents:number
 loading:boolean;error:string;notice?:string;adminTools?:ReactNode;filterTools?:ReactNode;editor?:ReactNode;supplemental?:ReactNode
}
const daysLabel=(period:PeriodFilter)=>period.preset==='7d'?'Últimos 7 dias':period.preset==='30d'?'Últimos 30 dias':period.preset==='90d'?'Últimos 90 dias':period.preset==='today'?'Hoje':'Período selecionado'
const currencies:readonly [Currency,string][]=[['BRL','R$ BRL'],['EUR','€ EUR'],['USD','US$ USD']]

export function ReferenceDashboardView(props:Props){
 const {t}=useTranslation()

 const {name,userId,period,setPeriod,currency,setCurrency,metrics,series,sales,rates,eligibleRevenueCents,loading,error,notice,adminTools,filterTools,editor,supplemental}=props
 const {pathname}=useLocation(),root=pathname.startsWith('/dev/workspace-preview')?'/dev/workspace-preview':'/app'
 const competition=useCompetition(userId),achievements=useDemoStore(state=>state.achievements),award=useAwardProgress(eligibleRevenueCents/100,achievements)
 const refundCents=sales.filter(sale=>sale.status==='refunded').reduce((sum,sale)=>{const result=convertCents(sale.amountCents,sale.currency,currency,rates);return sum+(result?.amountCents??0)},0)
 const money=(value:number)=>formatCents(value,currency),periodText=t(daysLabel(period))
 return <div className="page-enter dashboard-page reference-dashboard">
  <div className="reference-greeting page-title"><h1><T>Olá, </T>{name}</h1></div>
  <ConnectionOverview userId={userId} financePath={`${root}/financeiro`}/>
  <div className="dashboard-filter-bar reference-filter-bar"><div className="reference-segments" role="group" aria-label={t('Período do dashboard')}>{(['7d','30d','90d'] as const).map(preset=><button type="button" key={preset} aria-pressed={period.preset===preset} onClick={()=>setPeriod({preset})}>{preset.slice(0,-1)}<T> dias</T></button>)}</div><div className="reference-segments" role="group" aria-label={t('Moeda do dashboard')}>{currencies.map(([value,label])=><button type="button" key={value} aria-pressed={currency===value} onClick={()=>setCurrency(value)}><T>{label}</T></button>)}</div><details className="reference-custom-period"><summary aria-label={t('Mais filtros')}><Settings2/></summary><div><DashboardPeriodFilter period={period} onChange={setPeriod} compact={false}/><div className="reference-admin-actions">{adminTools}</div>{filterTools}</div></details></div>
  {notice&&<p className="reference-data-notice" role="status">{notice}</p>}
  {error&&<p className="reference-data-notice" role="alert">{error}</p>}
  <section className="reference-progress-card"><BadgePercent aria-hidden="true"/><div><p>{award.next?<><T>Acompanhe sua próxima conquista, </T><strong>{award.next.title}</strong><T>. Seu progresso considera o faturamento elegível da sua operação.</T></>:<><T>Você alcançou todas as suas metas de faturamento. Continue acompanhando as conquistas da sua operação.</T></>}</p><div className="reference-progress"><span role="progressbar" aria-label={t('Progresso da próxima premiação')} aria-valuenow={Math.round(award.progress)} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${award.progress}%`}}/></span><small>{formatCents(eligibleRevenueCents,'BRL')}<T> de </T>{formatCents((award.next?.target??award.current)*100,'BRL')}</small></div></div></section>
  {editor??<>
   <div className="reference-overview-grid">
    <section className="reference-card reference-ranking"><header><span className="reference-card-icon"><Trophy/></span><div><h2><T>Ranking</T></h2><p><T>Competição SphexPay · vendas elegíveis</T></p></div></header><div className="reference-ranking-rows">{Array.from({length:3},(_,index)=>{
     const row=competition.standings[index],converted=row?convertCents(row.eligibleRevenueCents,'BRL',currency,rates):null
     return <div className="reference-ranking-row" key={row?.userId??index}><span className="reference-position">{index+1}º</span><span className="reference-ranking-avatar">{row&&index===0&&<Crown className="reference-ranking-crown"/>}{row?.avatarUrl?<img src={row.avatarUrl} alt=""/>:row?<span>{row.publicName[0]?.toUpperCase()}</span>:<UserRound/>}</span><span className="reference-ranking-name">{row?.publicName??t(competition.loading?'Carregando...':'Sem participante')}</span><strong>{row?formatCents(converted?.amountCents??row.eligibleRevenueCents,converted?currency:'BRL'):'—'}</strong></div>
    })}</div><Link className="reference-card-footer" to={`${root}/competicao`}>{t(competition.error?'Consultar ranking':'Ver ranking completo')}<ArrowRight/></Link></section>
    <section className="reference-metrics" aria-label={t('Indicadores do dashboard')}><div className="reference-card reference-revenue"><span><T>Receita</T></span><strong>{loading?'—':<AnimatedMetric value={metrics.approvedRevenueCents} format={money}/>}</strong><small>{periodText}</small></div><div className="reference-secondary-metrics"><Metric label="Conversão do checkout" value="—" caption={uiText("Visitas ainda não disponíveis")} positive/><Metric label="Vendas pagas" value={loading?'—':<AnimatedMetric value={metrics.approvedSales} format={value=>Math.round(value).toLocaleString('pt-BR')}/>} caption={periodText}/><Metric label="Ticket médio" value={loading?'—':<AnimatedMetric value={metrics.averageTicketCents} format={money}/>} caption={periodText}/><Metric label="Reembolsos" value={loading?'—':<AnimatedMetric value={refundCents} format={money}/>} caption={periodText}/></div></section>
   </div>
   <div className="reference-details-grid"><section className="reference-card reference-daily-revenue"><header><h2><T>Receita por dia</T></h2><span>{periodText}</span></header><div className="reference-daily-rows">{series.slice(-7).map(point=><div key={point.occurredAt}><span><T>{point.label}</T></span><strong>{money(point.revenueCents)}</strong><i style={{width:`${Math.max(0,point.revenueCents)/Math.max(1,...series.map(item=>item.revenueCents))*100}%`}}/></div>)}</div><Link className="reference-card-footer" to={`${root}/relatorios`}><T>Ver relatório completo</T><ArrowRight/></Link></section><section className="reference-card reference-recent-sales"><header><h2><T>Últimas vendas</T></h2><Link to={`${root}/vendas`}><T>Ver todas</T><ArrowRight/></Link></header>{sales.length?<div>{sales.slice(0,5).map(sale=><Link className="reference-sale" key={sale.transactionId} to={`${root}/vendas${sale.demo?'':`/${encodeURIComponent(sale.transactionId)}`}`}><span><strong>{maskBuyerName(sale.buyerName)}</strong><small>{sale.productName}</small></span><b>{formatCents(sale.amountCents,sale.currency)}</b></Link>)}</div>:<p className="reference-sales-empty"><T>Nenhuma venda recebida ainda. Conecte seu provedor para acompanhar as transações neste painel.</T></p>}</section></div>
   <section className="reference-card reference-operation-summary"><header><span className="reference-card-icon"><LayoutGrid/></span><div><h2><T>Resumo da operação</T></h2><p>{periodText}</p></div></header><dl><div><dt><T>Taxas no período</T></dt><dd>{money(metrics.feesCents)}</dd></div><div><dt><T>Resultado líquido</T></dt><dd>{money(Math.max(0,metrics.approvedRevenueCents-metrics.feesCents))}</dd></div><div><dt><T>Taxa de aprovação</T></dt><dd>{(metrics.approvalRate*100).toFixed(1)}%</dd></div><div><dt><T>Chargebacks</T></dt><dd>{metrics.chargebacks}</dd></div></dl></section>
  </>}
  {supplemental}
 </div>
}
function Metric({label,value,caption,positive=false}:{label:string;value:ReactNode;caption:string;positive?:boolean}){const {t}=useTranslation();return <div className={`reference-card reference-metric${positive?' positive':''}`}><span>{t(label)}</span><strong>{value}</strong><small>{t(caption)}</small></div>}
function ConnectionOverview({userId,financePath}:{userId?:string;financePath:string}){
 const {t}=useTranslation()
 const [status,setStatus]=useState<StripeConnectStatus|null>(null),[pending,setPending]=useState(Boolean(userId))
 useEffect(()=>{if(!userId){setStatus(null);setPending(false);return}let active=true;setStatus(null);setPending(true);stripeConnectService.status().then(value=>{if(active)setStatus(value)}).catch(()=>{if(active)setStatus(null)}).finally(()=>{if(active)setPending(false)});return()=>{active=false}},[userId])
 const enabled=Boolean(status?.chargesEnabled),title=pending?'Verificando conexão':enabled?'Conta de pagamentos conectada':status?.connected?'Revise sua conexão':!userId||status?.onboardingStatus==='not_connected'?'Nenhuma conexão ainda':'Configure seus recebimentos'
 return <section className="reference-connection-card"><div className="reference-connection-info"><span className="reference-connection-icon">{enabled?<Check/>:<Plug/>}</span><div><h2>{t(title)}</h2><p>{t(enabled?'Acompanhe suas vendas, resultados e recebimentos em uma única visão.':'Conecte um provedor de pagamentos. Suas vendas passam a aparecer neste painel em tempo real.')}</p></div></div><Link className="reference-button" to={financePath}>{t(enabled?'Gerenciar conexão':'Conectar provedor')}<ArrowRight/></Link></section>
}

export function ReferenceOperationLinks(){const {t}=useTranslation();const {pathname}=useLocation(),root=pathname.startsWith('/dev/workspace-preview')?'/dev/workspace-preview':'/app';return <section className="reference-operation-links"><header><span><T>ESTRUTURA SPHEXPAY</T></span><h2><T>O controle da sua operação,</T><br/><T>em um só lugar.</T></h2></header><div>{[['01','Organize suas ofertas','Gerencie produtos, checkouts e links de pagamento.','/app/produtos'],['02','Acompanhe seus resultados','Consulte vendas, receitas e relatórios em uma visão clara.','/app/relatorios'],['03','Configure seus recebimentos','Revise sua conexão e acompanhe seu financeiro.','/app/financeiro']].map(([step,title,text,path])=><Link key={step} to={path.replace(/^\/app/,root)}><small>{step}</small><h3>{t(title)}</h3><p>{t(text)}</p><ArrowRight/></Link>)}</div><details><summary><T>Onde acompanho minhas vendas?</T><ChevronDown/></summary><p><T>Acesse Vendas no menu superior. O painel mostra as transações disponíveis da sua operação.</T></p></details><details><summary><T>Como altero a aparência?</T><ChevronDown/></summary><p><T>Acesse Configurações → Preferências → Aparência para escolher o modo claro, escuro ou automático.</T></p></details><footer><LockKeyhole/><T> SphexPay · sua operação, sob seu controle.</T></footer></section>}
