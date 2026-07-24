import { useCallback,useEffect,useRef,useState } from 'react'
import { useDemoStore } from '../store/useDemoStore'
import { voiceService } from '../services/voiceService'
import { audioManager } from '../services/audioManager'

export type SpeechState='idle'|'speaking'|'paused'|'error'

export function useSpeechSynthesis(){
 const [state,setState]=useState<SpeechState>('idle'),[voices,setVoices]=useState<SpeechSynthesisVoice[]>([]),[error,setError]=useState('')
 const prefs=useDemoStore(s=>s.preferences.assistant),current=useRef<SpeechSynthesisUtterance|undefined>(undefined),last=useRef<{text:string;at:number}|undefined>(undefined)
 const supported='speechSynthesis'in window&&'SpeechSynthesisUtterance'in window

 useEffect(()=>{
  if(!supported)return
  const synth=window.speechSynthesis
  const load=()=>setVoices(voiceService.sorted(synth.getVoices(),prefs.language,prefs.voiceGender))
  load()
  synth.addEventListener?.('voiceschanged',load)
  const retries=[250,1000,2500].map(delay=>window.setTimeout(load,delay))
  return()=>{synth.removeEventListener?.('voiceschanged',load);retries.forEach(clearTimeout)}
 },[prefs.language,prefs.voiceGender,supported])

 const stop=useCallback(()=>{
  if(supported)window.speechSynthesis.cancel()
  current.current=undefined
  setState('idle')
 },[supported])

 const speak=useCallback(async(text:string,fromUserGesture=false)=>{
  const clean=text.trim()
  if(!clean||!supported){setError('A voz do dispositivo não está disponível neste navegador.');setState('error');return false}
  if(last.current?.text===clean&&Date.now()-last.current.at<500)return false
  if(audioManager.isMobile()){
   const ready=await audioManager.ensureAudioReady(fromUserGesture)
   if(!ready){setError('Não foi possível usar a voz do dispositivo. Toque para tentar novamente.');setState('error');return false}
  }
  window.speechSynthesis.cancel()
  const utterance=new SpeechSynthesisUtterance(clean)
  utterance.lang=prefs.language||'pt-BR'
  utterance.rate=prefs.speechRate
  utterance.pitch=prefs.pitch
  utterance.volume=prefs.volume
  utterance.voice=voiceService.select(window.speechSynthesis.getVoices(),prefs.voice,prefs.language||'pt-BR',prefs.voiceGender)
  utterance.onstart=()=>{if(current.current===utterance){setError('');setState('speaking')}}
  utterance.onpause=()=>{if(current.current===utterance)setState('paused')}
  utterance.onresume=()=>{if(current.current===utterance)setState('speaking')}
  utterance.onend=()=>{if(current.current===utterance){current.current=undefined;setState('idle')}}
  utterance.onerror=event=>{
   if(current.current!==utterance||event.error==='canceled'||event.error==='interrupted')return
   current.current=undefined
   setError('Não foi possível usar a voz do dispositivo. Toque para tentar novamente.')
   setState('error')
  }
  current.current=utterance
  last.current={text:clean,at:Date.now()}
  window.speechSynthesis.speak(utterance)
  return true
 },[prefs,supported])

 const pause=()=>{if(!supported||!window.speechSynthesis.speaking)return;window.speechSynthesis.pause();setState('paused')}
 const resume=()=>{if(!supported)return;window.speechSynthesis.resume();setState('speaking')}
 useEffect(()=>stop,[stop])
 return{state,voices,supported,speak,pause,resume,stop,error}
}
