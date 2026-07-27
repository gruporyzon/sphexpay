import { BellRing,ChevronDown,Monitor,RefreshCcw,Send,Smartphone } from 'lucide-react'
import { useCallback,useEffect,useMemo,useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { formatManualNotification,manualNotificationTemplates,notificationVariables,type ManualNotificationDraft,type ManualNotificationType } from '../../lib/manualNotification'
import { browserPermissionService,type BrowserNotificationStatus } from '../../services/browserPermissionService'
import { pushSubscriptionService,type PushDevice,type PushSendResult } from '../../services/pushSubscriptionService'
import { useDemoStore } from '../../store/useDemoStore'
import type { NotificationPreferences } from '../../types'
import { SphexPayLogo } from '../branding/SphexPayLogo'

type PreviewDevice='iphone'|'android'|'desktop'
type RecentDelivery={id:string;type:string;title:string;createdAt:string;sent:number;failed:number;expired:number}
const historyKey='sphexpay_manual_push_history_v1'
const initialDraft:ManualNotificationDraft={...manualNotificationTemplates.sale_approved,notificationType:'sale_approved',value:'',currency:'BRL',product:'',customer:'',method:'',route:'/app',icon:'/icons/sphexpay-app-192.png',showTime:true}
const readHistory=()=>{try{return(JSON.parse(localStorage.getItem(historyKey)||'[]') as RecentDelivery[]).slice(0,12)}catch{return[]}}
const permissionMessage=(status:BrowserNotificationStatus,code?:string)=>{
 if(status==='denied'||code==='PUSH_PERMISSION_NOT_ALLOWED')return'As notificações estão bloqueadas no navegador.'
 if(code==='SESSION_MISSING'||code==='INVALID_ACCESS_TOKEN')return'Sua sessão expirou. Entre novamente.'
 return'Não foi possível conectar este dispositivo.'
}
const relativeTime=(value:string)=>{const seconds=Math.max(0,Math.round((Date.now()-new Date(value).getTime())/1000));if(seconds<60)return'agora';if(seconds<3600)return`há ${Math.floor(seconds/60)} min`;if(seconds<86400)return`há ${Math.floor(seconds/3600)} h`;return new Date(value).toLocaleDateString('pt-BR')}

export function NotificationDelivery(){
 const {user}=useAuth(),preferences=useDemoStore(state=>state.preferences.notifications),update=useDemoStore(state=>state.updatePreferences)
 const [permission,setPermission]=useState<BrowserNotificationStatus>(()=>browserPermissionService.status()),[devices,setDevices]=useState<PushDevice[]>([]),[loading,setLoading]=useState(true),[connecting,setConnecting]=useState(false),[draft,setDraft]=useState<ManualNotificationDraft>(initialDraft),[target,setTarget]=useState('current'),[preview,setPreview]=useState<PreviewDevice>('iphone'),[sending,setSending]=useState(false),[sendState,setSendState]=useState<'idle'|'sent'|'failed'>('idle'),[message,setMessage]=useState(''),[history,setHistory]=useState<RecentDelivery[]>(readHistory)
 const activeDevices=devices.filter(device=>device.enabled&&(device.status==='Conectado'||device.status==='Ativo'))
 const currentDevice=activeDevices.find(device=>device.isCurrentDevice)
 const formatted=useMemo(()=>formatManualNotification(draft),[draft])
 const updateDraft=(values:Partial<ManualNotificationDraft>)=>setDraft(current=>({...current,...values}))
 const refresh=useCallback(async()=>{setLoading(true);try{const registered=await pushSubscriptionService.devices();setDevices(registered);setPermission(browserPermissionService.status());setTarget(current=>current==='current'&&!registered.some(device=>device.isCurrentDevice&&device.enabled)?'all':current)}finally{setLoading(false)}},[])

 useEffect(()=>{let active=true;(async()=>{if(!user){setMessage('Sua sessão expirou. Entre novamente.');setLoading(false);return}if(browserPermissionService.status()==='granted'){const result=await pushSubscriptionService.subscribe();if(!active)return;if(!result.ok)console.warn('[PUSH] Device reconciliation failed',result.code);else setMessage('O dispositivo foi conectado.')}if(active)await refresh()})();return()=>{active=false}},[user,refresh])

 const activate=async()=>{if(connecting)return;if(!user){setMessage('Sua sessão expirou. Entre novamente.');return}setConnecting(true);setMessage('');try{const result=await pushSubscriptionService.subscribe();setPermission(browserPermissionService.status());if(result.ok){setMessage('O dispositivo foi conectado.');await refresh()}else{console.warn('[PUSH] Device activation failed',result.code);setMessage(permissionMessage(browserPermissionService.status(),result.code))}}finally{setConnecting(false)}}
 const selectType=(notificationType:ManualNotificationType)=>{const template=manualNotificationTemplates[notificationType];setDraft(current=>({...current,...template,notificationType}))}
 const insertVariable=(variable:string)=>updateDraft({body:`${draft.body}${draft.body.endsWith(' ')||!draft.body?'':' '}${variable}`.slice(0,180)})
 const selectedDeviceIds=()=>target==='all'?activeDevices.map(device=>device.deviceId):target==='current'?(currentDevice?[currentDevice.deviceId]:[]):[target]
 const send=async()=>{if(sending)return;const missing=formatted.missing;if(missing.length){setSendState('failed');setMessage(`Preencha: ${missing.join(', ')}.`);return}const deviceIds=selectedDeviceIds();if(!deviceIds.length){setSendState('failed');setMessage('Nenhum dispositivo conectado foi selecionado.');return}setSending(true);setSendState('idle');setMessage('');try{const result=await pushSubscriptionService.sendManual({notificationType:draft.notificationType,title:formatted.title,body:formatted.body,route:draft.route,icon:draft.icon,deviceIds,currency:draft.currency});const recent={id:result.eventId||crypto.randomUUID(),type:manualNotificationTemplates[draft.notificationType].label,title:formatted.title,createdAt:new Date().toISOString(),sent:result.sent||0,failed:result.failed||0,expired:result.expired||0};setHistory(current=>{const next=[recent,...current].slice(0,12);localStorage.setItem(historyKey,JSON.stringify(next));return next});setSendState(result.ok?'sent':'failed');setMessage(deliveryMessage(result));if((result.expired||0)>0)await refresh()}finally{setSending(false)}}
 const setPreference=(values:Partial<NotificationPreferences>)=>update('notifications',values)
 const connection=loading?{tone:'pending',label:'Conectando dispositivo'}:activeDevices.length?{tone:'connected',label:'Dispositivos conectados'}:{tone:'disconnected',label:'Nenhum dispositivo conectado'}

 return <div className="push-studio">
  <header className="push-studio-header"><div><span>NOTIFICAÇÕES PUSH</span><h2>Gerador de notificações</h2><p>Crie e envie alertas Push para seus dispositivos conectados.</p></div><div className={`push-connection ${connection.tone}`}><i/>{connection.label}</div></header>

  {!activeDevices.length&&<section className="push-activation"><div className="push-activation-icon"><BellRing/></div><div><h3>Ativar notificações</h3><p>Autorize este dispositivo para receber alertas da SphexPay.</p></div><button className="btn btn-primary" onClick={()=>void activate()} disabled={connecting||permission==='denied'}>{connecting?'Conectando…':'Ativar neste dispositivo'}</button></section>}
  {message&&<p className={`push-feedback ${sendState}`} role="status" aria-live="polite">{message}</p>}

  <div className="push-studio-grid">
   <div className="push-studio-editor">
    <section className="push-studio-section"><header><span>01</span><div><h3>Conteúdo</h3><p>Personalize a mensagem que será entregue.</p></div></header>
     <div className="push-form-grid">
      <label className="wide"><span>Tipo</span><select value={draft.notificationType} onChange={event=>selectType(event.target.value as ManualNotificationType)}>{Object.entries(manualNotificationTemplates).map(([value,template])=><option value={value} key={value}>{template.label}</option>)}</select></label>
      <label className="wide"><span>Título</span><input aria-describedby="push-title-count" maxLength={80} value={draft.title} onChange={event=>updateDraft({title:event.target.value})}/><small id="push-title-count">{draft.title.length}/80</small></label>
      <label className="wide"><span>Mensagem</span><textarea aria-describedby="push-body-count" maxLength={180} rows={4} value={draft.body} onChange={event=>updateDraft({body:event.target.value})}/><small id="push-body-count">{draft.body.length}/180</small></label>
      <div className="push-variable-row wide" aria-label="Variáveis disponíveis">{notificationVariables.map(variable=><button type="button" onClick={()=>insertVariable(variable)} key={variable}>{variable}</button>)}</div>
      <label><span>Valor opcional</span><input inputMode="decimal" placeholder="0,00" value={draft.value} onChange={event=>updateDraft({value:event.target.value})}/></label>
      <label><span>Moeda</span><select value={draft.currency} onChange={event=>updateDraft({currency:event.target.value as ManualNotificationDraft['currency']})}><option>BRL</option><option>USD</option><option>EUR</option></select></label>
      <label><span>Produto opcional</span><input value={draft.product} onChange={event=>updateDraft({product:event.target.value})}/></label>
      <label><span>Método opcional</span><input value={draft.method} onChange={event=>updateDraft({method:event.target.value})}/></label>
      <label className="wide"><span>Cliente opcional</span><input value={draft.customer} onChange={event=>updateDraft({customer:event.target.value})}/></label>
      <label><span>Rota de destino</span><input value={draft.route} onChange={event=>updateDraft({route:event.target.value})}/></label>
      <label><span>Ícone</span><select value={draft.icon} onChange={event=>updateDraft({icon:event.target.value})}><option value="/icons/sphexpay-app-192.png">SphexPay</option><option value="/icons/sphexpay-app-512.png">SphexPay grande</option></select></label>
      <label className="push-checkbox wide"><input type="checkbox" checked={draft.showTime} onChange={event=>updateDraft({showTime:event.target.checked})}/><span>Exibir horário</span></label>
     </div>
    </section>

    <section className="push-studio-section"><header><span>02</span><div><h3>Enviar para</h3><p>Escolha dispositivos conectados à sua conta.</p></div></header>
     <div className="push-destinations">
      <Destination checked={target==='all'} onChange={()=>setTarget('all')} title="Todos os dispositivos conectados" detail={`${activeDevices.length} dispositivo(s) ativo(s)`}/>
      <Destination checked={target==='current'} onChange={()=>setTarget('current')} disabled={!currentDevice} title="Dispositivo atual" detail={currentDevice?`${currentDevice.name} · ${currentDevice.browser} no ${currentDevice.operatingSystem}`:'Este navegador ainda não está conectado'}/>
      {activeDevices.map(device=><Destination checked={target===device.deviceId} onChange={()=>setTarget(device.deviceId)} title={device.name} detail={`${device.browser} no ${device.operatingSystem}${device.isCurrentDevice?' · Este dispositivo':''} · ${relativeTime(device.lastSeenAt)}`} key={device.id}/>)}
     </div>
    </section>
   </div>

   <aside className="push-studio-preview"><section><header><div><h3>Pré-visualização</h3><p>Aparência aproximada no dispositivo.</p></div><nav aria-label="Dispositivo da pré-visualização">{([['iphone','iPhone',Smartphone],['android','Android',Smartphone],['desktop','Desktop',Monitor]] as const).map(([value,label,Icon])=><button aria-pressed={preview===value} className={preview===value?'active':''} onClick={()=>setPreview(value)} key={value}><Icon/>{label}</button>)}</nav></header><div className={`push-preview-device ${preview}`}><div className="push-preview-top"><span>SphexPay</span>{draft.showTime&&<time>agora</time>}</div><article><SphexPayLogo/><div><strong>{formatted.title||'Título da notificação'}</strong><p>{formatted.body||'Sua mensagem aparecerá aqui.'}</p></div></article></div></section>
    <section className="push-send-card"><span>03</span><h3>Envio</h3><p>O backend entrega via web-push e registra cada tentativa.</p><button className={`btn btn-primary ${sendState}`} onClick={()=>void send()} disabled={sending||!activeDevices.length||formatted.missing.length>0}><Send/>{sending?'Enviando…':sendState==='sent'?'Enviada':sendState==='failed'?'Falha no envio':'Enviar notificação'}</button>{!activeDevices.length&&<small>Conecte um dispositivo para liberar o envio.</small>}</section>
   </aside>
  </div>

  <section className="push-history"><header><div><span>04</span><div><h3>Envios recentes</h3><p>Resultados confirmados pelo backend nesta conta e neste navegador.</p></div></div><button className="btn btn-ghost" onClick={()=>setHistory(readHistory())}><RefreshCcw/> Atualizar histórico</button></header><div>{history.map(item=><article key={item.id}><div><i className={item.sent?item.failed?'partial':'delivered':'failed'}/><span><b>{item.title}</b><small>{item.type} · {new Date(item.createdAt).toLocaleString('pt-BR')}</small></span></div><dl><div><dt>Enviadas</dt><dd>{item.sent}</dd></div><div><dt>Falhas</dt><dd>{item.failed}</dd></div><div><dt>Status</dt><dd>{item.sent?item.failed?'Parcial':'Entregue':'Falhou'}</dd></div></dl></article>)}{!history.length&&<p>Nenhum envio manual realizado ainda.</p>}</div>
   <details className="push-preferences"><summary>Preferências de alertas automáticos <ChevronDown/></summary><div><Preference label="Vendas" checked={preferences.sales} onChange={sales=>setPreference({sales})}/><Preference label="Pix" checked={preferences.pixGenerated!==false} onChange={pixGenerated=>setPreference({pixGenerated})}/><Preference label="Cartões" checked={preferences.cardApproved!==false} onChange={cardApproved=>setPreference({cardApproved})}/><Preference label="Boletos" checked={preferences.boletoEvents!==false} onChange={boletoEvents=>setPreference({boletoEvents})}/><Preference label="Assinaturas" checked={preferences.subscriptionEvents!==false} onChange={subscriptionEvents=>setPreference({subscriptionEvents})}/><Preference label="Saques" checked={preferences.withdrawalEvents!==false} onChange={withdrawalEvents=>setPreference({withdrawalEvents})}/></div></details>
  </section>
 </div>
}

function Destination({checked,onChange,title,detail,disabled=false}:{checked:boolean;onChange:()=>void;title:string;detail:string;disabled?:boolean}){return <label className={disabled?'disabled':''}><input type="radio" name="push-destination" checked={checked} onChange={onChange} disabled={disabled}/><span><b>{title}</b><small>{detail}</small></span><i/></label>}
function Preference({label,checked,onChange}:{label:string;checked:boolean;onChange:(value:boolean)=>void}){return <label><span>{label}</span><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)}/><i/></label>}
function deliveryMessage(result:PushSendResult){if(result.ok&&result.failed)return`Enviada para ${result.sent} dispositivo(s). ${result.failed} falha(s).`;if(result.ok)return`Enviada para ${result.sent||0} dispositivo${result.sent===1?'':'s'}.`;if(result.expired)return`${result.expired} dispositivo expirado. Conecte-o novamente.`;return'Não foi possível entregar a notificação.'}
