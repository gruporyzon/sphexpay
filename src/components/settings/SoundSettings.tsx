import {translate as uiText} from '../../i18n'
import {useAppLocale} from '../../i18n/localeStore'
import {T} from '../../i18n'
import { useMemo,useState } from 'react'
import { RefreshCcw,RotateCcw,Volume2 } from 'lucide-react'
import { useDemoStore } from '../../store/useDemoStore'
import { useSound } from '../../hooks/useSound'
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis'

const iphoneGuideKey='sphexpay_iphone_install_guide_dismissed'
const standalone=()=>matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone)

export function SoundSettings(){useAppLocale(state=>state.locale);
 const store=useDemoStore(),assistant=store.preferences.assistant
 const sound=useSound(),speech=useSpeechSynthesis(),[message,setMessage]=useState(''),[showGuide,setShowGuide]=useState(()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)&&!standalone()&&localStorage.getItem(iphoneGuideKey)!=='true')
 const permission='Notification'in window?Notification.permission:'unsupported'
 const diagnostics=useMemo(()=>({browser:navigator.userAgent.includes('CriOS')?'Chrome iOS':navigator.userAgent.includes('Android')?'Chrome/Android':navigator.userAgent.includes('Safari')&&!navigator.userAgent.includes('Chrome')?'Safari':'Navegador compatível',pwa:standalone()?'Instalada':'Navegador',context:sound.contextState,voice:speech.voices.length?`${speech.voices.length} disponível(is)`:'Aguardando voz do dispositivo',permission}),[permission,sound.contextState,speech.voices.length])
 const updateAssistant=(values:Partial<typeof assistant>)=>store.updatePreferences('assistant',values)
 const activate=async()=>setMessage(await sound.activate()?'Áudio ativo.':'O navegador manteve o áudio bloqueado.')
 const testVoice=async()=>setMessage(await speech.speak('Os sons da SphexPay estão funcionando corretamente.',true)?'Teste de voz iniciado.':speech.error)
 const restore=()=>{updateAssistant({readAloud:true,volume:1,voice:'',voiceGender:'female',language:'pt-BR',speechRate:.96,pitch:1.04});setMessage('Configurações de voz restauradas.')}

 return <div className="sound-settings">
  <div className={`sound-status-card ${sound.unlocked?'active':'blocked'}`}><span><i/><T>{sound.unlocked?'Áudio ativo':sound.enabled?'Áudio bloqueado ou suspenso':'Sons desativados'}</T></span><small>{sound.lastError||'O volume e o modo silencioso são controlados também pelo dispositivo.'}</small></div>
  <div className="sound-settings-grid">
   <section><h3><T>Voz da inteligência artificial</T></h3><Toggle label="Áudio da inteligência artificial" checked={sound.enabled} onChange={value=>{if(value)void activate();else sound.disable()}}/><Toggle label="Ler respostas em voz alta" checked={assistant.readAloud} onChange={readAloud=>updateAssistant({readAloud})}/><p className="text-xs muted mt-4"><T>Sons de notificações comerciais são controlados exclusivamente pelo sistema operacional.</T></p></section>
   <section><h3><T>Voz</T></h3><Range label="Volume da voz" value={assistant.volume} onChange={volume=>updateAssistant({volume})}/><div className="voice-gender sound-gender">{([['female','Voz feminina'],['male','Voz masculina'],['auto','Automática']] as const).map(([value,label])=>{const profile=value==='female'?speech.pair.female:value==='male'?speech.pair.male:speech.pair.device;return <button disabled={!profile} className={assistant.voiceGender===value?'active':''} onClick={()=>profile&&updateAssistant({voiceGender:value,voice:profile.voiceURI})} key={value}><T>{label}</T></button>})}</div></section>
  </div>
  <div className="sound-actions"><button className="btn btn-primary" onClick={testVoice}><Volume2/><T> Testar voz</T></button><button className="btn" onClick={activate}><RefreshCcw/><T> Reativar áudio</T></button><button className="btn" onClick={restore}><RotateCcw/><T> Restaurar configurações</T></button></div>
  {message&&<p className="sound-message" role="status">{message}</p>}
  <section className="audio-diagnostics"><h3><T>Diagnóstico do dispositivo</T></h3><dl><div><dt><T>Navegador</T></dt><dd>{diagnostics.browser}</dd></div><div><dt><T>Execução</T></dt><dd>{diagnostics.pwa}</dd></div><div><dt><T>AudioContext</T></dt><dd>{diagnostics.context}</dd></div><div><dt><T>Voz</T></dt><dd>{diagnostics.voice}</dd></div><div><dt><T>Notificações</T></dt><dd>{diagnostics.permission}</dd></div><div><dt><T>Som do aparelho</T></dt><dd><T>Controle do usuário</T></dd></div></dl><button className="btn" onClick={()=>{sound.diagnostics();setMessage('Diagnóstico seguro registrado no console.')}}><T>Atualizar diagnóstico</T></button></section>
  {showGuide&&<section className="iphone-audio-guide"><button aria-label={uiText("Não mostrar novamente")} onClick={()=>{localStorage.setItem(iphoneGuideKey,'true');setShowGuide(false)}}><T>Fechar</T></button><h3><T>Notificações completas no iPhone</T></h3><p><T>Para receber notificações completas no iPhone, adicione a SphexPay à Tela de Início.</T></p><ol><li><T>Toque em Compartilhar.</T></li><li><T>Selecione “Adicionar à Tela de Início”.</T></li><li><T>Abra a SphexPay pelo novo ícone.</T></li><li><T>Ative as notificações.</T></li><li><T>Ative sons e voz dentro da SphexPay.</T></li></ol><small><T>O modo silencioso, o Foco e o volume do iPhone podem impedir o som.</T></small></section>}
 </div>
}

function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(value:boolean)=>void}){useAppLocale(state=>state.locale);return <label className="setting-toggle"><span><T>{label}</T></span><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)}/><i/></label>}
function Range({label,value,onChange}:{label:string;value:number;onChange:(value:number)=>void}){useAppLocale(state=>state.locale);return <label className="block mt-4"><span className="label"><T>{label}</T>: {Math.round(value*100)}%</span><input aria-label={label} className="w-full accent-orange-600" type="range" min="0" max="1" step=".05" value={value} onChange={event=>onChange(Number(event.target.value))}/></label>}
