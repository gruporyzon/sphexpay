import {
 BellRing,ChevronDown,Clock3,Copy,History as HistoryIcon,Layers3,Monitor,
 RefreshCcw,Send,Smartphone,Sparkles,Star,Trash2,WandSparkles
} from 'lucide-react'
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

type Tab='generator'|'models'|'history'
type PreviewDevice='iphone'|'android'|'desktop'
type AiAction='generate'|'shorter'|'professional'|'persuasive'|'remove_emojis'|'similar'
type AiSuggestion={id:string;label:'Direta'|'Motivacional'|'Premium';title:string;body:string;reason:string}
type AiResult={suggestions:AiSuggestion[];recommendedIndex:number;detectedIntent:string;warnings:string[]}
type AiState='idle'|'analyzing'|'creating'|'ready'|'error'|'unavailable'
type TargetMode='current'|'all'|'choose'
type DeliveryStatus='Entregue'|'Parcial'|'Falhou'|'Processando'|'Cancelado'
type DeliveryHistory={
 id:string;type:ManualNotificationType;title:string;body:string;createdAt:string;
 sent:number;failed:number;expired:number;status:DeliveryStatus;destination:string
}
type SavedModel={id:string;name:string;config:ManualNotificationDraft;favorite?:boolean}
type AiContext={
 objective:string;tone:string;size:string;emoji:string;audience:string;additional:string
}

