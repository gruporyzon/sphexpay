import { useMemo } from 'react'
import { Area,AreaChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts'
import type { Currency,FinancialPoint } from '../../lib/dashboardFinance'
import { formatCents } from '../../lib/currencyFormat'

export function RevenueChart({data,currency}:{data:FinancialPoint[];currency:Currency}){
 const domain=useMemo(()=>{const values=data.map(point=>point.revenueCents);const max=Math.max(1,...values);return[0,Math.ceil(max*1.18)] as [number,number]},[data])
 const reduced=typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches
 return <div className="chart-wrap premium-chart" data-domain={`${domain[0]}-${domain[1]}`}><ResponsiveContainer width="100%" height="100%" minWidth={0}><AreaChart data={data} margin={{top:26,right:12,left:0,bottom:4}}><defs><linearGradient id="performanceArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff7a3d" stopOpacity=".48"/><stop offset="100%" stopColor="#f15a24" stopOpacity="0"/></linearGradient></defs><CartesianGrid stroke="var(--line)" strokeDasharray="2 8" vertical={false}/><XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={28} tick={{fill:'var(--muted)',fontSize:9}}/><YAxis domain={domain} axisLine={false} tickLine={false} width={54} tick={{fill:'var(--muted)',fontSize:9}} tickFormatter={value=>formatCents(Number(value),currency).replace(/\\s/g,'')}/><Tooltip content={<ChartTooltip currency={currency}/>}/><Area type="monotoneX" dataKey="revenueCents" stroke="#ff6a2f" strokeWidth={3} fill="url(#performanceArea)" isAnimationActive={!reduced} animationDuration={700}/></AreaChart></ResponsiveContainer></div>
}
export const PerformanceChart=RevenueChart
function ChartTooltip({active,payload,label,currency}:{active?:boolean;payload?:Array<{value:number}>;label?:string;currency:Currency}){if(!active||!payload?.length)return null;return <div className="chart-tooltip"><span>{label}</span><strong>{formatCents(payload[0].value,currency)}</strong><small>Receita confirmada</small></div>}
