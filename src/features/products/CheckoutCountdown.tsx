import {useEffect,useState} from 'react'
import {Clock3} from 'lucide-react'
import type {CSSProperties} from 'react'
import type {TimerStyle} from './checkoutTemplate'

export function CheckoutCountdown({endsAt,startsAt,title,style,preview=false}:{endsAt:unknown;startsAt?:unknown;title?:string;style:TimerStyle;preview?:boolean}){
 const end=typeof endsAt==='string'?Date.parse(endsAt):NaN,start=typeof startsAt==='string'?Date.parse(startsAt):NaN
 const [now,setNow]=useState(()=>Date.now())
 useEffect(()=>{if(!Number.isFinite(end))return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[end])
 if(!Number.isFinite(end))return preview?<p className="co-template-help">Configure a data final da oferta para exibir o timer.</p>:null
 const remaining=Math.max(0,Math.ceil((end-now)/1000)),days=Math.floor(remaining/86400),units=[...(days?[{value:days,label:'dias'}]:[]),{value:Math.floor(remaining/3600)%24,label:'horas'},{value:Math.floor(remaining/60)%60,label:'min'},{value:remaining%60,label:'seg'}]
 const progress=Number.isFinite(start)&&end>start?Math.max(0,Math.min(100,(now-start)/(end-start)*100)):null
 return <section className={`co-countdown co-countdown-${style.variant} co-countdown-${style.layout} co-countdown-${style.size}`} style={{'--timer-accent':style.accent,'--timer-background':style.background,'--timer-text':style.text} as CSSProperties} aria-label="Prazo da oferta">
  <div className="co-countdown-label">{style.showIcon&&<Clock3 aria-hidden="true"/>}<span>{remaining?title||'Prazo desta oferta':'Prazo encerrado'}</span></div>
  <div className="co-countdown-units" aria-label={remaining?`${days} dias, ${Math.floor(remaining/3600)%24} horas, ${Math.floor(remaining/60)%60} minutos`:'Prazo encerrado'}>{units.map((unit,i)=><div key={unit.label}>{i>0&&<i aria-hidden="true">:</i>}<strong>{String(unit.value).padStart(2,'0')}</strong>{style.showUnits&&<small>{unit.label}</small>}</div>)}</div>
  {style.showProgress&&progress!==null&&<div className="co-countdown-track" role="progressbar" aria-label="Progresso do prazo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{width:`${progress}%`}}/></div>}
 </section>
}
