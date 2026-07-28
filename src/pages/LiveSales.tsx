import { useEffect,useMemo,useState } from 'react'
import { Eye,RefreshCcw } from 'lucide-react'
import { Card,Empty,Modal,PageTitle,SearchBox } from '../components/ui'
import { DashboardCurrencySelector,DashboardPeriodFilter } from '../components/dashboard/DashboardControls'
import { RealtimeStatus } from '../components/dashboard/RealtimeStatus'
import { ConvertedMoney } from '../components/dashboard/ConvertedMoney'
import { useAuth } from '../hooks/useAuth'
import { useDashboardCurrency } from '../hooks/useDashboardCurrency'
import { useDashboardPeriod } from '../hooks/useDashboardPeriod'
import { useLiveSales } from '../hooks/useLiveSales'
import { dashboardService } from '../services/dashboardService'
import { maskBuyerName,type ExchangeRate,type FinancialTransaction } from '../lib/dashboardFinance'
import { formatCents } from '../lib/currencyFormat'
import { demoExchangeRates } from '../demo/demoSimulationEngine'

const labels={approved:'Aprovada',pending:'Pendente',declined:'Recusada',refunded:'Reembolsada',chargeback:'Chargeback'} as const
const demoRates:ExchangeRate[]=Object.entries(demoExchangeRates).filter(([currency])=>currency!=='BRL').flatMap(([currency,rate])=>[{baseCurrency:currency as 'USD'|'EUR',quoteCurrency:'BRL',rate:1/rate,source:'taxa de referência',observedAt:new Date().toISOString()},{baseCurrency:'BRL',quoteCurrency:currency as 'USD'|'EUR',rate,source:'taxa de referência',observedAt:new Date().toISOString()}])

export default function LiveSales({transactions=false}:{transactions?:boolean}){
 const {user}=useAuth(),{period,setPeriod}=useDashboardPeriod(),{currency,setCurrency}=useDashboardCurrency()
 const live=useLiveSales(user?.id,period),[rates,setRates]=useState<ExchangeRate[]>([]),[query,setQuery]=useState(''),[status,setStatus]=useState('all'),[detail,setDetail]=useState<FinancialTransaction|null>(null)
 useEffect(()=>{if(live.demo)return;let active=true;dashboardService.loadRates().then(value=>{if(active)setRates(value)}).catch(()=>{});return()=>{active=false}},[live.demo])
 const effectiveRates=live.demo?demoRates:rates
 const rows=useMemo(()=>live.sales.filter(row=>`${row.transactionId} ${row.productName} ${row.buyerName||''}`.toLowerCase().includes(query.toLowerCase())&&(status==='all'||row.status===status)),[live.sales,query,status])
 return <div className="page-enter">
  <PageTitle title={transactions?'Transações':'Vendas'} subtitle={live.demo?'Acompanhe os registros recentes. Ações financeiras reais estão desabilitadas.':transactions?'Movimentações financeiras persistidas no Supabase.':'Vendas reais confirmadas e atualizadas em tempo real.'} action={!live.demo?<button className="btn" onClick={()=>void live.refresh()} disabled={live.loading}><RefreshCcw className={live.loading?'spin':''}/> Atualizar</button>:undefined}/>
  <Card className="dashboard-filter-bar"><DashboardPeriodFilter period={period} onChange={setPeriod}/><DashboardCurrencySelector currency={currency} onChange={setCurrency}/>{!live.demo&&<RealtimeStatus status={live.realtime} updatedAt={live.updatedAt} onRefresh={()=>void live.refresh()} loading={live.loading}/>}</Card>
  {live.error&&<p className="dashboard-admin-warning" role="alert">{live.error}</p>}
  <Card><div className="p-4 flex flex-col sm:flex-row gap-3"><div className="max-w-md flex-1"><SearchBox value={query} onChange={setQuery} placeholder="Comprador, produto ou identificador..."/></div><select className="input sm:w-44" value={status} onChange={event=>setStatus(event.target.value)}><option value="all">Todos</option>{Object.entries(labels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></div>
   <div className="table-wrap"><table className="table"><thead><tr><th>Comprador</th><th>Identificador / horário</th><th>Produto</th><th>Método</th><th>Status</th><th>Valor original</th><th>Exibição</th><th/></tr></thead><tbody>{rows.map(row=><tr key={`${row.transactionId}:${row.status}:${row.updatedAt||row.occurredAt}`} className="sale-enter"><td>{maskBuyerName(row.buyerName)}</td><td><b>{row.transactionId.slice(-12)}</b><p className="muted text-[11px]">{new Date(row.occurredAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p></td><td>{row.productName}</td><td>{row.paymentMethod}</td><td>{labels[row.status]}</td><td>{formatCents(row.amountCents,row.currency)}</td><td><ConvertedMoney amountCents={row.amountCents} sourceCurrency={row.currency} displayCurrency={currency} rates={effectiveRates}/></td><td><button className="btn icon-btn" aria-label="Ver detalhes" onClick={()=>setDetail(row)}><Eye/></button></td></tr>)}</tbody></table>{!live.loading&&!rows.length&&<Empty/>}</div>
  </Card>
  {detail&&<Modal title="Detalhe da transação" onClose={()=>setDetail(null)}><div className="grid sm:grid-cols-2 gap-4">{Object.entries({Identificador:detail.transactionId,Produto:detail.productName,Comprador:maskBuyerName(detail.buyerName),Método:detail.paymentMethod,Status:labels[detail.status],'Valor bruto':formatCents(detail.grossAmountCents??detail.amountCents,detail.currency),Taxas:formatCents(detail.feeCents,detail.currency),'Valor líquido':formatCents(detail.netAmountCents??Math.max(0,detail.amountCents-detail.feeCents),detail.currency)}).map(([label,value])=><div key={label}><span className="label">{label}</span><b>{value}</b></div>)}</div>{detail.demo&&<p className="demo-detail-warning">Reembolso, captura, cancelamento, exportação de produção e demais ações financeiras estão desabilitados.</p>}</Modal>}
 </div>
}
