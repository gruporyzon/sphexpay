import { useEffect,type ReactNode } from 'react'
import { audioManager } from '../services/audioManager'
import { useSound } from '../hooks/useSound'

export function SoundProvider({children}:{children:ReactNode}){
 const sound=useSound()

 useEffect(()=>{
  let gestureHandled=false
  const resumeFromGesture=()=>{
   if(gestureHandled||!sound.enabled)return
   gestureHandled=true
   void audioManager.ensureAudioReady(true)
  }
  const resumeFromLifecycle=()=>{if(sound.enabled)void audioManager.ensureAudioReady(false)}
  const visible=()=>{if(document.visibilityState==='visible')resumeFromLifecycle()}
  window.addEventListener('pointerdown',resumeFromGesture,{passive:true,once:true})
  window.addEventListener('keydown',resumeFromGesture,{once:true})
  window.addEventListener('pageshow',resumeFromLifecycle)
  window.addEventListener('focus',resumeFromLifecycle)
  document.addEventListener('visibilitychange',visible)
  return()=>{
   window.removeEventListener('pointerdown',resumeFromGesture)
   window.removeEventListener('keydown',resumeFromGesture)
   window.removeEventListener('pageshow',resumeFromLifecycle)
   window.removeEventListener('focus',resumeFromLifecycle)
   document.removeEventListener('visibilitychange',visible)
  }
 },[sound.enabled])

 return <>{children}</>
}
