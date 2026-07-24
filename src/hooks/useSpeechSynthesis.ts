import { useCallback,useEffect,useMemo,useRef,useState } from 'react'
import { useDemoStore } from '../store/useDemoStore'
import { voiceService } from '../services/voiceService'
import { audioManager } from '../services/audioManager'

export type SpeechState='idle'|'speaking'|'paused'|'error'

export function useSpeechSynthesis(){
 const [state,setState]=useState<SpeechState>('idle'),[voices,setVoices]=useState<SpeechSynthesisVoice[]>([]),[error,setError]=useState(''),[level,setLevel]=useState(0)
 const prefs=useDemoStore(s=>s.preferences.assistant),current=useRef<SpeechSynthesisUtterance|undefined>(undefined),last=useRef<{text:string;at:number}|undefined>(undefined),pulse=useRef(0),errorTimer=useRef<number|undefined>(undefined),frame=useRef<number|undefined>(undefined)
 const supported='speechSynthesis'in window&&'SpeechSynthesisUtterance'in window
 const pair=useMemo(()=>voiceService.pair(voices,prefs.language),[voices,prefs.language])

 useEffect(()=>{
  if(!supported)return
  const synth=window.speechSynthesis
  const load=()=>setVoices(voiceService.sorted(synth.getVoices(),prefs.language,'auto'))
  load()
  synth.addEventListener?.('voiceschanged',load)
  const retries=[250,1000,2500].map(delay=>window.setTimeout(load,delay))
  return()=>{synth.removeEventListener?.('voiceschanged',load);retries.forEach(clearTimeout)}
 },[prefs.language,supported])

 useEffect(()=>{
  if(state!=='speaking'){setLevel(0);return}
  let previous=0
  const animate=(time:number)=>{
   if(time-previous>32){
    previous=time
    const boundary=Math.max(0,pulse.current-time)/260
    setLevel(Math.min(1,.2+Math.abs(Math.sin(time*.0063))*.28+Math.abs(Math.sin(time*.0117))*.16+boundary*.42))
   }
   frame.current=requestAnimationFrame(animate)
  }
  frame.current=requestAnimationFrame(animate)
  return()=>{if(frame.current)cancelAnimationFrame(frame.current);frame.current=undefined;setLevel(0)}
 },[state])

 const clearErrorLater=useCallback(()=>{
  if(errorTimer.current)clearTimeout(errorTimer.current)
  errorTimer.current=window.setTimeout(()=>setState(value=>value==='error'?'idle':value),2600)
 },[])
 const fail=useCallback((message:string)=>{setError(message);setState('error');clearErrorLater();return false},[clearErrorLater])
 const stop=useCallback(()=>{
  if(supported)window.speechSynthesis.cancel()
  current.current=undefined
  setLevel(0)
  setState('idle')
 },[supported])

 const speak=useCallback(async(text:string,fromUserGesture=false,selectedVoiceURI?:string)=>{
  const clean=text.trim()
  if(!clean||!supported)return fail('Não foi possível reproduzir a resposta.')
  if(last.current?.text===clean&&Date.now()-last.current.at<500)return false
  if(audioManager.isMobile()){
   const ready=await audioManager.ensureAudioReady(fromUserGesture)
   if(!ready)return fail('Toque em reproduzir para liberar o áudio neste dispositivo.')
  }
  const available=window.speechSynthesis.getVoices(),requested=selectedVoiceURI??prefs.voice
  if(requested&&!voiceService.profile(available,requested)&&!available.some(item=>item.name===requested))return fail('A voz escolhida não está mais disponível.')
  const selection=voiceService.select(available,requested,prefs.language||'pt-BR',prefs.voiceGender)
  if(!selection)return fail(prefs.voiceGender==='male'?'A voz masculina não está disponível neste aparelho.':prefs.voiceGender==='female'?'A voz feminina não está disponível neste aparelho.':'Nenhuma voz em português foi encontrada neste dispositivo.')
  window.speechSynthesis.cancel()
  const utterance=new SpeechSynthesisUtterance(clean)
  utterance.voice=selection
  utterance.lang=selection.lang||prefs.language||'pt-BR'
  utterance.rate=prefs.voiceGender==='male'?Math.min(.99,Math.max(.92,prefs.speechRate)):Math.min(1,Math.max(.94,prefs.speechRate))
  utterance.pitch=prefs.pitch
  utterance.volume=prefs.volume
  utterance.onstart=()=>{if(current.current===utterance){setError('');setState('speaking')}}
  utterance.onboundary=()=>{pulse.current=performance.now()+260}
  utterance.onpause=()=>{if(current.current===utterance)setState('paused')}
  utterance.onresume=()=>{if(current.current===utterance)setState('speaking')}
  utterance.onend=()=>{if(current.current===utterance){current.current=undefined;setLevel(0);setState('idle')}}
  utterance.onerror=event=>{
   if(current.current!==utterance||event.error==='canceled'||event.error==='interrupted')return
   current.current=undefined
   setLevel(0)
   fail('Não foi possível reproduzir a resposta.')
  }
  current.current=utterance
  last.current={text:clean,at:Date.now()}
  window.speechSynthesis.speak(utterance)
  return true
 },[fail,prefs,supported])

 const testVoice=useCallback((voiceURI:string,gender:'female'|'male')=>speak(gender==='female'?'Olá, sou a assistente financeira da SphexPay. Estou pronta para ajudar.':'Olá, sou o assistente financeiro da SphexPay. Estou pronto para ajudar.',true,voiceURI),[speak])
 const pause=()=>{if(!supported||!window.speechSynthesis.speaking)return;window.speechSynthesis.pause();setState('paused')}
 const resume=()=>{if(!supported)return;window.speechSynthesis.resume();setState('speaking')}
 useEffect(()=>()=>{if(errorTimer.current)clearTimeout(errorTimer.current);if(frame.current)cancelAnimationFrame(frame.current)},[])
 useEffect(()=>stop,[stop])
 return{state,voices,pair,supported,speak,testVoice,pause,resume,stop,error,level}
}
