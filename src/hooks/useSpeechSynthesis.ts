import { useCallback,useEffect,useState } from 'react'
import { useDemoStore } from '../store/useDemoStore'
import { voiceService } from '../services/voiceService'
export function useSpeechSynthesis(){const [state,setState]=useState<'idle'|'speaking'|'paused'>('idle'),[voices,setVoices]=useState<SpeechSynthesisVoice[]>([]),prefs=useDemoStore(s=>s.preferences.assistant)
 useEffect(()=>{if(!('speechSynthesis'in window))return;const synth=window.speechSynthesis,load=()=>setVoices(voiceService.sorted(synth.getVoices(),prefs.language,prefs.voiceGender));load();synth.addEventListener?.('voiceschanged',load);return()=>synth.removeEventListener?.('voiceschanged',load)},[prefs.language,prefs.voiceGender])
 const stop=useCallback(()=>{if('speechSynthesis'in window)window.speechSynthesis.cancel();setState('idle')},[])
 const speak=useCallback((text:string)=>{if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window))return false;if(prefs.interruptOnSend)stop();const utterance=new SpeechSynthesisUtterance(text);utterance.lang=prefs.language;utterance.rate=prefs.speechRate;utterance.pitch=prefs.pitch;utterance.volume=prefs.volume;utterance.voice=voiceService.select(window.speechSynthesis.getVoices(),prefs.voice,prefs.language,prefs.voiceGender);utterance.onstart=()=>setState('speaking');utterance.onend=()=>setState('idle');utterance.onerror=()=>setState('idle');window.speechSynthesis.speak(utterance);return true},[prefs,stop])
 const pause=()=>{if(!('speechSynthesis'in window))return;window.speechSynthesis.pause();setState('paused')},resume=()=>{if(!('speechSynthesis'in window))return;window.speechSynthesis.resume();setState('speaking')};useEffect(()=>stop,[stop]);return{state,voices,supported:'speechSynthesis'in window,speak,pause,resume,stop}
}