const historyKey='sphexpay_manual_push_history_v3'
const modelsKey='sphexpay_manual_push_models_v2'
const initialDraft:ManualNotificationDraft={
 ...manualNotificationTemplates.sale_approved,notificationType:'sale_approved',value:'',
 valueKind:'commission',currency:'BRL',product:'',customer:'',method:'',route:'/app',
 icon:'/icons/sphexpay-app-192.png',showTime:true
}
const initialContext:AiContext={
 objective:'Informar',tone:'Profissional',size:'Curto',emoji:'Sem emoji',
 audience:'Produtor',additional:''
}
const quickPrompts=[
 'Nova venda aprovada','Pix recebido','Carrinho abandonado','Assinatura renovada',
 'Boleto vencendo','Saque concluído','Aviso importante','Campanha promocional','Mensagem personalizada'
]
const options={
 objective:['Informar','Confirmar','Alertar','Engajar','Recuperar cliente','Incentivar nova compra','Comunicar urgência'],
 tone:['Profissional','Direto','Motivacional','Premium','Amigável','Urgente','Minimalista'],
 size:['Curto','Médio','Detalhado'],
 emoji:['Sem emoji','Discreto','Moderado'],
 audience:['Administrador','Produtor','Afiliado','Cliente','Todos os dispositivos','Dispositivo atual']
}
const readJson=<T,>(key:string,fallback:T):T=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
const saveJson=(key:string,value:unknown)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{/* Persistência local é opcional. */}}
const relativeTime=(value:string)=>{const seconds=(Date.now()-new Date(value).getTime())/1000;if(seconds<60)return'agora';if(seconds<3600)return`há ${Math.floor(seconds/60)} min`;if(seconds<86400)return`há ${Math.floor(seconds/3600)} h`;return new Date(value).toLocaleDateString('pt-BR')}
const aiMessage=(code?:string)=>({
 AI_NOT_CONFIGURED:'A criação com IA ainda não está configurada.',
 UNAUTHORIZED:'Sua sessão expirou. Entre novamente.',
 AI_RATE_LIMITED:'Limite de criações atingido. Aguarde um minuto.',
 REQUEST_TOO_LONG:'O pedido deve ter até 1200 caracteres.',
 AI_TIMEOUT:'A criação demorou mais que o esperado. Tente novamente.'
}[code||'']||'Não foi possível criar sugestões agora. Tente novamente.')

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
 const [request,setRequest]=useState('')
 const [context,setContext]=useState<AiContext>(initialContext)
 const [aiState,setAiState]=useState<AiState>('idle')
 const [aiResult,setAiResult]=useState<AiResult|null>(null)
 const [selectedSuggestion,setSelectedSuggestion]=useState<number|null>(null)
 const [preview,setPreview]=useState<PreviewDevice>('iphone')
 const [targetMode,setTargetMode]=useState<TargetMode>('current')
 const [chosenIds,setChosenIds]=useState<string[]>([])
 const [sending,setSending]=useState(false)
 const [message,setMessage]=useState('')
 const [history,setHistory]=useState<DeliveryHistory[]>(()=>readJson(historyKey,[]))
 const [models,setModels]=useState<SavedModel[]>(()=>readJson(modelsKey,[]))
 const [modelName,setModelName]=useState('')
 const [historyPeriod,setHistoryPeriod]=useState('30')
 const [historyStatus,setHistoryStatus]=useState('all')
 const aiAbort=useRef<AbortController|null>(null)

 const activeDevices=devices.filter(device=>device.enabled&&(device.status==='Conectado'||device.status==='Ativo'))
 const currentDevice=activeDevices.find(device=>device.isCurrentDevice)
 const selectedIds=targetMode==='all'?activeDevices.map(device=>device.deviceId):targetMode==='current'?(currentDevice?[currentDevice.deviceId]:[]):chosenIds
 const formatted=useMemo(()=>formatManualNotification(draft),[draft])

 const refresh=useCallback(async()=>{
  setLoading(true)
  try{
   const [registered,catalog]=await Promise.all([
    pushSubscriptionService.devices(),
    user?.id?productService.list(user.id):Promise.resolve([] as Product[])
   ])
   setDevices(registered);setProducts(catalog);setPermission(browserPermissionService.status())
  }finally{setLoading(false)}
 },[user?.id])

 useEffect(()=>{
  let mounted=true
  void(async()=>{
   if(!user){setMessage('Sua sessão expirou. Entre novamente.');setLoading(false);return}
   if(browserPermissionService.status()==='granted'){
    const result=await pushSubscriptionService.subscribe()
    if(!mounted)return
    if(!result.ok)console.warn('[PUSH] Device reconciliation failed',result.code)
   }
   if(mounted)await refresh()
  })()
  return()=>{mounted=false;aiAbort.current?.abort()}
 },[user,refresh])

 const activate=async()=>{
  if(connecting)return
  if(!user){setMessage('Sua sessão expirou. Entre novamente.');return}
  setConnecting(true);setMessage('')
  try{
   const result=await pushSubscriptionService.subscribe()
   setPermission(browserPermissionService.status())
   if(result.ok){setMessage('Dispositivo conectado.');await refresh()}
   else setMessage(result.code==='SESSION_MISSING'?'Sua sessão expirou. Entre novamente.':permission==='denied'?'As notificações estão bloqueadas neste navegador.':'Não foi possível conectar este dispositivo.')
  }finally{setConnecting(false)}
 }

 const selectProduct=(id:string)=>{
  const product=products.find(item=>item.id===id)
  setDraft(current=>product?{...current,product:product.name,value:product.price.toLocaleString('pt-BR',{minimumFractionDigits:2}),currency:product.currency||'BRL'}:{...current,product:'',value:''})
 }

 const generate=async(action:AiAction='generate',base?:{title:string;body:string})=>{
  if(!request.trim()&&action==='generate'){setMessage('Explique o que deseja comunicar.');return}
  if(aiState==='analyzing'||aiState==='creating')return
  aiAbort.current?.abort()
  const controller=new AbortController();aiAbort.current=controller
  setAiState('analyzing');setMessage('')
  const creatingTimer=window.setTimeout(()=>setAiState('creating'),350)
  try{
   const session=supabase?await supabase.auth.getSession():null
   const token=session?.data.session?.access_token
   if(!token){setAiState('error');setMessage('Sua sessão expirou. Entre novamente.');return}
   const response=await fetch('/api/notifications/generate',{
    method:'POST',signal:controller.signal,
    headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${token}`},
    body:JSON.stringify({
     request:request.trim()||'Crie uma variação da mensagem atual.',action,...context,
     product:draft.product,value:draft.value,currency:draft.currency,customer:draft.customer,
     method:draft.method,route:draft.route,currentTitle:base?.title||draft.title,currentBody:base?.body||draft.body
    })
   })
   const data=await response.json().catch(()=>({})) as Partial<AiResult>&{success?:boolean;code?:string}
   if(!response.ok||data.success!==true||!Array.isArray(data.suggestions)||data.suggestions.length!==3){
    setAiState(data.code==='AI_NOT_CONFIGURED'?'unavailable':'error');setMessage(aiMessage(data.code));return
   }
   setAiResult({suggestions:data.suggestions,recommendedIndex:data.recommendedIndex??0,detectedIntent:data.detectedIntent||'Mensagem personalizada',warnings:data.warnings||[]})
   setSelectedSuggestion(null);setAiState('ready');setMessage('Sugestões prontas.')
  }catch(error){
   if((error as Error).name==='AbortError'){setAiState('idle');setMessage('Criação cancelada.')}
   else{setAiState('error');setMessage('Não foi possível criar sugestões agora. Tente novamente.')}
  }finally{clearTimeout(creatingTimer);aiAbort.current=null}
 }

 const applySuggestion=(suggestion:AiSuggestion,index:number)=>{
  setSelectedSuggestion(index);setDraft(current=>applyAiSuggestion(current,suggestion))
 }
 const applyTemplate=(type:ManualNotificationType)=>{
  setDraft(current=>({...current,...manualNotificationTemplates[type],notificationType:type}))
  setTab('generator');setAiResult(null);setSelectedSuggestion(null);setMessage('Modelo pronto carregado para edição.')
 }
 const saveModel=(config=draft,name=modelName)=>{
  const cleanName=name.trim()
  if(!cleanName){setMessage('Informe um nome para o modelo.');return}
  const model:SavedModel={id:crypto.randomUUID(),name:cleanName,config:{...config}}
  setModels(current=>{const next=[model,...current];saveJson(modelsKey,next);return next})
  setModelName('');setMessage('Modelo salvo.')
 }
 const toggleFavorite=(id:string)=>setModels(current=>{const next=current.map(model=>model.id===id?{...model,favorite:!model.favorite}:model);saveJson(modelsKey,next);return next})
 const deleteModel=(id:string)=>setModels(current=>{const next=current.filter(model=>model.id!==id);saveJson(modelsKey,next);return next})
 const reuseHistory=(item:DeliveryHistory,withAi=false)=>{
  setDraft(current=>({...current,notificationType:item.type,title:item.title,body:item.body}))
  setRequest(`Crie uma nova variação para: ${item.title}. ${item.body}`.slice(0,1200))
  setTab('generator');setAiResult(null);setSelectedSuggestion(null)
  setMessage(withAi?'Revise o contexto e clique em Gerar com IA.':'Envio carregado para revisão.')
 }

 const send=async()=>{
  if(sending)return
  if(!selectedIds.length){setMessage('Selecione pelo menos um dispositivo conectado.');return}
  if(formatted.missing.length){setMessage(`Revise: ${formatted.missing.join(', ')}.`);return}
  setSending(true);setMessage('Enviando…')
  try{
   const result=await pushSubscriptionService.sendManual({
    notificationType:draft.notificationType,title:formatted.title,body:formatted.body,
    route:draft.route,icon:draft.icon,deviceIds:selectedIds,currency:draft.currency
   })
   const status:DeliveryStatus=result.sent&&!result.failed&&!result.expired?'Entregue':result.sent?'Parcial':'Falhou'
   addHistory(result,status)
   if(result.expired){await refresh();setMessage('Este dispositivo precisa ser conectado novamente.')}
   else setMessage(status==='Entregue'?'Notificação enviada.':status==='Parcial'?'A entrega foi parcial.':'Não foi possível entregar a notificação.')
  }finally{setSending(false)}
 }
 const addHistory=(result:PushSendResult,status:DeliveryStatus)=>{
  const item:DeliveryHistory={
   id:result.eventId||crypto.randomUUID(),type:draft.notificationType,title:formatted.title,
   body:formatted.body,createdAt:new Date().toISOString(),sent:result.sent||0,
   failed:result.failed||0,expired:result.expired||0,status,
   destination:targetMode==='all'?'Todos os dispositivos':targetMode==='current'?'Este dispositivo':'Dispositivos escolhidos'
  }
  setHistory(current=>{const next=[item,...current].slice(0,100);saveJson(historyKey,next);return next})
 }

 const connection=loading?{tone:'pending',label:'Conectando dispositivo'}:activeDevices.length?{tone:'connected',label:`${activeDevices.length} dispositivo${activeDevices.length===1?'':'s'} conectado${activeDevices.length===1?'':'s'}`}:{tone:'disconnected',label:'Nenhum dispositivo conectado'}
 const filteredHistory=history.filter(item=>{
  const days=Number(historyPeriod),within=Date.now()-new Date(item.createdAt).getTime()<=days*86400000
  return within&&(historyStatus==='all'||item.status===historyStatus)
 })

 return <div className="push-studio push-ai-studio">
  <header className="push-studio-header">
   <div><span>NOTIFICAÇÕES PUSH</span><h2>Gerador de notificações</h2><p>Crie com IA, revise e envie alertas Push reais aos seus dispositivos.</p></div>
   <div className={`push-connection ${connection.tone}`}><i/>{connection.label}</div>
  </header>
  <nav className="push-tabs" aria-label="Seções do gerador">
   <button className={tab==='generator'?'active':''} onClick={()=>setTab('generator')}><WandSparkles/> Gerador</button>
   <button className={tab==='models'?'active':''} onClick={()=>setTab('models')}><Layers3/> Modelos</button>
   <button className={tab==='history'?'active':''} onClick={()=>setTab('history')}><Clock3/> Histórico</button>
  </nav>
  {!activeDevices.length&&<section className="push-activation">
   <div className="push-activation-icon"><BellRing/></div><div><h3>Ativar notificações</h3><p>Conecte este dispositivo para receber e enviar alertas da SphexPay.</p></div>
   <button className="btn btn-primary" onClick={()=>void activate()} disabled={connecting||permission==='denied'}>{connecting?'Conectando…':'Ativar neste dispositivo'}</button>
  </section>}
  {message&&<p className="push-feedback" role="status" aria-live="polite">{message}</p>}
  {tab==='generator'&&<main className="ai-generator-layout">
   <div className="ai-flow">
    <section className="ai-step ai-create">
     <Step number="1" title="Criar com IA" description="Explique o que deseja comunicar e receba sugestões prontas para enviar."/>
     <label className="ai-request"><span>O que você deseja comunicar?</span><textarea maxLength={1200} value={request} onChange={event=>setRequest(event.target.value)} placeholder="Exemplo: Avise que uma venda de R$ 197,00 foi aprovada para o produto Curso Sphex Start. Use um tom motivacional."/><small>{request.length}/1200</small></label>
     <div className="ai-quick-prompts" aria-label="Sugestões de pedido">{quickPrompts.map(prompt=><button type="button" onClick={()=>setRequest(prompt)} key={prompt}>{prompt}</button>)}</div>
     <details className="ai-context"><summary>Adicionar contexto <ChevronDown/></summary><div className="ai-context-grid">
      <SelectField label="Objetivo" value={context.objective} values={options.objective} onChange={objective=>setContext(current=>({...current,objective}))}/>
      <SelectField label="Tom" value={context.tone} values={options.tone} onChange={tone=>setContext(current=>({...current,tone}))}/>
      <SelectField label="Tamanho" value={context.size} values={options.size} onChange={size=>setContext(current=>({...current,size}))}/>
      <SelectField label="Uso de emoji" value={context.emoji} values={options.emoji} onChange={emoji=>setContext(current=>({...current,emoji}))}/>
      <SelectField label="Público" value={context.audience} values={options.audience} onChange={audience=>setContext(current=>({...current,audience}))}/>
      <label><span>Produto</span><select value={products.find(item=>item.name===draft.product)?.id||''} onChange={event=>selectProduct(event.target.value)}><option value="">Sem produto</option>{products.map(product=><option value={product.id} key={product.id}>{product.name} · {product.currency||'BRL'} {product.price.toLocaleString('pt-BR',{minimumFractionDigits:2})} · {product.active?'Ativo':'Inativo'}</option>)}</select></label>
      <label><span>Valor</span><input inputMode="decimal" value={draft.value} onChange={event=>setDraft(current=>({...current,value:normalizeBrazilianAmount(event.target.value)}))} placeholder="297,00"/></label>
      <label><span>Moeda</span><select value={draft.currency} onChange={event=>setDraft(current=>({...current,currency:event.target.value as ManualCurrency}))}><option>BRL</option><option>USD</option><option>EUR</option></select></label>
      <label><span>Cliente opcional</span><input value={draft.customer} onChange={event=>setDraft(current=>({...current,customer:event.target.value}))}/></label>
      <label><span>Método de pagamento</span><input value={draft.method} onChange={event=>setDraft(current=>({...current,method:event.target.value}))}/></label>
      <label><span>Rota de destino</span><input value={draft.route} onChange={event=>setDraft(current=>({...current,route:event.target.value}))}/></label>
      <label className="wide"><span>Informações adicionais</span><textarea maxLength={500} value={context.additional} onChange={event=>setContext(current=>({...current,additional:event.target.value}))}/></label>
     </div></details>
     <button className="btn btn-primary ai-generate-button" disabled={!request.trim()||aiState==='analyzing'||aiState==='creating'} onClick={()=>void generate()}>
      <Sparkles/>{aiState==='analyzing'?'Analisando contexto':aiState==='creating'?'Criando sugestões':aiState==='ready'?'Gerar novamente':aiState==='error'?'Tentar novamente':'Gerar com IA'}
     </button>
     {aiState==='unavailable'&&<div className="ai-unavailable"><b>A criação com IA ainda não está configurada.</b><span>Use um modelo pronto e continue com o envio manual.</span></div>}
    </section>
    <section className="ai-step ai-suggestions">
     <Step number="2" title="Personalizar" description="Compare três caminhos editoriais antes de escolher."/>
     {!aiResult&&<div className="ai-empty"><WandSparkles/><b>Suas sugestões aparecerão aqui</b><span>A IA só é acionada quando você clicar em Gerar com IA.</span></div>}
     {aiResult&&<div className="ai-suggestion-list">{aiResult.suggestions.map((suggestion,index)=><article className={selectedSuggestion===index?'selected':''} key={suggestion.id}>
      <header><span>{suggestion.label}</span>{aiResult.recommendedIndex===index&&<em>Recomendação da IA</em>}</header>
      <label><span>Título</span><input maxLength={60} value={suggestion.title} onChange={event=>setAiResult(current=>current?{...current,suggestions:current.suggestions.map((item,itemIndex)=>itemIndex===index?{...item,title:event.target.value}:item)}:current)}/><small>{suggestion.title.length}/60</small></label>
      <label><span>Mensagem</span><textarea maxLength={160} value={suggestion.body} onChange={event=>setAiResult(current=>current?{...current,suggestions:current.suggestions.map((item,itemIndex)=>itemIndex===index?{...item,body:event.target.value}:item)}:current)}/><small>{suggestion.body.length}/160</small></label>
      <p>{suggestion.reason}</p>
      <div><button className="btn btn-primary" onClick={()=>applySuggestion(suggestion,index)}>Usar esta versão</button><button className="btn" onClick={()=>void generate('similar',suggestion)}>Gerar semelhante</button></div>
     </article>)}</div>}
     {aiResult&&<div className="ai-transform-actions" aria-label="Aprimorar texto com IA">
      <button onClick={()=>void generate('shorter')}>Tornar mais curta</button><button onClick={()=>void generate('professional')}>Mais profissional</button>
      <button onClick={()=>void generate('persuasive')}>Mais persuasiva</button><button onClick={()=>void generate('remove_emojis')}>Remover emojis</button>
     </div>}
    </section>
    <section className="ai-step ai-destinations">
     <Step number="3" title="Destinatários" description="Escolha somente dispositivos conectados à sua conta."/>
     <div className="push-destinations">
      <Destination checked={targetMode==='current'} onChange={()=>setTargetMode('current')} disabled={!currentDevice} title="Este dispositivo" detail={currentDevice?`${currentDevice.name} · ${currentDevice.browser} no ${currentDevice.operatingSystem} · ${relativeTime(currentDevice.lastSeenAt)}`:'Este navegador ainda não está conectado'}/>
      <Destination checked={targetMode==='all'} onChange={()=>setTargetMode('all')} title="Todos os meus dispositivos" detail={`${activeDevices.length} ativo(s)`}/>
      <Destination checked={targetMode==='choose'} onChange={()=>setTargetMode('choose')} title="Escolher dispositivos" detail={`${chosenIds.length} selecionado(s)`}/>
     </div>
     {targetMode==='choose'&&<div className="ai-device-list">{activeDevices.map(device=><label key={device.id}><input type="checkbox" checked={chosenIds.includes(device.deviceId)} onChange={()=>setChosenIds(current=>current.includes(device.deviceId)?current.filter(id=>id!==device.deviceId):[...current,device.deviceId])}/><span><b>{device.name}</b><small>{device.browser} no {device.operatingSystem} · {relativeTime(device.lastSeenAt)} · {device.status}</small></span></label>)}</div>}
    </section>
    <section className="ai-step ai-review">
     <Step number="4" title="Revisar e enviar" description="O Push será entregue e registrado pelo backend."/>
     <div className="ai-edit-grid">
      <label><span>Título final</span><input maxLength={60} value={draft.title} onChange={event=>setDraft(current=>({...current,title:event.target.value}))}/><small>{draft.title.length}/60</small></label>
      <label><span>Mensagem final</span><textarea maxLength={160} value={draft.body} onChange={event=>setDraft(current=>({...current,body:event.target.value}))}/><small>{draft.body.length}/160</small></label>
     </div>
     <div className="ai-review-actions"><input aria-label="Nome do modelo" value={modelName} onChange={event=>setModelName(event.target.value)} placeholder="Nome para salvar como modelo"/><button className="btn" onClick={()=>saveModel()}><Copy/> Salvar modelo</button></div>
    </section>
   </div>
   <aside className="ai-preview-column">
    <NotificationPreview preview={preview} setPreview={setPreview} title={formatted.title} body={formatted.body} showTime={draft.showTime}/>
    <div className="ai-send-dock"><div><b>Pronto para enviar</b><span>{selectedIds.length} dispositivo(s) selecionado(s)</span></div><button className="btn btn-primary" disabled={sending||!selectedIds.length||Boolean(formatted.missing.length)} onClick={()=>void send()}><Send/>{sending?'Enviando':'Enviar notificação'}</button></div>
   </aside>
  </main>}
  {tab==='models'&&<section className="push-tab-panel ai-models">
   <div className="push-tab-heading"><div><span>MODELOS</span><h3>Modelos prontos e personalizados</h3><p>Modelos locais são editáveis e não usam IA.</p></div></div>
   <h4>Modelos oficiais</h4><div className="ai-official-models">{Object.entries(manualNotificationTemplates).map(([type,template])=><article key={type}><span>{template.label}</span><b>{template.title}</b><p>{template.body}</p><button className="btn" onClick={()=>applyTemplate(type as ManualNotificationType)}>Usar modelo</button></article>)}</div>
   <h4>Meus modelos</h4><div className="push-model-list">{models.map(model=><article key={model.id}><div><Layers3/><span><b>{model.name}</b><small>{model.config.title}</small></span></div><div><button className="btn" onClick={()=>{setDraft(model.config);setTab('generator')}}>Editar</button><button className="btn" onClick={()=>saveModel(model.config,`${model.name} — cópia`)}>Duplicar</button><button className="btn" onClick={()=>{setDraft(model.config);setRequest(`Crie uma variação para ${model.config.title}: ${model.config.body}`);setTab('generator')}}>Variação com IA</button><button className="btn btn-ghost" aria-label={`Favoritar ${model.name}`} onClick={()=>toggleFavorite(model.id)}><Star fill={model.favorite?'currentColor':'none'}/></button><button className="btn btn-ghost" aria-label={`Excluir ${model.name}`} onClick={()=>deleteModel(model.id)}><Trash2/></button></div></article>)}{!models.length&&<div className="push-tab-empty"><Copy/><p>Nenhum modelo personalizado salvo.</p></div>}</div>
  </section>}
  {tab==='history'&&<section className="push-tab-panel ai-history">
   <div className="push-tab-heading"><div><span>HISTÓRICO</span><h3>Envios manuais recentes</h3><p>Resultados reais retornados pelo backend Push.</p></div><div className="ai-history-filters"><select aria-label="Período do histórico" value={historyPeriod} onChange={event=>setHistoryPeriod(event.target.value)}><option value="1">Hoje</option><option value="7">7 dias</option><option value="30">30 dias</option></select><select aria-label="Status do histórico" value={historyStatus} onChange={event=>setHistoryStatus(event.target.value)}><option value="all">Todos os status</option>{(['Entregue','Parcial','Falhou','Cancelado'] as const).map(status=><option key={status}>{status}</option>)}</select></div></div>
   <div className="push-history-list">{filteredHistory.map(item=><article key={item.id}><i className={item.status==='Entregue'?'delivered':item.status==='Parcial'?'partial':'failed'}/><div><b>{item.title}</b><small>{item.body} · {relativeTime(item.createdAt)} · {item.destination}</small></div><dl><div><dt>Enviadas</dt><dd>{item.sent}</dd></div><div><dt>Falhas</dt><dd>{item.failed+item.expired}</dd></div><div><dt>Status</dt><dd>{item.status}</dd></div></dl><div className="ai-history-actions"><button className="btn" onClick={()=>reuseHistory(item)}><RefreshCcw/> Reenviar</button><button className="btn" onClick={()=>reuseHistory(item,true)}><Sparkles/> Criar variação com IA</button><button className="btn" onClick={()=>saveModel({...draft,notificationType:item.type,title:item.title,body:item.body},item.title)}><Copy/> Modelo</button></div></article>)}{!filteredHistory.length&&<div className="push-tab-empty"><HistoryIcon/><p>Nenhum envio encontrado neste período.</p></div>}</div>
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

function Step({number,title,description}:{number:string;title:string;description:string}){return <header className="ai-step-heading"><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></header>}
function SelectField({label,value,values,onChange}:{label:string;value:string;values:string[];onChange:(value:string)=>void}){return <label><span>{label}</span><select value={value} onChange={event=>onChange(event.target.value)}>{values.map(item=><option key={item}>{item}</option>)}</select></label>}
function Destination({checked,onChange,title,detail,disabled=false}:{checked:boolean;onChange:()=>void;title:string;detail:string;disabled?:boolean}){return <label className={disabled?'disabled':''}><input type="radio" name="push-destination" checked={checked} onChange={onChange} disabled={disabled}/><span><b>{title}</b><small>{detail}</small></span><i/></label>}
function Preference({label,checked,onChange}:{label:string;checked:boolean;onChange:(value:boolean)=>void}){return <label><span>{label}</span><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)}/><i/></label>}
function NotificationPreview({preview,setPreview,title,body,showTime}:{preview:PreviewDevice;setPreview:(value:PreviewDevice)=>void;title:string;body:string;showTime:boolean}){return <section className="ai-preview">
 <header><div><span>PRÉ-VISUALIZAÇÃO</span><h3>Veja antes de enviar</h3></div><nav aria-label="Dispositivo da pré-visualização">{([['iphone','iPhone',Smartphone],['android','Android',Smartphone],['desktop','Desktop',Monitor]] as const).map(([value,label,Icon])=><button type="button" aria-pressed={preview===value} className={preview===value?'active':''} onClick={()=>setPreview(value)} key={value}><Icon/>{label}</button>)}</nav></header>
 <div className={`push-preview-device ${preview}`}><div className="push-preview-top"><span>SphexPay</span>{showTime&&<time>agora</time>}</div><article><SphexPayLogo/><div><strong>{title||'Título da notificação'}</strong><p>{body||'Sua mensagem aparecerá aqui.'}</p></div></article></div>
 </section>}
