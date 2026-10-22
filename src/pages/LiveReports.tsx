import {translate as uiText} from '../i18n'
import {useAppLocale} from '../i18n/localeStore'
import {T} from '../i18n'
import { useMemo,useState } from 'react'
import { NavLink,useLocation } from 'react-router-dom'
import { Area,AreaChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts'
import { Download,FileBarChart,RotateCcw,ShoppingCart,Target,Users } from 'lucide-react'
import { Card,Empty,Loading,PageTitle,StateMessage } from '../components/ui'
import { PeriodSelector } from '../components/common/PeriodSelector'
import { breakdownBy,centsMoney,methodLabel,revenueSeries,summarizeTransactions } from '../features/finance/financeSummary'
import { useFinanceData } from '../features/finance/useFinanceData'
import { downloadCsv,money } from '../lib/utils'
const STATUS:Record<string,string>={approved:'Aprovado',pending:'Pendente',declined:'Recusado',refunded:'Reembolsado',chargeback:'Contestado'}
import DemoAwareCustomers from './DemoCustomers'
import { AbandonedCheckouts } from '../features/customers/RealCustomers'
export default function ReportsModule(){useAppLocale(state=>state.locale);const {pathname}=useLocation(),customersActive=pathname.includes('/clientes'),cartsActive=pathname.includes('/carrinhos');return <div className="page-enter reports-module"><PageTitle title={uiText("Relatórios")} subtitle={uiText("Indicadores, análises e relacionamento com clientes.")}/><nav className="reports-module-tabs" aria-label={uiText("Áreas de Relatórios")} role="tablist"><NavLink end to="/app/relatorios" role="tab" aria-selected={!customersActive&&!cartsActive}><FileBarChart/><T> Visão geral</T></NavLink><NavLink to="/app/relatorios/clientes" role="tab" aria-selected={customersActive}><Users/><T> Clientes</T></NavLink><NavLink to="/app/relatorios/carrinhos" role="tab" aria-selected={cartsActive}><ShoppingCart/><T> Carrinhos abandonados</T></NavLink></nav>{customersActive?<DemoAwareCustomers/>:cartsActive?<AbandonedCheckouts/>:<ReportsOverview/>}</div>}

export function ReportsOverview(){useAppLocale(state=>state.locale)
 const {bounds,transactions,transactionsError,reload}=useFinanceData({stripe:false}),[view,setView]=useState<'revenue'|'sales'>('revenue')
 const rows=useMemo(()=>transactions||[],[transactions])
 const summary=useMemo(()=>summarizeTransactions(rows),[rows]),series=useMemo(()=>revenueSeries(rows,bounds),[rows,bounds])
 const products=useMemo(()=>breakdownBy(rows,row=>row.productName).slice(0,6),[rows]),methods=useMemo(()=>breakdownBy(rows,row=>methodLabel(row.paymentMethod)),[rows])
 const chart=useMemo(()=>series.map(point=>({label:point.label,value:view==='revenue'?point.revenueCents/100:point.sales})),[series,view])
 const exportRows=useMemo(()=>rows.map(row=>({data:new Date(row.occurredAt).toLocaleString('pt-BR'),produto:row.productName,cliente:row.buyerName||'',metodo:methodLabel(row.paymentMethod),status:STATUS[row.status]||row.status,moeda:row.currency,valor:(row.amountCents/100).toFixed(2),taxa:(row.feeCents/100).toFixed(2),liquido:((row.netAmountCents??row.amountCents-row.feeCents)/100).toFixed(2),referencia:row.transactionId})),[rows])
 const kpis=[['Faturamento',centsMoney(summary.grossCents)],['Lucro líquido',centsMoney(summary.netCents)],['Vendas',String(summary.approvedCount)],['Ticket médio',centsMoney(summary.averageTicketCents)],['Aprovação',`${summary.approvalRate.toFixed(1)}%`],['Reembolsos',String(summary.refundedCount)]] as const
 return <section className="reports-live" aria-label={uiText("Visão geral de relatórios")}>
  <div className="reports-overview-actions"><PeriodSelector/><button className="btn" disabled={!exportRows.length} onClick={()=>downloadCsv('relatorio-vendas-sphexpay.csv',exportRows)}><Download size={16}/><T> Exportar CSV</T></button></div>
  {transactionsError&&<div className="mb-4"><StateMessage title={uiText('Relatório indisponível')}><span>{transactionsError}</span> <button className="btn" onClick={reload}><RotateCcw size={14}/><T> Tentar novamente</T></button></StateMessage></div>}
  {transactions===null?<Loading label="Carregando relatório"/>:<>
  <div className="report-kpis">{kpis.map(([label,value])=><Card key={label} className="report-kpi"><span><T>{label}</T></span><strong>{value}</strong></Card>)}</div>
  <div className="grid lg:grid-cols-[1fr_320px] gap-5"><Card className="report-chart"><div><FileBarChart/><span><b><T>{view==='revenue'?'Faturamento no período':'Vendas no período'}</T></b><small><T>Somente vendas reais aprovadas</T></small></span><div className="report-tabs" role="group" aria-label={uiText('Métrica do gráfico')}>{([['revenue','Faturamento'],['sales','Vendas']] as const).map(([key,label])=><button className={view===key?'active':''} aria-pressed={view===key} onClick={()=>setView(key)} key={key}><T>{label}</T></button>)}</div></div>
   {summary.approvedCount===0?<Empty title={uiText('Sem vendas no período')} text={uiText('Quando suas vendas forem aprovadas, o gráfico mostra a evolução aqui.')}/>:
   <div className="h-[360px]"><ResponsiveContainer><AreaChart data={chart}><defs><linearGradient id="reportArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0080ff" stopOpacity=".32"/><stop offset="1" stopColor="#0080ff" stopOpacity="0"/></linearGradient></defs><CartesianGrid stroke="var(--line)" vertical={false}/><XAxis dataKey="label" tick={{fill:'var(--muted)',fontSize:10}} minTickGap={18}/><YAxis tick={{fill:'var(--muted)',fontSize:10}} allowDecimals={view==='revenue'}/><Tooltip contentStyle={{background:'var(--panel)',border:'1px solid var(--line)',borderRadius:14}} formatter={value=>view==='revenue'?money(Number(value)):`${value} ${uiText('vendas')}`}/><Area type="monotone" dataKey="value" stroke="#0080ff" strokeWidth={2.5} fill="url(#reportArea)" animationDuration={650}/></AreaChart></ResponsiveContainer></div>}
  </Card>
  <Card className="report-score"><Target/><span><T>Produtos que mais vendem</T></span>
   {products.length?<dl>{products.map(item=><div key={item.label}><dt>{item.label}</dt><dd>{centsMoney(item.revenueCents)} · {item.share.toFixed(0)}%</dd></div>)}</dl>:<p><T>Nenhuma venda aprovada no período.</T></p>}
   <hr/><dl>{methods.map(item=><div key={item.label}><dt><T>{item.label}</T></dt><dd>{item.sales} · {item.share.toFixed(0)}%</dd></div>)}<div><dt><T>Contestações</T></dt><dd>{summary.chargebackCount}</dd></div><div><dt><T>Valor reembolsado</T></dt><dd>{centsMoney(summary.refundedCents)}</dd></div><div><dt><T>Pendentes</T></dt><dd>{summary.pendingCount}</dd></div></dl>
  </Card></div>
  <p className="muted text-xs mt-4"><T>Os números consideram apenas vendas reais. Vendas de teste não entram nos relatórios.</T>{summary.otherCurrencies.length?<> <T>Totais em reais; exporte o CSV para ver vendas em outras moedas.</T></>:null}</p></>}
 </section>}
