import { useEffect,useState } from 'react'
import { competitionConfig,competitionStatus } from '../../config/competition'

const parts=(distance:number)=>[
 ['Dias',Math.floor(distance/86_400_000)],
 ['Horas',Math.floor(distance/3_600_000)%24],
 ['Min',Math.floor(distance/60_000)%60],
 ['Seg',Math.floor(distance/1000)%60]
] as const

export function CompetitionCountdown(){
 const [now,setNow]=useState(()=>Date.now())
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer)},[])
 const status=competitionStatus(new Date(now)),target=status==='upcoming'?new Date(competitionConfig.startsAt).getTime():new Date(competitionConfig.endsAt).getTime(),distance=Math.max(0,target-now)
 return <div className="competition-countdown" aria-label={status==='upcoming'?'Contagem para o início':'Contagem para o encerramento'}>{parts(distance).map(([label,value])=><span key={label}><b>{String(value).padStart(2,'0')}</b><small>{label}</small></span>)}</div>
}
