import { useState,type CSSProperties } from 'react'
import { ImageOff } from 'lucide-react'
import type { RevenueAwardState } from '../../config/revenueAwards'
import type { Achievement } from '../../types'

export function AwardDisplay({achievement,unlocked,state=unlocked?'unlocked':'locked'}:{achievement:Achievement;unlocked:boolean;state?:RevenueAwardState}){
 const [failed,setFailed]=useState(false)
 const style={'--award-glow':achievement.glow} as CSSProperties
 return <div className={`official-award-plaque ${state}`} style={style} aria-label={`Plaquinha ${achievement.title}`} data-award-id={achievement.id}>{failed?<div className="official-award-fallback" role="img" aria-label={`Imagem indisponível de ${achievement.title}`}><ImageOff/><b>{achievement.title}</b></div>:<img src={achievement.image} alt={`Plaquinha oficial ${achievement.title}`} loading="lazy" onError={()=>setFailed(true)}/>}</div>
}
