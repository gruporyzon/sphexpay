import { useCallback,useEffect,useRef,useState,type PropsWithChildren } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { BatSwarmScene } from './BatSwarmScene'

export const APP_BOOT_SESSION_KEY='sphexpay.appBootPlayed'
export const APP_BOOT_TIMING={mobile:{min:2050,max:2300,exit:300},desktop:{min:1900,max:2200,exit:280},reduced:{min:240,max:600,exit:180}} as const

type BootPhase='entering'|'leaving'|'removed'

function reserveBootPlayback(){
 try{
  if(sessionStorage.getItem(APP_BOOT_SESSION_KEY))return false
  sessionStorage.setItem(APP_BOOT_SESSION_KEY,'true')
  return true
 }catch{return true}
}

function timingForDevice(){
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return APP_BOOT_TIMING.reduced
 return window.matchMedia?.('(max-width: 900px)').matches?APP_BOOT_TIMING.mobile:APP_BOOT_TIMING.desktop
}

export function AppBootSplash({children,appReady}:PropsWithChildren<{appReady:boolean}>){
 const [playsBoot]=useState(reserveBootPlayback)
 const [phase,setPhase]=useState<BootPhase>(()=>playsBoot?'entering':'removed')
 const [documentReady,setDocumentReady]=useState(()=>document.readyState!=='loading')
 const [logoReady,setLogoReady]=useState(false)
 const [renderReady,setRenderReady]=useState(false)
 const [sceneFailed,setSceneFailed]=useState(false)
 const startedAt=useRef(performance.now())
 const timing=useRef(timingForDevice())
 const originalThemeColor=useRef(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content??'#000000')
 const reducedMotion=timing.current===APP_BOOT_TIMING.reduced
 const handleSceneFailure=useCallback(()=>setSceneFailed(true),[])

 useEffect(()=>{
  const meta=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  const original=originalThemeColor.current
  if(playsBoot&&meta)meta.content='#050505'
  if(!playsBoot)document.documentElement.classList.remove('app-boot-pending')
  return()=>{if(meta)meta.content=original}
 },[playsBoot])

 useEffect(()=>{
  if(!playsBoot)return
  if(document.readyState!=='loading'){setDocumentReady(true);return}
  const ready=()=>setDocumentReady(true)
  document.addEventListener('DOMContentLoaded',ready,{once:true})
  return()=>document.removeEventListener('DOMContentLoaded',ready)
 },[playsBoot])

 useEffect(()=>{
  if(!playsBoot)return
  let active=true
  const image=new Image()
  const ready=()=>{if(active)setLogoReady(true)}
  image.onload=ready;image.onerror=ready;image.src='/brand/sphex-symbol-mask.png'
  if(image.complete)ready();else void image.decode?.().then(ready,ready)
  return()=>{active=false;image.onload=null;image.onerror=null}
 },[playsBoot])

 useEffect(()=>{
  if(!playsBoot)return
  let first=0,second=0
  first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>setRenderReady(true))})
  return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second)}
 },[playsBoot])

 useEffect(()=>{
  if(!playsBoot||phase!=='entering')return
  const {min,max}=timing.current
  let leaveTimer=0
  const leave=()=>setPhase(current=>current==='entering'?'leaving':current)
  const elapsed=performance.now()-startedAt.current
  const appCanEnter=appReady&&documentReady&&logoReady&&renderReady
  if(appCanEnter)leaveTimer=window.setTimeout(leave,Math.max(0,min-elapsed))
  const safetyTimer=window.setTimeout(leave,Math.max(0,max-elapsed))
  return()=>{clearTimeout(leaveTimer);clearTimeout(safetyTimer)}
 },[appReady,documentReady,logoReady,phase,playsBoot,renderReady])

 useEffect(()=>{
  if(phase!=='leaving')return
  const removeTimer=window.setTimeout(()=>setPhase('removed'),timing.current.exit)
  return()=>clearTimeout(removeTimer)
 },[phase])

 useEffect(()=>{
  if(phase!=='removed')return
  document.documentElement.classList.remove('app-boot-pending')
  const meta=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if(meta)meta.content=originalThemeColor.current
 },[phase])

 const active=phase!=='removed'
 return <div className={`app-boot-host ${active?'boot-active':'boot-complete'}`}>
  <div className="app-boot-content" inert={active?true:undefined}>{children}</div>
  {active&&<div className={`app-boot-splash ${phase}`} role="status" aria-label="Abrindo SphexPay" aria-live="polite">
   <div className="app-boot-depth" aria-hidden="true"><i/><i/><i/><i/><i/></div>
   <BatSwarmScene reducedMotion={reducedMotion} onFailure={handleSceneFailure}/>
   <div className={`app-boot-brand ${sceneFailed?'scene-fallback':''}`}>
    <span className="app-boot-glow" aria-hidden="true"/>
    <img className="app-boot-logo" src="/brand/sphex-symbol-mask.png" alt="" width="1077" height="1562" draggable="false"/>
    <strong>SPHEX PAY</strong>
    <span className="app-boot-pulse" aria-hidden="true"><i/></span>
   </div>
  </div>}
 </div>
}

export function AppBootGate({children}:PropsWithChildren){
 const {loading}=useAuth()
 return <AppBootSplash appReady={!loading}>{children}</AppBootSplash>
}
