import {BellRing,ChevronDown,History as HistoryIcon,RefreshCcw,Send,Sparkles} from 'lucide-react'
import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {useAuth} from '../../hooks/useAuth'
import {
 applyAiSuggestion,formatManualNotification,manualNotificationTemplates,normalizeBrazilianAmount,
 type ManualCurrency,type ManualNotificationDraft,type ManualNotificationType
} from '../../lib/manualNotification'
import {supabase} from '../../lib/supabase'
import {browserPermissionService,type BrowserNotificationStatus} from '../../services/browserPermissionService'
import {productService} from '../../services/productService'
import {pushSubscriptionService,type PushDevice,type PushSendResult} from '../../services/pushSubscriptionService'
import {useDemoStore} from '../../store/useDemoStore'
import type {Product} from '../../types'
import {SphexPayLogo} from '../branding/SphexPayLogo'

type Tab='generator'|'history'
type AiAction='generate'|'similar'
type AiSuggestion={id:string;label:'Direta'|'Motivacional'|'Premium';title:string;body:string;reason:string}
type AiResult={suggestions:AiSuggestion[];recommendedIndex:number}
type AiState='idle'|'loading'|'ready'|'error'|'unavailable'
type TargetMode='all'|'specific'
type DeliveryStatus='Entregue'|'Parcial'|'Falhou'
type DeliveryHistory={
 id:string;type:ManualNotificationType;title:string;body:string;createdAt:string;
 sent:number;failed:number;expired:number;status:DeliveryStatus;destination:string
}
type TypeOption={id:string;type:ManualNotificationType;label:string}

const historyKey='sphexpay_manual_push_history_v3'
const initialDraft:ManualNotificationDraft={
 ...manualNotificationTemplates.sale_approved,notificationType:'sale_approved',value:'',
 valueKind:'commission',currency:'BRL',product:'',customer:'',method:'',route:'/app',
 icon:'/icons/sphexpay-app-192.png',showTime:true
}
const typeOptions:TypeOption[]=[
 {id:'sale-approved',type:'sale_approved',label:'Venda aprovada'},
 {id:'sale-pending',type:'sale_pending',label:'Venda pendente'},
 {id:'pix-generated',type:'pix_generated',label:'Pix gerado'},
 {id:'pix-paid',type:'pix_paid',label:'Pix pago'},
 {id:'card-approved',type:'credit_card_approved',label:'Cartão aprovado'},
 {id:'boleto-generated',type:'boleto_generated',label:'Boleto gerado'},
 {id:'boleto-paid',type:'boleto_paid',label:'Boleto pago'},
 {id:'refund',type:'refund_done',label:'Reembolso'},
 {id:'subscription',type:'subscription_renewed',label:'Assinatura renovada'},
 {id:'purchase-approved',type:'sale_approved',label:'Compra aprovada'}
]
const readHistory=():DeliveryHistory[]=>{try{return JSON.parse(localStorage.getItem(historyKey)||'[]')}catch{return[]}}
const saveHistory=(value:DeliveryHistory[])=>{try{localStorage.setItem(historyKey,JSON.stringify(value))}catch{/* Histórico local é complementar ao log do backend. */}}
const relativeTime=(value:string)=>{const seconds=(Date.now()-new Date(value).getTime())/1000;if(seconds<60)return'agora';if(seconds<3600)return`há ${Math.floor(seconds/60)} min`;if(seconds<86400)return`há ${Math.floor(seconds/3600)} h`;return new Date(value).toLocaleDateString('pt-BR')}
const aiError=(code?:string)=>({
 AI_NOT_CONFIGURED:'A criação com IA ainda não está configurada.',
 UNAUTHORIZED:'Sua sessão expirou. Entre novamente.',
 AI_RATE_LIMITED:'Limite de criações atingido. Aguarde um minuto.',
 REQUEST_TOO_LONG:'O contexto informado é muito longo.',
 AI_TIMEOUT:'A criação demorou mais que o esperado. Tente novamente.'
}[code||'']||'Não foi possível gerar a mensagem agora.')

