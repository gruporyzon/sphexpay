import { ArrowDownRight,ArrowUpRight } from 'lucide-react'
import { Card } from '../ui'
import { money } from '../../lib/utils'
import type { ChartPoint } from '../../types'
import { AnimatedMetric } from './AnimatedMetric'
import { DateRangeFilter } from './DateRangeFilter'
import { PerformanceChart } from './PerformanceChart'
import { EditableValue } from '../common/EditableValue'

export type PerformanceMetric=keyof Pick<ChartPoint,'revenue'|'profit'|'sales'>

export function RevenueSection({label,total,growth,manual,data,metric,refreshing,onMetric,onChartPoint}:{label:string;total:number;growth:number;manual:boolean;data:ChartPoint[];metric:PerformanceMetric;refreshing:boolean;onMetric:(metric:PerformanceMetric)=>void;onChartPoint?:(value:number)=>void}){
 return <Card className="revenue-card">
  <div className="revenue-header"><div className="min-w-0"><div className="section-eyebrow"><span/> {label}</div><div className="revenue-total-row"><p className="revenue-total"><AnimatedMetric value={total} format={metric==='sales'?value=>Math.round(value).toLocaleString('pt-BR'):money}/></p><span className={`revenue-change ${growth<0?'negative':''}`}>{growth>=0?<ArrowUpRight/>:<ArrowDownRight/>} {Math.abs(growth).toFixed(1)}%</span></div><p className="revenue-caption">{manual?'Cenário recalculado':'Acumulado no período selecionado'}</p></div><div className="chart-header-actions"><div className="metric-switch" role="group" aria-label="Métrica do gráfico">{([['revenue','Receita'],['profit','Lucro'],['sales','Vendas']] as const).map(([key,itemLabel])=><button type="button" key={key} className={metric===key?'active':''} onClick={()=>onMetric(key)}>{itemLabel}</button>)}{onChartPoint&&<EditableValue label="Último ponto do gráfico" value={data.at(-1)?.revenue||0} currency onSave={onChartPoint}/>}</div><DateRangeFilter/></div></div>
  {refreshing?<div className="chart-skeleton"><i/><i/><i/><i/><i/></div>:<PerformanceChart data={data} metric={metric}/>}
 </Card>
}
