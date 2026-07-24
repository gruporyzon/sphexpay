import { useMemo,useState } from 'react'
import { BellRing,RefreshCcw,RotateCcw,Volume2 } from 'lucide-react'
import { useDemoStore } from '../../store/useDemoStore'
import { useSound } from '../../hooks/useSound'
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis'

const iphoneGuideKey='sphexpay_iphone_install_guide_dismissed'
const standalone=()=>matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone)

export function SoundSettings(){
 const store=useDemoStore(),notifications=store.preferences.notifications,assistant=store.preferences.assistant,sales=store.preferences.sales
 const sound=useSound(),speech=useSpeechSynthesis(),[message,setMessage]=useState(''),[showGuide,setShowGuide]=useState(()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)&&!standalone()&&localStorage.getItem(iphoneGuideKey)!=='true')
 const permission='Notification'in window?Notification.permission:'unsupported'
 const diagnostics=useMemo(()=>({browser:navigator.userAgent.includes('CriOS')?'Chrome iOS':navigator.userAgent.includes('Android')?'Chrome/Android':navigator.userAgent.includes('Safari')&&!navigator.userAgent.includes('Chrome')?'Safari':'Navegador compatível',pwa:standalone()?'Instalada':'Navegador',context:sound.contextState,voice:speech.voices.length?`${speech.voices.length} disponível(is)`:'Aguardando voz do dispositivo',permission}),[permission,sound.contextState,speech.voices.length])
 const updateNotifications=(values:Partial<typeof notifications>)=>store.updatePreferences('notifications',values)
 const updateAssistant=(values:Partial<typeof assistant>)=>store.updatePreferences('assistant',values)
 const activate=async()=>setMessage(await sound.activate()?'Áudio ativo.':'O navegador manteve o áudio bloqueado.')
 const testVoice=async()=>setMessage(await speech.speak('Os sons da SphexPay estão funcionando corretamente.',true)?'Teste de voz iniciado.':speech.error)
 const restore=()=>{updateNotifications({sound:true,vibration:true,soundVolume:.35,soundStyle:'signal'});store.updatePreferences('sales',{saleSound:true});updateAssistant({readAloud:true,volume:1,voice:'',voiceGender:'female',language:'pt-BR',speechRate:.96,pitch:1.04});setMessage('Configurações de som restauradas.')}
 const general=Math.round(((notifications.soundVolume+assistant.volume)/2)*100)
 const setGeneral=(value:number)=>{updateNotifications({soundVolume:value});updateAssistant({volume:value})}

 return <div className="sound-settings">
  <div className={`sound-status-card ${sound.unlocked?'active':'blocked'}`}><span><i/>{sound.unlocked?'Áudio ativo':sound.enabled?'Áudio bloqueado ou suspenso':'Sons desativados'}</span><small>{sound.lastError||'O volume e o modo silencioso são controlados também pelo dispositivo.'}</small></div>
  <div className="sound-settings-grid">
   <section><h3>Sons e voz</h3><Toggle label="Sons da SphexPay" checked={sound.enabled} onChange={value=>{if(value)void activate();else sound.disable()}}/><Toggle label="Som de vendas" checked={sales.saleSound} onChange={saleSound=>store.updatePreferences('sales',{saleSound})}/><Toggle label="Som de alertas" checked={notifications.sound} onChange={sound=>updateNotifications({sound})}/><Toggle label="Voz da inteligência artificial" checked={assistant.readAloud} onChange={readAloud=>updateAssistant({readAloud})}/><Toggle label="Vibração" checked={notifications.vibration} onChange={vibration=>updateNotifications({vibration})}/></section>
   <section><h3>Volumes</h3><Range label="Volume geral" value={general/100} onChange={setGeneral}/><Range label="Volume da voz" value={assistant.volume} onChange={volume=>updateAssistant({volume})}/><Range label="Volume das notificações" value={notifications.soundVolume} onChange={soundVolume=>updateNotifications({soundVolume})}/><div className="voice-gender sound-gender">{([['female','Voz feminina'],['male','Voz masculina'],['auto','Automática']] as const).map(([value,label])=>{const profile=value==='female'?speech.pair.female:value==='male'?speech.pair.male:speech.pair.device;return <button disabled={!profile} className={assistant.voiceGender===value?'active':''} onClick={()=>profile&&updateAssistant({voiceGender:value,voice:profile.voiceURI})} key={value}>{label}</button>})}</div></section>
  </div>
  <div className="sound-actions"><button className="btn btn-primary" onClick={()=>void sound.testSound().then(ok=>setMessage(ok?'Som reproduzido.':'Não foi possível reproduzir o som.'))}><BellRing/> Testar som</button><button className="btn" onClick={testVoice}><Volume2/> Testar voz</button><button className="btn" onClick={activate}><RefreshCcw/> Reativar áudio</button><button className="btn" onClick={restore}><RotateCcw/> Restaurar configurações</button></div>
  {message&&<p className="sound-message" role="status">{message}</p>}
  <section className="audio-diagnostics"><h3>Diagnóstico do dispositivo</h3><dl><div><dt>Navegador</dt><dd>{diagnostics.browser}</dd></div><div><dt>Execução</dt><dd>{diagnostics.pwa}</dd></div><div><dt>AudioContext</dt><dd>{diagnostics.context}</dd></div><div><dt>Voz</dt><dd>{diagnostics.voice}</dd></div><div><dt>Notificações</dt><dd>{diagnostics.permission}</dd></div><div><dt>Som do aparelho</dt><dd>Controle do usuário</dd></div></dl><button className="btn" onClick={()=>{sound.diagnostics();setMessage('Diagnóstico seguro registrado no console.')}}>Atualizar diagnóstico</button></section>
  {showGuide&&<section className="iphone-audio-guide"><button aria-label="Não mostrar novamente" onClick={()=>{localStorage.setItem(iphoneGuideKey,'true');setShowGuide(false)}}>Fechar</button><h3>Notificações completas no iPhone</h3><p>Para receber notificações completas no iPhone, adicione a SphexPay à Tela de Início.</p><ol><li>Toque em Compartilhar.</li><li>Selecione “Adicionar à Tela de Início”.</li><li>Abra a SphexPay pelo novo ícone.</li><li>Ative as notificações.</li><li>Ative sons e voz dentro da SphexPay.</li></ol><small>O modo silencioso, o Foco e o volume do iPhone podem impedir o som.</small></section>}
 </div>
}

function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(value:boolean)=>void}){return <label className="setting-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)}/><i/></label>}
function Range({label,value,onChange}:{label:string;value:number;onChange:(value:number)=>void}){return <label className="block mt-4"><span className="label">{label}: {Math.round(value*100)}%</span><input aria-label={label} className="w-full accent-orange-600" type="range" min="0" max="1" step=".05" value={value} onChange={event=>onChange(Number(event.target.value))}/></label>}