export function NotificationDelivery(){
 const {user}=useAuth()
 const preferences=useDemoStore(state=>state.preferences.notifications)
 const updatePreferences=useDemoStore(state=>state.updatePreferences)
 const [tab,setTab]=useState<Tab>('generator')
 const [permission,setPermission]=useState<BrowserNotificationStatus>(()=>browserPermissionService.status())
 const [devices,setDevices]=useState<PushDevice[]>([])
 const [products,setProducts]=useState<Product[]>([])
 const [loading,setLoading]=useState(true)
 const [connecting,setConnecting]=useState(false)
 const [draft,setDraft]=useState<ManualNotificationDraft>(initialDraft)
 const [selectedType,setSelectedType]=useState('sale-approved')
 const [commission,setCommission]=useState('')
 const [context,setContext]=useState('')
 const [aiEnabled,setAiEnabled]=useState(true)
 const [varyAutomatically,setVaryAutomatically]=useState(true)
 const [useData,setUseData]=useState(true)
 const [aiState,setAiState]=useState<AiState>('idle')
 const [targetMode,setTargetMode]=useState<TargetMode>('all')
 const [specificDevice,setSpecificDevice]=useState('')
 const [sending,setSending]=useState(false)
 const [feedback,setFeedback]=useState('')
 const [history,setHistory]=useState<DeliveryHistory[]>(readHistory)
 const [historyPeriod,setHistoryPeriod]=useState('30')
 const aiAbort=useRef<AbortController|null>(null)

 const activeDevices=devices.filter(device=>device.enabled&&(device.status==='Conectado'||device.status==='Ativo'))
 const selectedIds=targetMode==='all'?activeDevices.map(device=>device.deviceId):specificDevice?[specificDevice]:[]
 const formatted=useMemo(()=>formatManualNotification(draft),[draft])

 const refresh=useCallback(async()=>{
  setLoading(true)
  try{
   const [registered,catalog]=await Promise.all([
    pushSubscriptionService.devices(),
    user?.id?productService.list(user.id):Promise.resolve([] as Product[])
   ])
   setDevices(registered);setProducts(catalog);setPermission(browserPermissionService.status())
   setSpecificDevice(current=>current||registered.find(device=>device.isCurrentDevice)?.deviceId||registered.find(device=>device.enabled)?.deviceId||'')
  }finally{setLoading(false)}
 },[user?.id])

 useEffect(()=>{
  let mounted=true
  void(async()=>{
   if(!user){setFeedback('Sua sessão expirou. Entre novamente.');setLoading(false);return}
   if(browserPermissionService.status()==='granted'){
    const result=await pushSubscriptionService.subscribe()
    if(!result.ok)console.warn('[PUSH] Device reconciliation failed',result.code)
   }
   if(mounted)await refresh()
  })()
  return()=>{mounted=false;aiAbort.current?.abort()}
 },[user,refresh])

 const activate=async()=>{
  if(connecting)return
  setConnecting(true);setFeedback('')
  try{
   const result=await pushSubscriptionService.subscribe()
   setPermission(browserPermissionService.status())
   if(result.ok){setFeedback('Dispositivo conectado.');await refresh()}
   else setFeedback(result.code==='SESSION_MISSING'?'Sua sessão expirou. Entre novamente.':browserPermissionService.status()==='denied'?'As notificações estão bloqueadas neste navegador.':'Não foi possível conectar este dispositivo.')
  }finally{setConnecting(false)}
 }

 const chooseType=(option:TypeOption)=>{
  setSelectedType(option.id)
  setDraft(current=>({...current,...manualNotificationTemplates[option.type],notificationType:option.type}))
  setFeedback('')
 }
 const selectProduct=(id:string)=>{
  const product=products.find(item=>item.id===id)
  setDraft(current=>product?{...current,product:product.name,value:product.price.toLocaleString('pt-BR',{minimumFractionDigits:2}),currency:(product.currency||'BRL') as ManualCurrency}:{...current,product:'',value:''})
 }
 const buildRequest=()=>{
  const option=typeOptions.find(item=>item.id===selectedType)
  const details=useData?[
   draft.product&&`produto ${draft.product}`,draft.value&&`valor ${draft.currency} ${draft.value}`,
   draft.method&&`método ${draft.method}`,draft.customer&&`cliente ${draft.customer}`,
   commission&&`comissão ${commission}`,context&&`contexto ${context}`
  ].filter(Boolean).join(', '):context
  return `Crie uma notificação Push curta e profissional para "${option?.label||'Aviso'}"${details?`. Use estes dados: ${details}`:''}.`
 }
 const generate=async(action:AiAction='generate')=>{
  if(!aiEnabled||aiState==='loading')return
  aiAbort.current?.abort()
  const controller=new AbortController();aiAbort.current=controller
  setAiState('loading');setFeedback('')
  try{
   const session=supabase?await supabase.auth.getSession():null
   const token=session?.data.session?.access_token
   if(!token){setAiState('error');setFeedback('Sua sessão expirou. Entre novamente.');return}
   const response=await fetch('/api/notifications/generate',{
    method:'POST',signal:controller.signal,
    headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${token}`},
    body:JSON.stringify({
     request:buildRequest(),action,objective:'Informar',tone:'Profissional',size:'Curto',
     emoji:'Discreto',audience:'Produtor',product:useData?draft.product:'',
     value:useData?draft.value:'',currency:draft.currency,customer:useData?draft.customer:'',
     method:useData?draft.method:'',route:draft.route,currentTitle:draft.title,currentBody:draft.body,
     additional:[commission&&`Comissão: ${commission}`,context].filter(Boolean).join('. ')
    })
   })
   const data=await response.json().catch(()=>({})) as Partial<AiResult>&{success?:boolean;code?:string}
   if(!response.ok||data.success!==true||!Array.isArray(data.suggestions)||data.suggestions.length!==3){
    setAiState(data.code==='AI_NOT_CONFIGURED'?'unavailable':'error');setFeedback(aiError(data.code));return
   }
   const index=varyAutomatically?(Math.floor(Math.random()*3)):(data.recommendedIndex??0)
   const suggestion=data.suggestions[index]||data.suggestions[0]
   setDraft(current=>applyAiSuggestion(current,suggestion))
   setAiState('ready');setFeedback('Mensagem gerada. Você pode editar antes de enviar.')
  }catch(error){
   if((error as Error).name!=='AbortError'){setAiState('error');setFeedback('Não foi possível gerar a mensagem agora.')}
   else setAiState('idle')
  }finally{aiAbort.current=null}
 }

 const addHistory=(result:PushSendResult,status:DeliveryStatus)=>{
  const item:DeliveryHistory={
   id:result.eventId||crypto.randomUUID(),type:draft.notificationType,title:formatted.title,body:formatted.body,
   createdAt:new Date().toISOString(),sent:result.sent||0,failed:result.failed||0,expired:result.expired||0,status,
   destination:targetMode==='all'?'Todos os dispositivos':activeDevices.find(device=>device.deviceId===specificDevice)?.name||'Dispositivo específico'
  }
  setHistory(current=>{const next=[item,...current].slice(0,100);saveHistory(next);return next})
 }
 const send=async()=>{
  if(sending)return
  if(!selectedIds.length){setFeedback('Selecione pelo menos um dispositivo conectado.');return}
  if(formatted.missing.length){setFeedback(`Revise: ${formatted.missing.join(', ')}.`);return}
  setSending(true);setFeedback('Enviando…')
  try{
   const result=await pushSubscriptionService.sendManual({
    notificationType:draft.notificationType,title:formatted.title,body:formatted.body,
    route:draft.route,icon:draft.icon,deviceIds:selectedIds,currency:draft.currency
   })
   const status:DeliveryStatus=result.sent&&!result.failed&&!result.expired?'Entregue':result.sent?'Parcial':'Falhou'
   addHistory(result,status)
   if(result.expired){await refresh();setFeedback('Este dispositivo precisa ser conectado novamente.')}
   else setFeedback(status==='Entregue'?'Notificação enviada.':status==='Parcial'?'A entrega foi parcial.':'Não foi possível entregar a notificação.')
  }finally{setSending(false)}
 }
 const reuse=(item:DeliveryHistory)=>{
  setDraft(current=>({...current,notificationType:item.type,title:item.title,body:item.body}))
  setSelectedType(typeOptions.find(option=>option.type===item.type)?.id||'sale-approved')
  setTab('generator');setFeedback('Mensagem carregada para revisão.')
 }

 const connection=loading?{tone:'pending',label:'Conectando dispositivo'}:activeDevices.length?{tone:'connected',label:`${activeDevices.length} dispositivo${activeDevices.length===1?'':'s'} conectado${activeDevices.length===1?'':'s'}`}:{tone:'disconnected',label:'Nenhum dispositivo conectado'}
 const filteredHistory=history.filter(item=>Date.now()-new Date(item.createdAt).getTime()<=Number(historyPeriod)*86400000)

 return <div className="push-studio simple-push-studio">
  <header className="push-studio-header">
   <div><span>NOTIFICAÇÕES PUSH</span><h2>Gerador de notificações</h2><p>Crie uma mensagem clara e envie um Push real em poucos passos.</p></div>
   <div className={`push-connection ${connection.tone}`}><i/>{connection.label}</div>
  </header>
  <nav className="simple-push-tabs" aria-label="Seções de notificações">
   <button className={tab==='generator'?'active':''} onClick={()=>setTab('generator')}>Gerador</button>
   <button className={tab==='history'?'active':''} onClick={()=>setTab('history')}><HistoryIcon/> Histórico</button>
  </nav>
  {!activeDevices.length&&<section className="push-activation">
   <div className="push-activation-icon"><BellRing/></div><div><h3>Ativar notificações</h3><p>Conecte este dispositivo para receber e enviar alertas da SphexPay.</p></div>
   <button className="btn btn-primary" onClick={()=>void activate()} disabled={connecting||permission==='denied'}>{connecting?'Conectando…':'Ativar neste dispositivo'}</button>
  </section>}
  {feedback&&<p className="push-feedback" role="status" aria-live="polite">{feedback}</p>}

  {tab==='generator'&&<main className="simple-push-generator">
   <section className="simple-push-preview" aria-labelledby="notification-preview-title">
    <div className="simple-push-section-title"><span>VISUALIZAÇÃO</span><h3 id="notification-preview-title">Sua mensagem</h3></div>
    <article><SphexPayLogo/><div><header><b>SphexPay</b><time>agora</time></header><strong>{formatted.title||'Título da notificação'}</strong><p>{formatted.body||'Sua mensagem aparecerá aqui.'}</p></div></article>
   </section>

   <div className="simple-push-columns">
    <div className="simple-push-main">
     <section className="simple-push-section">
      <div className="simple-push-section-title"><span>1</span><div><h3>Tipo da notificação</h3><p>Escolha o assunto para começar.</p></div></div>
      <div className="simple-push-types">{typeOptions.map(option=><button type="button" className={selectedType===option.id?'active':''} aria-pressed={selectedType===option.id} onClick={()=>chooseType(option)} key={option.id}>{option.label}</button>)}</div>
     </section>

     <section className="simple-push-section">
      <div className="simple-push-section-title"><span>2</span><div><h3>Dados da notificação</h3><p>Preencha somente o que fizer sentido.</p></div></div>
      <div className="simple-push-fields">
       <label><span>Produto</span><select value={products.find(item=>item.name===draft.product)?.id||''} onChange={event=>selectProduct(event.target.value)}><option value="">Sem produto</option>{products.map(product=><option value={product.id} key={product.id}>{product.name} · {product.currency||'BRL'} {product.price.toLocaleString('pt-BR',{minimumFractionDigits:2})}</option>)}</select></label>
       <label><span>Cliente <small>opcional</small></span><input value={draft.customer} onChange={event=>setDraft(current=>({...current,customer:event.target.value}))} placeholder="Nome do cliente"/></label>
       <label><span>Valor</span><div className="simple-push-money"><select aria-label="Moeda" value={draft.currency} onChange={event=>setDraft(current=>({...current,currency:event.target.value as ManualCurrency}))}><option>BRL</option><option>USD</option><option>EUR</option></select><input aria-label="Valor" inputMode="decimal" value={draft.value} onChange={event=>setDraft(current=>({...current,value:normalizeBrazilianAmount(event.target.value)}))} placeholder="197,00"/></div></label>
       <label><span>Método</span><select value={draft.method} onChange={event=>setDraft(current=>({...current,method:event.target.value}))}><option value="">Não informar</option><option>Pix</option><option>Cartão</option><option>Boleto</option><option>Saldo</option></select></label>
       <label><span>Comissão <small>opcional</small></span><input inputMode="decimal" value={commission} onChange={event=>setCommission(normalizeBrazilianAmount(event.target.value))} placeholder="97,00"/></label>
       <label><span>Horário ou contexto <small>opcional</small></span><input maxLength={160} value={context} onChange={event=>setContext(event.target.value)} placeholder="Ex.: pagamento confirmado agora"/></label>
       <label className="wide"><span>Destino da notificação</span><select value={targetMode==='all'?'all':specificDevice} onChange={event=>{if(event.target.value==='all')setTargetMode('all');else{setTargetMode('specific');setSpecificDevice(event.target.value)}}}><option value="all">Todos os dispositivos</option>{activeDevices.map(device=><option value={device.deviceId} key={device.id}>{device.name} · {device.browser} no {device.operatingSystem}{device.isCurrentDevice?' · Este dispositivo':''}</option>)}</select></label>
      </div>
     </section>
    </div>

    <div className="simple-push-side">
     <section className="simple-push-section simple-push-intelligence">
      <div className="simple-push-section-title"><span>3</span><div><h3>Texto inteligente</h3><p>A IA usa os dados acima para criar um Push curto.</p></div></div>
      <Toggle label="Ativar IA" checked={aiEnabled} onChange={setAiEnabled}/>
      <Toggle label="Variar automaticamente" checked={varyAutomatically} onChange={setVaryAutomatically} disabled={!aiEnabled}/>
      <Toggle label="Usar produto, valor e método" checked={useData} onChange={setUseData} disabled={!aiEnabled}/>
      <button className="btn btn-primary simple-push-ai-button" disabled={!aiEnabled||aiState==='loading'} onClick={()=>void generate()}><Sparkles/>{aiState==='loading'?'Gerando mensagem…':'Gerar mensagem'}</button>
      <button className="btn simple-push-ai-button" disabled={!aiEnabled||aiState==='loading'} onClick={()=>void generate('similar')}><RefreshCcw/>Gerar outra variação</button>
      {aiState==='unavailable'&&<p className="simple-push-note">A criação com IA ainda não está configurada. Você pode editar e enviar o modelo pronto.</p>}
     </section>

     <section className="simple-push-section simple-push-final">
      <div className="simple-push-section-title"><span>4</span><div><h3>Mensagem final</h3><p>Revise ou edite antes de enviar.</p></div></div>
      <label><span>Título da notificação</span><input maxLength={60} value={draft.title} onChange={event=>setDraft(current=>({...current,title:event.target.value}))}/><small>{draft.title.length}/60</small></label>
      <label><span>Mensagem</span><textarea maxLength={160} value={draft.body} onChange={event=>setDraft(current=>({...current,body:event.target.value}))}/><small>{draft.body.length}/160</small></label>
      <button className="btn btn-primary simple-push-send" disabled={sending||!selectedIds.length||Boolean(formatted.missing.length)} onClick={()=>void send()}><Send/>{sending?'Enviando…':'Enviar notificação'}</button>
      <p className="simple-push-send-caption">A notificação será enviada ao(s) dispositivo(s) selecionado(s).</p>
     </section>
    </div>
   </div>
  </main>}

  {tab==='history'&&<section className="simple-push-history">
   <header><div><span>HISTÓRICO</span><h3>Envios recentes</h3><p>Resultados reais retornados pelo backend Push.</p></div><select aria-label="Período do histórico" value={historyPeriod} onChange={event=>setHistoryPeriod(event.target.value)}><option value="1">Hoje</option><option value="7">7 dias</option><option value="30">30 dias</option></select></header>
   <div>{filteredHistory.map(item=><article key={item.id}><i className={item.status.toLowerCase()}/><div><b>{item.title}</b><p>{item.body}</p><small>{relativeTime(item.createdAt)} · {item.destination}</small></div><span>{item.status}<small>{item.sent} entregue(s) · {item.failed+item.expired} falha(s)</small></span><button className="btn" onClick={()=>reuse(item)}><RefreshCcw/>Reutilizar</button></article>)}{!filteredHistory.length&&<div className="simple-push-empty"><HistoryIcon/><p>Nenhum envio encontrado neste período.</p></div>}</div>
  </section>}

  <details className="push-preferences"><summary>Alertas automáticos <ChevronDown/></summary><div>
   <Preference label="Vendas" checked={preferences.sales} onChange={sales=>updatePreferences('notifications',{sales})}/>
   <Preference label="Pix" checked={preferences.pixGenerated!==false} onChange={pixGenerated=>updatePreferences('notifications',{pixGenerated})}/>
   <Preference label="Cartões" checked={preferences.cardApproved!==false} onChange={cardApproved=>updatePreferences('notifications',{cardApproved})}/>
   <Preference label="Boletos" checked={preferences.boletoEvents!==false} onChange={boletoEvents=>updatePreferences('notifications',{boletoEvents})}/>
   <Preference label="Assinaturas" checked={preferences.subscriptionEvents!==false} onChange={subscriptionEvents=>updatePreferences('notifications',{subscriptionEvents})}/>
   <Preference label="Saques" checked={preferences.withdrawalEvents!==false} onChange={withdrawalEvents=>updatePreferences('notifications',{withdrawalEvents})}/>
  </div></details>
 </div>
}

function Toggle({label,checked,onChange,disabled=false}:{label:string;checked:boolean;onChange:(value:boolean)=>void;disabled?:boolean}){return <label className={`simple-push-toggle${disabled?' disabled':''}`}><span>{label}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={event=>onChange(event.target.checked)}/><i/></label>}
function Preference({label,checked,onChange}:{label:string;checked:boolean;onChange:(value:boolean)=>void}){return <label><span>{label}</span><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)}/><i/></label>}
