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
import { TransactionStatusBadge } from '../components/transactions/TransactionStatusBadge'
import { transactionStatusLabels } from '../components/transactions/transactionStatus'

const demoRates:ExchangeRate[]=Object.entries(demoExchangeRates).filter(([currency])=>currency!=='BRL').flatMap(([currency,rate])=>[{baseCurrency:currency as 'USD'|'EUR',quoteCurrency:'BRL',rate:1/rate,source:'taxa de referência',observedAt:new Date().toISOString()},{baseCurrency:'BRL',quoteCurrency:currency as 'USD'|'EUR',rate,source:'taxa de referência',observedAt:new Date().toISOString()}])

export default function LiveSales({transactions=false}:{transactions?:boolean}){
 const {user}=useAuth(),{period,setPeriod}=useDashboardPeriod(),{currency,setCurrency}=useDashboardCurrency()
 const live=useLiveSales(user?.id,period),[rates,setRates]=useState<ExchangeRate[]>([]),[query,setQuery]=useState(''),[status,setStatus]=useState('all'),[detail,setDetail]=useState<FinancialTransaction|null>(null)
 useEffect(()=>{if(live.demo)return;let active=true;dashboardService.loadRates().then(value=>{if(active)setRates(value)}).catch(()=>{});return()=>{active=false}},[live.demo])
 const effectiveRates=live.demo?demoRates:rates
 const rows=useMemo(()=>live.sales.filter(row=>`${row.transactionId} ${row.productName} ${row.buyerName||''}`.toLowerCase().includes(query.toLowerCase())&&(status==='all'||row.status===status)),[live.sales,query,status])
 return <div className={transactions?'transactions-page internal-real-page page-enter':'live-sales-page internal-real-page page-enter'}>
  <PageTitle title={transactions?'Transações':'Vendas'} subtitle={live.demo?'Acompanhe os registros recentes. Ações financeiras reais estão desabilitadas.':transactions?'Movimentações financeiras persistidas no Supabase.':'Vendas reais confirmadas e atualizadas em tempo real.'} action={!live.demo?<button className="btn" onClick={()=>void live.refresh()} disabled={live.loading}><RefreshCcw className={live.loading?'spin':''}/> Atualizar</button>:undefined}/>
  <Card className="dashboard-filter-bar"><DashboardPeriodFilter period={period} onChange={setPeriod}/><DashboardCurrencySelector currency={currency} onChange={setCurrency}/>{!live.demo&&<RealtimeStatus status={live.realtime} updatedAt={live.updatedAt} onRefresh={()=>void live.refresh()} loading={live.loading}/>}</Card>
  {live.error&&<p className="dashboard-admin-warning" role="alert">{live.error}</p>}
	 <Card className="transactions-table-card"><div className="transactions-toolbar"><div className="transactions-search"><SearchBox value={query} onChange={setQuery} placeholder="Comprador, produto ou identificador..."/></div><label className="transactions-filter"><span>Status</span><select className="input" aria-label="Filtrar por status" value={status} onChange={event=>setStatus(event.target.value)}><option value="all">Todos</option>{Object.entries(transactionStatusLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label></div>
	   <div className="table-wrap transactions-table-wrap"><table className="table"><caption className="sr-only">Transações</caption><thead><tr><th>Comprador</th><th>Identificador / horário</th><th>Produto</th><th>Método</th><th>Status</th><th>Valor original</th><th>Exibição</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{rows.map(row=><tr key={`${row.transactionId}:${row.status}:${row.updatedAt||row.occurredAt}`} className="sale-enter"><td>{maskBuyerName(row.buyerName)}</td><td><b>{row.transactionId.slice(-12)}</b><p className="muted text-[11px]">{new Date(row.occurredAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p></td><td>{row.productName}</td><td>{row.paymentMethod}</td><td><TransactionStatusBadge status={row.status}/></td><td className="transaction-money">{formatCents(row.amountCents,row.currency)}</td><td className="transaction-money"><ConvertedMoney amountCents={row.amountCents} sourceCurrency={row.currency} displayCurrency={currency} rates={effectiveRates}/></td><td><button className="btn icon-btn" aria-label={`Ver detalhes de ${row.transactionId}`} onClick={()=>setDetail(row)}><Eye/></button></td></tr>)}</tbody></table>{!live.loading&&!rows.length&&<Empty text="Ajuste a busca ou os filtros para encontrar uma transação." title="Nenhuma transação encontrada"/>}</div>
  </Card>
	 {detail&&<Modal title="Detalhe da transação" className="transactions-details-modal" onClose={()=>setDetail(null)}><div className="transactions-details-grid">{Object.entries({Identificador:detail.transactionId,Produto:detail.productName,Comprador:maskBuyerName(detail.buyerName),Método:detail.paymentMethod,Status:transactionStatusLabels[detail.status],'Valor bruto':formatCents(detail.grossAmountCents??detail.amountCents,detail.currency),Taxas:formatCents(detail.feeCents,detail.currency),'Valor líquido':formatCents(detail.netAmountCents??Math.max(0,detail.amountCents-detail.feeCents),detail.currency)}).map(([label,value])=><div key={label}><span className="label">{label}</span><b>{value}</b></div>)}</div>{detail.demo&&<p className="demo-detail-warning">Reembolso, captura, cancelamento, exportação de produção e demais ações financeiras estão desabilitados.</p>}</Modal>}
 </div>
}
