import { useEffect,useMemo,useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import { Card,Empty,PageTitle,SearchBox } from '../components/ui'
import { DashboardPeriodFilter } from '../components/dashboard/DashboardControls'
import { RealtimeStatus } from '../components/dashboard/RealtimeStatus'
import { ConvertedMoney } from '../components/dashboard/ConvertedMoney'
import { useAuth } from '../hooks/useAuth'
import { useDashboardCurrency } from '../hooks/useDashboardCurrency'
import { useDashboardPeriod } from '../hooks/useDashboardPeriod'
import { useLiveSales } from '../hooks/useLiveSales'
import { dashboardService } from '../services/dashboardService'
import { maskBuyerName,type ExchangeRate } from '../lib/dashboardFinance'
import { formatCents } from '../lib/currencyFormat'

const labels={approved:'Aprovada',pending:'Pendente',declined:'Recusada',refunded:'Reembolsada',chargeback:'Chargeback'} as const

export default function LiveSales({transactions=false}:{transactions?:boolean}){
 const {user}=useAuth(),{period,setPeriod}=useDashboardPeriod(),{currency}=useDashboardCurrency()
 const live=useLiveSales(user?.id,period),[rates,setRates]=useState<ExchangeRate[]>([]),[query,setQuery]=useState(''),[status,setStatus]=useState('all')
 useEffect(()=>{let active=true;dashboardService.loadRates().then(value=>{if(active)setRates(value)}).catch(()=>{});return()=>{active=false}},[])
 const rows=useMemo(()=>live.sales.filter(row=>{
  const matches=`${row.transactionId} ${row.productName} ${row.buyerName||''}`.toLowerCase().includes(query.toLowerCase())
  return matches&&(status==='all'||row.status===status)
 }),[live.sales,query,status])
 return <div className="page-enter">
  <PageTitle title={transactions?'Transações':'Vendas'} subtitle={transactions?'Movimentações financeiras persistidas no Supabase.':'Vendas reais confirmadas e atualizadas em tempo real.'} action={<button className="btn" onClick={()=>void live.refresh()} disabled={live.loading}><RefreshCcw className={live.loading?'spin':''}/> Atualizar</button>}/>
  <Card className="dashboard-filter-bar"><DashboardPeriodFilter period={period} onChange={setPeriod}/><RealtimeStatus status={live.realtime} updatedAt={live.updatedAt} onRefresh={()=>void live.refresh()} loading={live.loading}/></Card>
  {live.error&&<p className="dashboard-admin-warning" role="alert">{live.error}</p>}
  <Card><div className="p-4 flex flex-col sm:flex-row gap-3"><div className="max-w-md flex-1"><SearchBox value={query} onChange={setQuery} placeholder="Comprador, produto ou identificador..."/></div><select className="input sm:w-44" value={status} onChange={event=>setStatus(event.target.value)}><option value="all">Todos</option>{Object.entries(labels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></div>
   <div className="table-wrap"><table className="table"><thead><tr><th>Comprador</th><th>Identificador / horário</th><th>Produto</th><th>Método</th><th>Status</th><th>Valor original</th><th>Exibição</th></tr></thead><tbody>{rows.map(row=><tr key={`${row.transactionId}:${row.status}:${row.updatedAt||row.occurredAt}`} className="sale-enter"><td>{maskBuyerName(row.buyerName)}</td><td><b>{row.transactionId.slice(-12)}</b><p className="muted text-[11px]">{new Date(row.occurredAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p></td><td>{row.productName}</td><td>{row.paymentMethod}</td><td>{labels[row.status]}</td><td>{formatCents(row.amountCents,row.currency)}</td><td><ConvertedMoney amountCents={row.amountCents} sourceCurrency={row.currency} displayCurrency={currency} rates={rates}/></td></tr>)}</tbody></table>{!live.loading&&!rows.length&&<Empty/>}</div>
  </Card>
 </div>
}
