import { useId,useMemo } from 'react'
import { Area,AreaChart,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts'
import { Activity } from 'lucide-react'
import { T,useTranslation } from '../../i18n'
import type { FinancialPoint } from '../../lib/dashboardFinance'

type Props={series:FinancialPoint[];format:(cents:number)=>string;periodText:string;loading:boolean}

// Faturamento do período em onda suave: área com degradê, desenho animado ao carregar, brilho que
// percorre a onda e indicador pulsante ao lado do total. Cores pelos tokens do tema (claro e escuro), sem cor fixa.
export function RevenueWaveChart({series,format,periodText,loading}:Props){
 const {t}=useTranslation(),gradient=useId().replace(/:/g,'')
 const data=useMemo(()=>series.map(point=>({label:point.label,value:Math.max(0,point.revenueCents),sales:point.sales})),[series])
 const total=data.reduce((sum,point)=>sum+point.value,0),sales=data.reduce((sum,point)=>sum+point.sales,0)
 const best=data.reduce<{label:string;value:number}|null>((top,point)=>!top||point.value>top.value?point:top,null)
 return <section className="reference-card revenue-wave" aria-label={t('Faturamento do período')}>
  <header className="revenue-wave-head">
   <span className="reference-card-icon"><Activity/></span>
   <div><h2><T>Faturamento</T></h2><p>{periodText}</p></div>
   <strong className="revenue-wave-total">{!loading&&total>0&&<span className="revenue-wave-pulse" aria-hidden="true"/>}{loading?'—':format(total)}</strong>
  </header>
  <div className="revenue-wave-chart" role="img" aria-label={`${t('Gráfico de faturamento')}: ${format(total)}`}>
   {loading?<div className="revenue-wave-skeleton"/>:<ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data} margin={{top:12,right:8,bottom:0,left:8}}>
     <defs>
      <linearGradient id={`wave-fill-${gradient}`} x1="0" y1="0" x2="0" y2="1">
       <stop offset="0%" stopColor="currentColor" stopOpacity={.28}/>
       <stop offset="70%" stopColor="currentColor" stopOpacity={.06}/>
       <stop offset="100%" stopColor="currentColor" stopOpacity={0}/>
      </linearGradient>
     </defs>
     <XAxis dataKey="label" hide/>
     <YAxis hide domain={[0,(max:number)=>Math.max(1,max*1.15)]}/>
     <Tooltip cursor={{stroke:'currentColor',strokeOpacity:.18,strokeDasharray:'4 4'}} content={({active,payload})=>active&&payload?.length?<div className="revenue-wave-tooltip"><span>{String(payload[0].payload.label)}</span><strong>{format(Number(payload[0].value)||0)}</strong><small>{payload[0].payload.sales} {t(payload[0].payload.sales===1?'venda':'vendas')}</small></div>:null}/>
     <Area type="monotone" dataKey="value" stroke="currentColor" strokeWidth={2.4} fill={`url(#wave-fill-${gradient})`} isAnimationActive animationDuration={1600} animationEasing="ease-out"
      dot={false} activeDot={{r:5,strokeWidth:3,stroke:'var(--panel)',fill:'currentColor'}}/>
    </AreaChart>
   </ResponsiveContainer>}
   {!loading&&total>0&&<span className="revenue-wave-shine" aria-hidden="true"/>}
   {!loading&&total===0&&<p className="revenue-wave-empty"><T>As vendas aprovadas do período aparecem aqui em tempo real.</T></p>}
  </div>
  <footer className="revenue-wave-foot">
   <span><T>Vendas pagas</T><b>{loading?'—':sales.toLocaleString('pt-BR')}</b></span>
   <span><T>Melhor momento</T><b>{loading||!best||!best.value?'—':best.label}</b></span>
  </footer>
 </section>
}
