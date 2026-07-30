import {BellRing,ChevronDown,History as HistoryIcon,Pause,Play,RefreshCcw,Send,Square} from 'lucide-react'
import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {useAuth} from '../../hooks/useAuth'
import {
 applyAiSuggestion,formatEstimatedDuration,formatManualNotification,intervalToMilliseconds,
 localNotificationVariations,manualNotificationTemplates,normalizeBrazilianAmount,notificationContent,validateSequence,valueKindLabels,
 type ManualCurrency,type ManualNotificationDraft,type ManualNotificationType,type ManualValueKind,type NotificationIntervalUnit
} from '../../lib/manualNotification'
import {ManualNotificationScheduler,type ManualSequenceSnapshot,type ManualSequenceStatus} from '../../lib/manualNotificationScheduler'
import {supabase} from '../../lib/supabase'
import {browserPermissionService,type BrowserNotificationStatus} from '../../services/browserPermissionService'
import {pushSubscriptionService,type PushDevice,type PushSendResult} from '../../services/pushSubscriptionService'
import {useDemoStore} from '../../store/useDemoStore'
import {SphexPayLogo} from '../branding/SphexPayLogo'

type Tab='generator'|'history'
type AiAction='generate'|'similar'
type AiSuggestion={id:string;label:'Direta'|'Motivacional'|'Premium';title:string;body:string;reason:string}
type AiResult={suggestions:AiSuggestion[];recommendedIndex:number}
type AiState='idle'|'loading'|'ready'|'error'|'unavailable'
type TargetMode='current'|'all'|'choose'
type SequenceMode='now'|'sequence'
type SequenceStatus=ManualSequenceStatus
type DeliveryStatus='Entregue'|'Parcial'|'Falhou'|'Programada'|'Em andamento'|'Pausada'|'Concluída'|'Cancelada'|'Interrompida'
type DeliveryHistory={
 id:string;type:ManualNotificationType;title:string;body:string;createdAt:string;
 sent:number;failed:number;expired:number;status:DeliveryStatus;destination:string;
 planned?:number;completed?:number;interval?:number;unit?:NotificationIntervalUnit;
 startedAt?:string;finishedAt?:string;cancelledAt?:string;origin?:'manual'
}
type TypeOption={id:string;type:ManualNotificationType;label:string}
type SequenceProgress={id:string;status:SequenceStatus;planned:number;completed:number;sent:number;failed:number;expired:number;nextAt:number|null}

const historyKey='sphexpay_manual_push_history_v4'
const legacyHistoryKey='sphexpay_manual_push_history_v3'
const initialDraft:ManualNotificationDraft={
 ...manualNotificationTemplates.sale_approved,notificationType:'sale_approved',value:'',
 valueKind:'commission',currency:'BRL',customer:'',method:'',route:'/app',
 icon:'/icons/sphexpay-app-192.png',showTime:true
}
const initialProgress:SequenceProgress={id:'',status:'idle',planned:1,completed:0,sent:0,failed:0,expired:0,nextAt:null}
const typeOptions:TypeOption[]=[
 {id:'sale-approved',type:'sale_approved',label:'Venda aprovada'},{id:'sale-pending',type:'sale_pending',label:'Venda pendente'},
 {id:'pix-generated',type:'pix_generated',label:'Pix gerado'},{id:'pix-paid',type:'pix_paid',label:'Pix pago'},
 {id:'card-approved',type:'credit_card_approved',label:'Cartão aprovado'},{id:'card-refused',type:'credit_card_refused',label:'Cartão recusado'},
 {id:'boleto-generated',type:'boleto_generated',label:'Boleto gerado'},
 {id:'boleto-paid',type:'boleto_paid',label:'Boleto pago'},{id:'refund',type:'refund_done',label:'Reembolso'},
 {id:'subscription',type:'subscription_renewed',label:'Assinatura renovada'},{id:'withdrawal',type:'withdrawal_completed',label:'Saque concluído'},
 {id:'custom',type:'custom',label:'Aviso personalizado'}
]
const unitLabels:Record<NotificationIntervalUnit,{singular:string;plural:string}>={seconds:{singular:'segundo',plural:'segundos'},minutes:{singular:'minuto',plural:'minutos'},hours:{singular:'hora',plural:'horas'}}
const readHistory=():DeliveryHistory[]=>{try{return JSON.parse(localStorage.getItem(historyKey)||localStorage.getItem(legacyHistoryKey)||'[]')}catch{return[]}}
const saveHistory=(value:DeliveryHistory[])=>{try{localStorage.setItem(historyKey,JSON.stringify(value))}catch{/* Histórico local complementa o log real do backend. */}}
const relativeTime=(value:string)=>{const seconds=(Date.now()-new Date(value).getTime())/1000;if(seconds<60)return'agora';if(seconds<3600)return`há ${Math.floor(seconds/60)} min`;if(seconds<86400)return`há ${Math.floor(seconds/3600)} h`;return new Date(value).toLocaleDateString('pt-BR')}
const sanitizeLegacyBody=(value:string)=>value.replace(/^.+?\s*•\s*(?=Sua comissão)/i,'').replace(/\s+(confirmado|gerado)\s+para\s+.+[.!]?$/i,' $1.').trim()
const aiError=(code?:string)=>({AI_NOT_CONFIGURED:'A criação com IA ainda não está configurada.',UNAUTHORIZED:'Sua sessão expirou. Entre novamente.',AI_RATE_LIMITED:'Limite de criações atingido. Aguarde um minuto.',REQUEST_TOO_LONG:'O contexto informado é muito longo.',AI_TIMEOUT:'A criação demorou mais que o esperado. Tente novamente.'}[code||'']||'Não foi possível gerar a mensagem agora.')

