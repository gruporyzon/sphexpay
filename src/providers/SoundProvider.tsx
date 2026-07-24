import { useEffect,useState,type ReactNode } from 'react'
import { BellRing,Volume2,X } from 'lucide-react'
import { audioManager } from '../services/audioManager'
import { useSound } from '../hooks/useSound'
import { useDemoStore } from '../store/useDemoStore'

const dismissedKey='sphexpay_sound_prompt_dismissed'

export function SoundProvider({children}:{children:ReactNode}){
 const sound=useSound(),update=useDemoStore(state=>state.updatePreferences)
 const [dismissed,setDismissed]=useState(()=>localStorage.getItem(dismissedKey)==='true')
 const shouldPrompt=audioManager.isMobile()&&!dismissed&&!sound.unlocked

 useEffect(()=>{
  const resumeFromGesture=()=>{if(sound.enabled)void audioManager.ensureAudioReady(true)}
  const resumeFromLifecycle=()=>{if(sound.enabled)void audioManager.ensureAudioReady(false)}
  const visible=()=>{if(document.visibilityState==='visible')resumeFromLifecycle()}
  window.addEventListener('pointerdown',resumeFromGesture,{passive:true})
  window.addEventListener('touchend',resumeFromGesture,{passive:true})
  window.addEventListener('click',resumeFromGesture,{passive:true})
  window.addEventListener('pageshow',resumeFromLifecycle)
  window.addEventListener('focus',resumeFromLifecycle)
  document.addEventListener('visibilitychange',visible)
  return()=>{
   window.removeEventListener('pointerdown',resumeFromGesture)
   window.removeEventListener('touchend',resumeFromGesture)
   window.removeEventListener('click',resumeFromGesture)
   window.removeEventListener('pageshow',resumeFromLifecycle)
   window.removeEventListener('focus',resumeFromLifecycle)
   document.removeEventListener('visibilitychange',visible)
  }
 },[sound.enabled])

 const activate=async()=>{
  const active=await sound.activate()
  if(!active)return
  update('notifications',{sound:true})
  update('sales',{saleSound:true})
  update('assistant',{readAloud:true})
  localStorage.removeItem(dismissedKey)
  setDismissed(true)
 }
 const later=()=>{localStorage.setItem(dismissedKey,'true');setDismissed(true)}

 return <>{children}{shouldPrompt&&<div className="sound-unlock-backdrop" role="presentation"><section className="sound-unlock-dialog" role="dialog" aria-modal="true" aria-labelledby="sound-unlock-title"><button className="sound-unlock-close" onClick={later} aria-label="Agora não"><X/></button><div className="sound-unlock-icon"><BellRing/></div><span>EXPERIÊNCIA SONORA</span><h2 id="sound-unlock-title">Ative os sons da SphexPay</h2><p>Receba alertas sonoros de vendas e ouça as respostas da inteligência artificial.</p>{sound.lastError&&<small role="alert">{sound.lastError}</small>}<button className="btn btn-primary sound-unlock-primary" onClick={activate}><Volume2/> Ativar sons e voz</button><button className="btn btn-ghost" onClick={later}>Agora não</button></section></div>}</>
}
