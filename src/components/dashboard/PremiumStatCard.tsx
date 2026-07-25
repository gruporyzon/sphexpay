import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight,ArrowUpRight } from 'lucide-react'
import { Card } from '../ui'
import { EditableValue } from '../common/EditableValue'
import { AnimatedMetric } from './AnimatedMetric'

export type StatFormat='money'|'number'|'percent'
export interface PremiumStat {
 label:string
 value:number
 format:StatFormat
 delta:number
 icon:LucideIcon
 featured?:boolean
}

export function PremiumStatCard({stat,index,refreshing,format,onRevenueEdit}:{stat:PremiumStat;index:number;refreshing:boolean;format:(value:number)=>string;onRevenueEdit?:(value:number)=>void}){
 const {label,value,delta,icon:Icon,featured}=stat
 return <Card className={`metric-card ${featured?'metric-card-featured':''}`}>
  {refreshing?<div className="metric-skeleton" aria-label="Atualizando indicador"><i/><i/><i/></div>:<>
   <div className="metric-card-top"><div className="metric-icon"><Icon size={featured?19:17} strokeWidth={1.8}/></div><span className={`metric-delta ${delta>=0?'metric-up':'metric-down'}`}>{delta>=0?<ArrowUpRight/>:<ArrowDownRight/>} {Math.abs(delta).toFixed(1)}%</span></div>
   <div className="metric-copy"><p className="metric-value"><AnimatedMetric value={value} format={format}/>{index===0&&onRevenueEdit&&<EditableValue label="Faturamento total" value={value} currency onSave={onRevenueEdit}/>}</p><p className="metric-label">{label}</p></div>
   {index===0&&<div className="metric-glow"/>}
  </>}
 </Card>
}
