import { Check,Volume2 } from 'lucide-react'
import { useDemoStore } from '../../store/useDemoStore'
import { voiceService,type VoiceGender,type VoiceProfile } from '../../services/voiceService'
import { premiumTTSProvider } from '../../services/ttsProvider'

export function VoicePreferences({voices,onPreview}:{voices:SpeechSynthesisVoice[];onPreview:(voiceURI:string,gender:'female'|'male')=>void}){
 const preferences=useDemoStore(state=>state.preferences.assistant),update=useDemoStore(state=>state.updatePreferences),pair=voiceService.pair(voices,preferences.language),catalog=voiceService.catalog(voices)
 const set=(values:Partial<typeof preferences>)=>update('assistant',values)
 const select=(gender:VoiceGender,profile:VoiceProfile|null)=>{
  if(!profile)return
  set({voiceGender:gender,voice:profile.voiceURI,speechRate:gender==='male'?.95:.97,pitch:1})
 }
 const options=[
  pair.female&&{id:'female' as const,title:'Voz feminina',profile:pair.female},
  pair.male&&pair.male.voiceURI!==pair.female?.voiceURI&&{id:'male' as const,title:'Voz masculina',profile:pair.male},
  pair.device&&{id:'auto' as const,title:'Voz do dispositivo',profile:pair.device}
 ].filter(Boolean) as {id:VoiceGender;title:string;profile:VoiceProfile}[]

 return <section className="voice-preferences premium-voice-selector"><div className="voice-preferences-head"><div><span>PERFIL DE VOZ</span><h3>Voz da inteligência</h3></div><small>{catalog.length} voz(es)</small></div><div className="voice-profile-list">{options.map(option=>{const active=preferences.voice===option.profile.voiceURI&&preferences.voiceGender===option.id;return <article className={active?'active':''} key={`${option.id}-${option.profile.voiceURI}`}><button className="voice-profile-select" onClick={()=>select(option.id,option.profile)} aria-pressed={active}><i>{active&&<Check/>}</i><span><b>{option.title}</b><small>{option.profile.name}</small><em>{option.profile.lang} · {option.profile.localService?'No dispositivo':'Remota'}</em></span></button>{option.id!=='auto'&&<button className="voice-profile-demo" onClick={()=>onPreview(option.profile.voiceURI,option.id as 'female'|'male')} aria-label={`Testar ${option.title.toLowerCase()}`}><Volume2/></button>}</article>})}</div>{pair.message&&<p className="voice-availability">{pair.message}</p>}<label className="voice-all"><span>Todas as vozes disponíveis</span><select className="input" value={preferences.voice} onChange={event=>set({voice:event.target.value,voiceGender:'auto'})}><option value="">Seleção automática</option>{catalog.map(profile=><option value={profile.voiceURI} key={profile.voiceURI}>{profile.name} · {profile.lang} · {profile.localService?'Local':'Remota'}</option>)}</select></label>{premiumTTSProvider.available&&<button className="voice-premium-option">Modo premium</button>}<div className="voice-ranges"><Range label="Velocidade" value={preferences.speechRate} min={.9} max={1.05} step={.01} onChange={speechRate=>set({speechRate})}/><Range label="Volume" value={preferences.volume} min={0} max={1} step={.05} onChange={volume=>set({volume})}/></div><Toggle label="Ler respostas automaticamente" checked={preferences.readAloud} onChange={readAloud=>set({readAloud})}/><Toggle label="Enviar após reconhecimento" checked={preferences.autoSendVoice} onChange={autoSendVoice=>set({autoSendVoice})}/></section>
}
function Range({label,value,min,max,step,onChange}:{label:string;value:number;min:number;max:number;step:number;onChange:(value:number)=>void}){return <label><span>{label}<b>{Math.round(value*100)}%</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={event=>onChange(Number(event.target.value))}/></label>}
function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(value:boolean)=>void}){return <label className="voice-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)}/><i/></label>}
