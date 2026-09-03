import { useCallback,useEffect,useRef,useState,type PropsWithChildren } from 'react'
import { consumeAuthEntrance,shouldPlayAuthEntrance } from '../../lib/authEntranceState'
import { BatSwarmScene } from './BatSwarmScene'

export const AUTH_ENTRANCE_TIMING={mobile:{min:3600,max:4500,exit:260},desktop:{min:3500,max:4400,exit:260},reduced:{min:650,max:1200,exit:180}} as const
type EntrancePhase='entering'|'leaving'|'removed'

function timingForDevice(){
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return AUTH_ENTRANCE_TIMING.reduced
 return window.matchMedia?.('(max-width: 900px)').matches?AUTH_ENTRANCE_TIMING.mobile:AUTH_ENTRANCE_TIMING.desktop
}

export function AuthEntranceExperience({children,appReady=true}:PropsWithChildren<{appReady?:boolean}>){
 const [playsEntrance]=useState(shouldPlayAuthEntrance)
 const [phase,setPhase]=useState<EntrancePhase>(()=>playsEntrance?'entering':'removed')
 const [documentReady,setDocumentReady]=useState(()=>document.readyState!=='loading')
 const [logoReady,setLogoReady]=useState(false),[shellReady,setShellReady]=useState(false),[sceneFailed,setSceneFailed]=useState(false)
 const startedAt=useRef(performance.now()),timing=useRef(timingForDevice())
 const originalThemeColor=useRef(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content??'#000000')
 const reducedMotion=timing.current===AUTH_ENTRANCE_TIMING.reduced
 const handleSceneFailure=useCallback(()=>setSceneFailed(true),[])

 useEffect(()=>{if(playsEntrance)consumeAuthEntrance()},[playsEntrance])
 useEffect(()=>{if(!playsEntrance)return;const meta=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]'),original=originalThemeColor.current;if(meta)meta.content='#000000';return()=>{if(meta)meta.content=original}},[playsEntrance])
 useEffect(()=>{if(!playsEntrance)return;if(document.readyState!=='loading'){setDocumentReady(true);return}const ready=()=>setDocumentReady(true);document.addEventListener('DOMContentLoaded',ready,{once:true});return()=>document.removeEventListener('DOMContentLoaded',ready)},[playsEntrance])
 useEffect(()=>{if(!playsEntrance)return;let active=true;const image=new Image(),ready=()=>{if(active)setLogoReady(true)};image.onload=ready;image.onerror=ready;image.src='/brand/sphex-symbol-mask.png';if(image.complete)ready();else void image.decode?.().then(ready,ready);return()=>{active=false;image.onload=null;image.onerror=null}},[playsEntrance])
 useEffect(()=>{if(!playsEntrance)return;let first=0,second=0;first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>setShellReady(true))});return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second)}},[playsEntrance])
 useEffect(()=>{if(!playsEntrance||phase!=='entering')return;const {min,max}=timing.current,elapsed=performance.now()-startedAt.current,leave=()=>setPhase(current=>current==='entering'?'leaving':current);let readyTimer=0;if(appReady&&documentReady&&logoReady&&shellReady)readyTimer=window.setTimeout(leave,Math.max(0,min-elapsed));const safetyTimer=window.setTimeout(leave,Math.max(0,max-elapsed));return()=>{clearTimeout(readyTimer);clearTimeout(safetyTimer)}},[appReady,documentReady,logoReady,phase,playsEntrance,shellReady])
 useEffect(()=>{if(phase!=='leaving')return;const timer=window.setTimeout(()=>setPhase('removed'),timing.current.exit);return()=>clearTimeout(timer)},[phase])

 if(!playsEntrance||phase==='removed')return children
 const ready=appReady&&documentReady&&logoReady&&shellReady
 return <div className="app-boot-host boot-active">
  <div className="app-boot-content" inert>{children}</div>
  <div className={`app-boot-splash ${phase} ${ready?'is-ready':''}`} role="status" aria-label="Preparando sua operação" aria-live="polite">
   <div className="app-boot-depth" aria-hidden="true"><i/><i/><i/><i/><i/></div>
   <BatSwarmScene reducedMotion={reducedMotion} onFailure={handleSceneFailure}/>
   <div className={`app-boot-brand ${sceneFailed?'scene-fallback':''}`}>
    <span className="app-boot-glow" aria-hidden="true"/>
    <img className="app-boot-logo" src="/brand/sphex-symbol-mask.png" alt="" width="1077" height="1562" draggable="false"/>
    <strong>SPHEX PAY</strong><span className="app-boot-label">Preparando sua operação</span>
    <span className="app-boot-progress" aria-hidden="true"><i/></span>
   </div>
  </div>
 </div>
}
