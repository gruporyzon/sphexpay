import { useEffect, useState } from 'react'
export function PublicHeroMetrics() {
 const [progress,setProgress]=useState(0)
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)');let frame=0;const start=performance.now()+350
  const update=(now:number)=>{const next=media.matches?1:Math.min(1,Math.max(0,(now-start)/1600));setProgress(next);if(next<1)frame=requestAnimationFrame(update)}
  frame=requestAnimationFrame(update);return()=>cancelAnimationFrame(frame)
 },[])
 return <dl className="hero-metrics" aria-label="Indicadores da plataforma">{[[`${(6.99*progress).toFixed(2)}%`,'por transação','6.99%'],[`${Math.round(150*progress)}+`,'países','150+'],[`${Math.round(3*progress)} dias`,'para saque','3 dias']].map(([value,label,final])=><div key={label}><dt aria-label={final}><span aria-hidden="true">{value}</span></dt><dd>{label}</dd></div>)}</dl>
}
