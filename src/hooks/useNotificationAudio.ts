import { useEffect,useRef } from 'react'
import { useDemoStore } from '../store/useDemoStore'
import { audioService } from '../services/audioService'
import type { SphexSound } from '../services/audioManager'

const inQuietHours=(from:string,to:string)=>{
 const now=new Date(),value=now.getHours()*60+now.getMinutes(),[fh,fm]=from.split(':').map(Number),[th,tm]=to.split(':').map(Number),start=fh*60+fm,end=th*60+tm
 return start<=end?value>=start&&value<end:value>=start||value<end
}

export function useNotificationAudio(){
 const notifications=useDemoStore(state=>state.notifications),prefs=useDemoStore(state=>state.preferences.notifications)
 const known=useRef<Set<string>|undefined>(undefined)
 useEffect(()=>{
  if(!known.current){known.current=new Set(notifications.map(item=>item.id));return}
  const incoming=notifications.filter(item=>!known.current!.has(item.id))
  notifications.forEach(item=>known.current!.add(item.id))
  const quiet=prefs.doNotDisturb||(prefs.quietHours&&inQuietHours(prefs.quietFrom,prefs.quietTo))
  if(quiet||!prefs.sound||document.visibilityState!=='visible')return
  incoming.slice(0,3).forEach(item=>{
   if(['sale','payment','subscription','withdrawal'].includes(item.kind))return
   const sound:Exclude<SphexSound,'sale'>=item.kind==='achievement'||item.kind==='goal'?'achievement':item.kind==='security'||item.priority==='critical'?'alert':'alert'
   void audioService.playNotification(sound,prefs.soundVolume,item.id)
   if(prefs.vibration&&item.priority!=='low')audioService.vibrate()
  })
 },[notifications,prefs])
}
