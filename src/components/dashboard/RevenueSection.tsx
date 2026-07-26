import { ArrowDownRight,ArrowUpRight } from 'lucide-react'
import { Card } from '../ui'
import type { Currency,FinancialPoint } from '../../lib/dashboardFinance'
import { formatCents } from '../../lib/currencyFormat'
import { RevenueChart } from './PerformanceChart'

export function RevenueSection({label,totalCents,growth,data,currency,loading,error,planning}:{label:string;totalCents:number;growth:number;data:FinancialPoint[];currency:Currency;loading:boolean;error:string;planning:boolean}){
 return <Card className="revenue-card"><div className="revenue-header"><div><div className="section-eyebrow"><span/> {label}</div><div className="revenue-total-row"><p className="revenue-total">{formatCents(totalCents,currency)}</p><span className={`revenue-change ${growth<0?'negative':''}`}>{growth>=0?<ArrowUpRight/>:<ArrowDownRight/>} {Math.abs(growth*100).toFixed(1)}%</span></div><p className="revenue-caption">{planning?'Série determinística de planejamento':'Comparação com o período anterior equivalente'}</p></div></div>{loading?<div className="chart-skeleton"><i/><i/><i/><i/><i/></div>:error?<div className="dashboard-inline-empty" role="alert">{error}</div>:<><RevenueChart data={data} currency={currency}/>{!data.some(point=>point.revenueCents>0)&&<div className="dashboard-inline-empty">Nenhum resultado financeiro no período.</div>}</>}</Card>
}