export function NotificationDelivery(){
 const {user}=useAuth()
 const preferences=useDemoStore(state=>state.preferences.notifications)
 const updatePreferences=useDemoStore(state=>state.updatePreferences)
 const [tab,setTab]=useState<Tab>('generator')
 const [permission,setPermission]=useState<BrowserNotificationStatus>(()=>browserPermissionService.status())
 const [devices,setDevices]=useState<PushDevice[]>([])
 const [loading,setLoading]=useState(true)
 const [connecting,setConnecting]=useState(false)
 const [draft,setDraft]=useState<ManualNotificationDraft>(initialDraft)
 const [selectedType,setSelectedType]=useState('sale-approved')
 const [aiState,setAiState]=useState<AiState>('idle')
 const [aiPool,setAiPool]=useState<Array<{title:string;body:string}>>([])
 const [targetMode,setTargetMode]=useState<TargetMode>('all')
 const [chosenIds,setChosenIds]=useState<string[]>([])
 const [mode,setMode]=useState<SequenceMode>('now')
 const [quantity,setQuantity]=useState(5)
 const [interval,setIntervalValue]=useState(5)
 const [unit,setUnit]=useState<NotificationIntervalUnit>('seconds')
 const [varyMessages,setVaryMessages]=useState(true)
 const [progress,setProgress]=useState<SequenceProgress>(initialProgress)
 const [feedback,setFeedback]=useState('')
 const [history,setHistory]=useState<DeliveryHistory[]>(readHistory)
 const [historyPeriod,setHistoryPeriod]=useState('30')
 const [clock,setClock]=useState(Date.now())
 const aiAbort=useRef<AbortController|null>(null)
 const schedulerRef=useRef<ManualNotificationScheduler|null>(null)
 const mountedRef=useRef(true)
 const sequenceLockRef=useRef(false)
 const cancelledIdsRef=useRef(new Set<string>())
 const progressRef=useRef(progress)
 const sequenceConfigRef=useRef<{mode:TargetMode;ids:string[];intervalMs:number;variations:Array<{title:string;body:string}>;base:{title:string;body:string};variationIndex:number}>({mode:'all',ids:[],intervalMs:5000,variations:[],base:{title:'',body:''},variationIndex:-1})

 progressRef.current=progress
 const activeDevices=devices.filter(device=>device.enabled&&(device.status==='Conectado'||device.status==='Ativo'))
 const currentDevice=activeDevices.find(device=>device.isCurrentDevice)
 const selectedIds=targetMode==='all'?activeDevices.map(device=>device.deviceId):targetMode==='current'?(currentDevice?[currentDevice.deviceId]:[]):chosenIds
 const formatted=useMemo(()=>formatManualNotification(draft),[draft])
 const effectiveQuantity=mode==='now'?1:quantity
 const intervalError=mode==='sequence'?validateSequence(quantity,interval,unit):''
 const intervalMs=mode==='sequence'&&!intervalError?intervalToMilliseconds(interval,unit):0
 const estimatedDuration=intervalMs*Math.max(0,effectiveQuantity-1)
 const sequenceActive=['validating','preparing','running','paused','cancelling'].includes(progress.status)

 const refresh=useCallback(async()=>{
  setLoading(true)
  try{setDevices(await pushSubscriptionService.devices());setPermission(browserPermissionService.status())}
  finally{setLoading(false)}
 },[])

 useEffect(()=>{
  mountedRef.current=true
  const cancelledIds=cancelledIdsRef.current
  void(async()=>{
   if(!user){setFeedback('Sua sessão expirou. Entre novamente.');setLoading(false);return}
   if(browserPermissionService.status()==='granted'){
    const result=await pushSubscriptionService.subscribe()
    if(!result.ok)console.warn('[PUSH] Device reconciliation failed',result.code)
   }
   if(mountedRef.current)await refresh()
  })()
  return()=>{
   mountedRef.current=false;aiAbort.current?.abort()
   schedulerRef.current?.interrupt()
   const current=progressRef.current
   if(current.id&&['preparing','running','paused','validating'].includes(current.status)){
    cancelledIds.add(current.id)
    const stored=readHistory().map(item=>item.id===current.id?{...item,status:'Interrompida' as const,finishedAt:new Date().toISOString()}:item)
    saveHistory(stored)
   }
  }
 },[user,refresh])

 useEffect(()=>{
  if(!sequenceActive)return
  const timer=window.setInterval(()=>setClock(Date.now()),1000)
  return()=>window.clearInterval(timer)
 },[sequenceActive])

 const updateHistory=(id:string,values:Partial<DeliveryHistory>)=>setHistory(current=>{
  const next=current.map(item=>item.id===id?{...item,...values}:item);saveHistory(next);return next
 })
 const addHistory=(item:DeliveryHistory)=>setHistory(current=>{const next=[item,...current].slice(0,100);saveHistory(next);return next})

 const activate=async()=>{
  if(connecting)return
  setConnecting(true);setFeedback('')
  try{
   const result=await pushSubscriptionService.subscribe();setPermission(browserPermissionService.status())
   if(result.ok){setFeedback('Dispositivo conectado.');await refresh()}
   else setFeedback(result.code==='SESSION_MISSING'?'Sua sessão expirou. Entre novamente.':browserPermissionService.status()==='denied'?'As notificações estão bloqueadas neste navegador.':'Não foi possível conectar este dispositivo.')
  }finally{setConnecting(false)}
 }

 const chooseType=(option:TypeOption)=>{
  if(sequenceActive)return
  setSelectedType(option.id);setDraft(current=>({...current,...notificationContent(option.type,current.valueKind,current.method),notificationType:option.type}));setAiPool([]);setFeedback('')
 }
 const chooseValueKind=(valueKind:ManualValueKind)=>{
  if(sequenceActive)return
  setDraft(current=>({...current,...notificationContent(current.notificationType,valueKind,current.method),valueKind}))
  setAiPool([]);setFeedback('')
 }
 const chooseMethod=(method:string)=>{
  if(sequenceActive)return
  setDraft(current=>({...current,...notificationContent(current.notificationType,current.valueKind,method),method}))
  setAiPool([]);setFeedback('')
 }
 const buildRequest=()=>{
  const option=typeOptions.find(item=>item.id===selectedType)
  const details=[draft.valueKind!=='none'&&draft.value&&`${valueKindLabels[draft.valueKind]} ${draft.currency} ${draft.value}`,draft.method&&`método ${draft.method}`].filter(Boolean).join(', ')
  return`Crie uma notificação Push curta e profissional para "${option?.label||'Aviso'}"${details?`. Use estes dados: ${details}`:''}. Não cite produto ou nome de produto.`
 }
 const requestSuggestions=async(action:AiAction='generate',apply=true)=>{
  if(aiState==='loading')return[] as Array<{title:string;body:string}>
  aiAbort.current?.abort();const controller=new AbortController();aiAbort.current=controller;setAiState('loading');setFeedback('')
  try{
   const session=supabase?await supabase.auth.getSession():null,token=session?.data.session?.access_token
   if(!token){setAiState('error');setFeedback('Sua sessão expirou. Entre novamente.');return[]}
   const response=await fetch('/api/notifications/generate',{method:'POST',signal:controller.signal,headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({
    request:buildRequest(),action,objective:'Informar',tone:'Profissional',size:'Curto',emoji:'Discreto',audience:'Produtor',
    value:draft.valueKind==='none'?'':draft.value,currency:draft.currency,customer:'',method:draft.method,
    route:draft.route,currentTitle:draft.title,currentBody:draft.body,additional:'Nunca mencione produto ou nome de produto.'
   })})
   const data=await response.json().catch(()=>({})) as Partial<AiResult>&{success?:boolean;code?:string}
   if(!response.ok||data.success!==true||!Array.isArray(data.suggestions)||data.suggestions.length!==3){setAiState(data.code==='AI_NOT_CONFIGURED'?'unavailable':'error');setFeedback(aiError(data.code));return[]}
   const clean=data.suggestions.map(item=>({title:item.title.replace(/\{produto\}/gi,'').trim().slice(0,60),body:item.body.replace(/\{produto\}/gi,'').replace(/\s{2,}/g,' ').trim().slice(0,160)}))
   setAiPool(clean);setAiState('ready')
   if(apply){const suggestion=clean[data.recommendedIndex??0]||clean[0];setDraft(current=>applyAiSuggestion(current,suggestion));setFeedback('Mensagem gerada. Você pode editar antes de enviar.')}
   return clean
  }catch(error){if((error as Error).name!=='AbortError'){setAiState('error');setFeedback('Não foi possível gerar a mensagem agora.')}else setAiState('idle');return[]}
  finally{aiAbort.current=null}
 }

 const sendAttempt=async(title:string,body:string,eventId:string):Promise<PushSendResult>=>{
  const deviceIds=sequenceConfigRef.current.ids
  if(!deviceIds.length)return{ok:false,sent:0,failed:1,expired:0,code:'NO_ACTIVE_SUBSCRIPTIONS',message:'Nenhum dispositivo ativo foi encontrado.'}
  return pushSubscriptionService.sendManual({eventId,notificationType:draft.notificationType,title,body,route:draft.route,icon:draft.icon,deviceIds,currency:draft.currency})
 }
 const applySchedulerSnapshot=(snapshot:ManualSequenceSnapshot,result?:{message?:string})=>{
  const next:SequenceProgress={id:snapshot.sequenceId,status:snapshot.status,planned:snapshot.plannedCount,completed:snapshot.attemptedCount,sent:snapshot.sentCount,failed:snapshot.failedCount,expired:snapshot.expiredCount,nextAt:snapshot.nextRunAt}
  progressRef.current=next;setProgress(next)
  const terminal=['completed','failed','cancelled','interrupted'].includes(snapshot.status)
  const deliveryStatus:DeliveryStatus=snapshot.status==='completed'?(snapshot.failedCount||snapshot.expiredCount?'Parcial':'Concluída'):snapshot.status==='failed'?'Falhou':snapshot.status==='paused'?'Pausada':snapshot.status==='cancelled'?'Cancelada':snapshot.status==='interrupted'?'Interrompida':'Em andamento'
  updateHistory(snapshot.sequenceId,{completed:snapshot.attemptedCount,sent:snapshot.sentCount,failed:snapshot.failedCount,expired:snapshot.expiredCount,status:deliveryStatus,finishedAt:terminal?new Date().toISOString():undefined})
  if(terminal){
   sequenceLockRef.current=false
   if(snapshot.status==='completed')setFeedback(`${snapshot.attemptedCount} processadas: ${snapshot.sentCount} entregues e ${snapshot.failedCount+snapshot.expiredCount} falharam.`)
   else if(snapshot.status==='failed')setFeedback(result?.message||'A sequência foi interrompida por uma falha que exige ação.')
   if(snapshot.status!=='interrupted')void refresh()
  }
 }

 const start=async()=>{
  if(sequenceActive||sequenceLockRef.current)return
  sequenceLockRef.current=true
  if(!selectedIds.length){sequenceLockRef.current=false;setFeedback('Selecione pelo menos um dispositivo conectado.');return}
  if(formatted.missing.length){sequenceLockRef.current=false;setFeedback(`Revise: ${formatted.missing.join(', ')}.`);return}
  if(mode==='sequence'&&intervalError){sequenceLockRef.current=false;setFeedback(intervalError);return}
  if(effectiveQuantity>=50&&!window.confirm(`Você vai programar ${effectiveQuantity} notificações. Deseja continuar?`)){sequenceLockRef.current=false;return}
  const id=`sequence-${crypto.randomUUID?.()||Date.now()}`
  const validatingProgress={...initialProgress,id,status:'validating' as const,planned:effectiveQuantity}
  setProgress(validatingProgress);progressRef.current=validatingProgress;setFeedback('Validando programação…')
  let variations=aiPool
  if(mode==='sequence'&&varyMessages&&!variations.length)variations=await requestSuggestions('similar',false)
  if(cancelledIdsRef.current.has(id)){sequenceLockRef.current=false;return}
  if(mode==='sequence'&&varyMessages&&!variations.length){variations=localNotificationVariations(draft.notificationType,formatted.formattedValue,draft.valueKind);setFeedback('Variações automáticas ativas.')}
  const now=new Date().toISOString()
  sequenceConfigRef.current={mode:targetMode,ids:[...selectedIds],intervalMs,variations:mode==='sequence'&&varyMessages?variations:[],base:{title:formatted.title,body:formatted.body},variationIndex:-1}
  const nextProgress:SequenceProgress={id,status:'preparing',planned:effectiveQuantity,completed:0,sent:0,failed:0,expired:0,nextAt:null}
  setProgress(nextProgress);progressRef.current=nextProgress
  addHistory({id,type:draft.notificationType,title:formatted.title,body:formatted.body,createdAt:now,startedAt:now,sent:0,failed:0,expired:0,status:'Programada',destination:targetMode==='all'?'Todos os dispositivos':targetMode==='current'?'Este dispositivo':'Dispositivos escolhidos',planned:effectiveQuantity,completed:0,interval:mode==='sequence'?interval:0,unit:mode==='sequence'?unit:undefined,origin:'manual'})
  schedulerRef.current=new ManualNotificationScheduler({
   sequenceId:id,plannedCount:effectiveQuantity,intervalMs,
   attempt:async(index,eventId)=>{
    if(!mountedRef.current||cancelledIdsRef.current.has(id))return{sent:0,failed:0,expired:0,stop:true}
    const config=sequenceConfigRef.current
    const content=config.variations.length?config.variations[index%config.variations.length]:config.base
    const result=await sendAttempt(content.title,content.body,`manual-${eventId}`)
    const stop=[401,403,429].includes(result.httpStatus||0)||['SESSION_MISSING','INVALID_ACCESS_TOKEN','UNAUTHORIZED','RATE_LIMITED'].includes(result.code||'')
    if((result.httpStatus===404||result.httpStatus===410||result.expired)&&mountedRef.current)void refresh()
    const expired=result.expired||0
    const failed=Math.max(0,(result.failed||0)-expired)||(!result.ok&&!expired?1:0)
    return{sent:(result.sent||0)+(result.duplicates||0),failed,expired,stop,message:result.httpStatus===429?'Limite de envios atingido. A sequência foi interrompida com segurança.':result.message}
   },
   onChange:applySchedulerSnapshot
  })
  schedulerRef.current.start()
 }
 const pause=()=>{
  schedulerRef.current?.pause();setFeedback('Sequência pausada.')
 }
 const resume=()=>{
  if(progress.status!=='paused')return
  schedulerRef.current?.resume();setFeedback('Sequência retomada.')
 }
 const cancel=()=>{
  if(!sequenceActive||!window.confirm('Cancelar a sequência? As notificações já enviadas serão preservadas.'))return
  cancelledIdsRef.current.add(progress.id)
  schedulerRef.current?.cancel()
  updateHistory(progress.id,{status:'Cancelada',cancelledAt:new Date().toISOString()})
  setFeedback('Sequência cancelada.')
 }
 const reuse=(item:DeliveryHistory)=>{
  if(sequenceActive)return
  setDraft(current=>({...current,notificationType:item.type,title:item.title,body:sanitizeLegacyBody(item.body)}))
  setSelectedType(typeOptions.find(option=>option.type===item.type)?.id||'sale-approved')
  if(item.planned&&item.planned>1){setMode('sequence');setQuantity(item.planned);setIntervalValue(item.interval||5);setUnit(item.unit||'seconds')}else setMode('now')
  setTab('generator');setFeedback('Programação carregada para revisão.')
 }

 const connection=loading?{tone:'pending',label:'Conectando dispositivo'}:activeDevices.length?{tone:'connected',label:`${activeDevices.length} dispositivo${activeDevices.length===1?'':'s'} conectado${activeDevices.length===1?'':'s'}`}:{tone:'disconnected',label:'Nenhum dispositivo conectado'}
 const filteredHistory=history.filter(item=>Date.now()-new Date(item.createdAt).getTime()<=Number(historyPeriod)*86400000)
 const unitLabel=interval===1?unitLabels[unit].singular:unitLabels[unit].plural
 const nextSeconds=progress.nextAt?Math.max(0,Math.ceil((progress.nextAt-clock)/1000)):0

 return <div className="push-studio simple-push-studio">
  <header className="push-studio-header"><div><span>NOTIFICAÇÕES PUSH</span><h2>Gerador de notificações</h2><p>Crie, programe e acompanhe Pushes reais em poucos passos.</p></div><div className={`push-connection ${connection.tone}`}><i/>{connection.label}</div></header>
  <nav className="simple-push-tabs" aria-label="Seções de notificações"><button className={tab==='generator'?'active':''} onClick={()=>setTab('generator')}>Gerador</button><button className={tab==='history'?'active':''} onClick={()=>setTab('history')}><HistoryIcon/> Histórico</button></nav>
  {!activeDevices.length&&<section className="push-activation"><div className="push-activation-icon"><BellRing/></div><div><h3>Ativar notificações</h3><p>Conecte este dispositivo para receber e enviar alertas da SphexPay.</p></div><button className="btn btn-primary" onClick={()=>void activate()} disabled={connecting||permission==='denied'}>{connecting?'Conectando…':'Ativar neste dispositivo'}</button></section>}
  {feedback&&<p className="push-feedback" role="status" aria-live="polite">{feedback}</p>}

  {tab==='generator'&&<main className="simple-push-generator">
   <section className="simple-push-preview" aria-labelledby="notification-preview-title"><div className="simple-push-section-title"><span>VISUALIZAÇÃO</span><h3 id="notification-preview-title">Sua mensagem</h3></div><article><SphexPayLogo/><div><header><b>SphexPay</b><time>agora</time></header><strong>{formatted.title||'Título da notificação'}</strong><p>{formatted.body||'Sua mensagem aparecerá aqui.'}</p></div></article></section>
   <div className="simple-push-main">
    <section className="simple-push-section"><SectionTitle title="Tipo da notificação" description="Escolha o alerta que deseja enviar."/><div className="simple-push-types">{typeOptions.map(option=><button type="button" disabled={sequenceActive} className={selectedType===option.id?'active':''} aria-pressed={selectedType===option.id} onClick={()=>chooseType(option)} key={option.id}>{option.label}</button>)}</div></section>
    <section className="simple-push-section"><SectionTitle title="Tipo do valor" description="Escolha como o valor será apresentado."/><div className="simple-push-types" role="radiogroup" aria-label="Tipo do valor">{(Object.entries(valueKindLabels) as Array<[ManualValueKind,string]>).map(([value,label])=><button type="button" role="radio" aria-checked={draft.valueKind===value} disabled={sequenceActive} className={draft.valueKind===value?'active':''} onClick={()=>chooseValueKind(value)} key={value}>{label}</button>)}</div></section>
    <section className="simple-push-section"><SectionTitle title="Valor" description="Informe o valor e, se quiser, o método."/><div className="simple-push-fields">
     <label><span>Valor</span><div className="simple-push-money"><select disabled={sequenceActive||draft.valueKind==='none'} aria-label="Moeda" value={draft.currency} onChange={event=>setDraft(current=>({...current,currency:event.target.value as ManualCurrency}))}><option>BRL</option><option>USD</option><option>EUR</option></select><input disabled={sequenceActive||draft.valueKind==='none'} aria-label="Valor" inputMode="decimal" value={draft.value} onChange={event=>setDraft(current=>({...current,value:normalizeBrazilianAmount(event.target.value)}))} placeholder="197,00"/></div></label>
     <label><span>Método</span><select aria-label="Método" disabled={sequenceActive} value={draft.method} onChange={event=>chooseMethod(event.target.value)}><option value="">Não informar</option><option>Pix</option><option>Cartão</option><option>Boleto</option><option>Saldo</option></select></label>
    </div></section>
    <section className="simple-push-section sequence-programming"><SectionTitle title="Programação" description="Envie agora ou mantenha uma sequência enquanto esta página estiver aberta."/>
     <div className="sequence-mode" role="radiogroup" aria-label="Modo de envio"><button type="button" role="radio" aria-checked={mode==='now'} className={mode==='now'?'active':''} disabled={sequenceActive} onClick={()=>setMode('now')}>Enviar uma vez</button><button type="button" role="radio" aria-label="Programar sequência" aria-checked={mode==='sequence'} className={mode==='sequence'?'active':''} disabled={sequenceActive} onClick={()=>setMode('sequence')}>Enviar sequência</button></div>
     {mode==='sequence'&&<><label className="sequence-field"><span>Quantidade de notificações</span><input aria-describedby="quantity-help" disabled={sequenceActive} type="number" inputMode="numeric" min="1" max="100" step="1" value={quantity} onChange={event=>setQuantity(Number(event.target.value))}/><small id="quantity-help">Escolha entre 1 e 100.</small></label><div className="sequence-quick" aria-label="Quantidades rápidas">{[1,5,10,20,50].map(value=><button type="button" disabled={sequenceActive} className={quantity===value?'active':''} onClick={()=>setQuantity(value)} key={value}>{value}</button>)}</div>
      <div className="sequence-interval"><label><span>Enviar a cada</span><input aria-label="Intervalo" aria-describedby="interval-error" disabled={sequenceActive} type="number" inputMode="numeric" min={unit==='seconds'?5:1} max={unit==='seconds'?3600:unit==='minutes'?1440:168} step="1" value={interval} onChange={event=>setIntervalValue(Number(event.target.value))}/></label><label><span>Unidade</span><select aria-label="Unidade do intervalo" disabled={sequenceActive} value={unit} onChange={event=>setUnit(event.target.value as NotificationIntervalUnit)}><option value="seconds">Segundos</option><option value="minutes">Minutos</option><option value="hours">Horas</option></select></label></div>
      {intervalError&&<p className="sequence-error" id="interval-error" role="alert">{intervalError}</p>}</>}
     <div className="sequence-summary"><b>{effectiveQuantity===1?'Uma notificação será enviada imediatamente.':`Serão enviadas ${effectiveQuantity} notificações, uma a cada ${interval} ${unitLabel}.`}</b><span>{formatEstimatedDuration(estimatedDuration)}</span>{mode==='sequence'&&<small>Mantenha esta página aberta durante a sequência.</small>}</div>
     {progress.status!=='idle'&&<div className="sequence-progress" aria-live="polite"><div><b>{progress.completed} de {progress.planned} processadas</b><span>{Math.max(0,progress.planned-progress.completed)} restantes · {progress.sent} entregues · {progress.failed} falharam · {progress.expired} expiradas</span></div><div className="sequence-progressbar" role="progressbar" aria-label="Progresso da sequência" aria-valuemin={0} aria-valuemax={progress.planned} aria-valuenow={progress.completed}><i style={{width:`${progress.planned?progress.completed/progress.planned*100:0}%`}}/></div><p>{progress.status==='paused'?'Sequência pausada':progress.nextAt?`Próxima em ${nextSeconds} segundos`:progress.status==='running'?'Enviando agora…':progress.status==='completed'?'Sequência concluída':progress.status==='cancelled'?'Sequência cancelada':progress.status==='interrupted'?'Sequência interrompida':progress.status==='failed'?'Falha na sequência':'Preparando…'}</p><div className="sequence-controls">{progress.status==='paused'?<button className="btn" onClick={resume}><Play/>Continuar</button>:<button className="btn" disabled={progress.status!=='running'} onClick={pause}><Pause/>Pausar</button>}<button className="btn sequence-cancel" aria-label="Cancelar sequência" disabled={!sequenceActive} onClick={cancel}><Square/>Cancelar</button></div></div>}
    </section>
    <section className="simple-push-section simple-push-intelligence"><SectionTitle title="Texto inteligente" description="Alterne mensagens curtas sem mudar o valor ou o tipo."/><Toggle label="Variar automaticamente" checked={varyMessages} onChange={setVaryMessages} disabled={sequenceActive||mode==='now'}/>{varyMessages&&mode==='sequence'&&<p className="simple-push-note">{aiState==='unavailable'?'Variações automáticas ativas.':'A IA prepara um conjunto limitado antes do primeiro envio. Se não estiver disponível, as variações locais serão usadas.'}</p>}<div className="simple-push-final">
     <label><span>Título</span><input aria-label="Título da notificação" disabled={sequenceActive} maxLength={60} value={draft.title} onChange={event=>setDraft(current=>({...current,title:event.target.value}))}/><small>{draft.title.length}/60</small></label>
     <label><span>Mensagem</span><textarea aria-label="Mensagem da notificação" disabled={sequenceActive} maxLength={160} value={draft.body} onChange={event=>setDraft(current=>({...current,body:event.target.value.replace(/\{produto\}/gi,'')}))}/><small>{draft.body.length}/160</small></label>
    </div></section>
    <section className="simple-push-section"><SectionTitle title="Destino" description="Escolha somente dispositivos conectados à sua conta."/><fieldset className="sequence-destinations" disabled={sequenceActive}><legend className="sr-only">Destino da notificação</legend>
      <Destination checked={targetMode==='current'} onChange={()=>setTargetMode('current')} disabled={!currentDevice} title="Este dispositivo" detail={currentDevice?`${currentDevice.name} · ${currentDevice.browser} no ${currentDevice.operatingSystem}`:'Este dispositivo ainda não está conectado'}/>
      <Destination checked={targetMode==='all'} onChange={()=>setTargetMode('all')} title="Todos os dispositivos" detail={`${activeDevices.length} dispositivo(s) ativo(s)`}/>
      <Destination checked={targetMode==='choose'} onChange={()=>setTargetMode('choose')} title="Escolher dispositivos" detail={`${chosenIds.length} selecionado(s)`}/>
      {targetMode==='choose'&&<div className="sequence-device-list">{activeDevices.map(device=><label key={device.id}><input type="checkbox" checked={chosenIds.includes(device.deviceId)} onChange={()=>setChosenIds(current=>current.includes(device.deviceId)?current.filter(id=>id!==device.deviceId):[...current,device.deviceId])}/><span><b>{device.name}</b><small>{device.browser} no {device.operatingSystem} · {device.status}</small></span></label>)}</div>}
     </fieldset></section>
    <section className="simple-push-section"><SectionTitle title="Enviar" description="Revise a visualização e confirme o destino."/><button className="btn btn-primary simple-push-send" disabled={sequenceActive||!selectedIds.length||Boolean(formatted.missing.length)||Boolean(intervalError)} onClick={()=>void start()}><Send/>{progress.status==='validating'?'Validando…':mode==='sequence'?'Iniciar sequência':'Enviar notificação'}</button><p className="simple-push-send-caption">A notificação será enviada ao(s) dispositivo(s) selecionado(s).</p></section>
   </div>
  </main>}

  {tab==='history'&&<section className="simple-push-history"><header><div><span>HISTÓRICO</span><h3>Envios e programações recentes</h3><p>Resultados reais retornados pelo backend Push.</p></div><select aria-label="Período do histórico" value={historyPeriod} onChange={event=>setHistoryPeriod(event.target.value)}><option value="1">Hoje</option><option value="7">7 dias</option><option value="30">30 dias</option></select></header><div>{filteredHistory.map(item=><article key={item.id}><i className={item.status.toLowerCase()}/><div><b>{item.title}</b><p>{item.body}</p><small>{relativeTime(item.createdAt)} · {item.destination}{item.planned?` · ${item.completed||0}/${item.planned}`:''}</small></div><span>{item.status}<small>{item.sent} envio(s) · {item.failed+item.expired} falha(s)</small></span><button className="btn" disabled={sequenceActive} onClick={()=>reuse(item)}><RefreshCcw/>Usar novamente</button></article>)}{!filteredHistory.length&&<div className="simple-push-empty"><HistoryIcon/><p>Nenhum envio encontrado neste período.</p></div>}</div></section>}
  <details className="push-preferences"><summary>Alertas automáticos <ChevronDown/></summary><div><Preference label="Vendas" checked={preferences.sales} onChange={sales=>updatePreferences('notifications',{sales})}/><Preference label="Pix" checked={preferences.pixGenerated!==false} onChange={pixGenerated=>updatePreferences('notifications',{pixGenerated})}/><Preference label="Cartões" checked={preferences.cardApproved!==false} onChange={cardApproved=>updatePreferences('notifications',{cardApproved})}/><Preference label="Boletos" checked={preferences.boletoEvents!==false} onChange={boletoEvents=>updatePreferences('notifications',{boletoEvents})}/><Preference label="Assinaturas" checked={preferences.subscriptionEvents!==false} onChange={subscriptionEvents=>updatePreferences('notifications',{subscriptionEvents})}/><Preference label="Saques" checked={preferences.withdrawalEvents!==false} onChange={withdrawalEvents=>updatePreferences('notifications',{withdrawalEvents})}/></div></details>
 </div>
}

function SectionTitle({title,description}:{title:string;description:string}){return <div className="simple-push-section-title"><div><h3>{title}</h3><p>{description}</p></div></div>}
function Toggle({label,checked,onChange,disabled=false}:{label:string;checked:boolean;onChange:(value:boolean)=>void;disabled?:boolean}){return <label className={`simple-push-toggle${disabled?' disabled':''}`}><span>{label}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={event=>onChange(event.target.checked)}/><i/></label>}
function Destination({checked,onChange,title,detail,disabled=false}:{checked:boolean;onChange:()=>void;title:string;detail:string;disabled?:boolean}){return <label className={disabled?'disabled':''}><input type="radio" name="push-destination" checked={checked} onChange={onChange} disabled={disabled}/><span><b>{title}</b><small>{detail}</small></span><i/></label>}
function Preference({label,checked,onChange}:{label:string;checked:boolean;onChange:(value:boolean)=>void}){return <label><span>{label}</span><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)}/><i/></label>}
