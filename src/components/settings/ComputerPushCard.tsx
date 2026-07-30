import {BellRing,CheckCircle2,Laptop,RefreshCcw,Send,Unplug} from 'lucide-react'
import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {pushSubscriptionService,type PushDevice} from '../../services/pushSubscriptionService'

type Props={devices:PushDevice[];onRefresh:()=>Promise<void>}
type CardState='available'|'active'|'blocked'|'unsupported'|'worker-unavailable'|'insecure'|'expired'|'reconnect'

const isDesktop=()=>!/Mobile|iPhone|iPad|Android/i.test(navigator.userAgent)
const date=(value:string)=>value?new Date(value).toLocaleString('pt-BR'):'—'

export function ComputerPushCard({devices,onRefresh}:Props){
 const [localSubscription,setLocalSubscription]=useState(false)
 const [busy,setBusy]=useState<'activate'|'test'|'disable'|''>('')
 const [feedback,setFeedback]=useState('')
 const testLock=useRef(false)
 const current=devices.find(device=>device.isCurrentDevice)
 const notificationsSupported=typeof window!=='undefined'&&'Notification'in window&&'PushManager'in window
 const workerSupported='serviceWorker'in navigator
 const supported=notificationsSupported&&workerSupported
 const inspect=useCallback(async()=>{
  if(!supported||Notification.permission!=='granted'){setLocalSubscription(false);return}
  try{setLocalSubscription(Boolean(await pushSubscriptionService.current()))}catch{setLocalSubscription(false)}
 },[supported])

 useEffect(()=>{void inspect()},[inspect])
 useEffect(()=>{
  if(!('serviceWorker'in navigator))return
  const changed=(event:MessageEvent)=>{
   if(event.data?.type!=='PUSH_SUBSCRIPTION_CHANGED')return
   void pushSubscriptionService.syncExisting().then(()=>Promise.all([inspect(),onRefresh()]))
  }
  navigator.serviceWorker.addEventListener('message',changed)
  return()=>navigator.serviceWorker.removeEventListener('message',changed)
 },[inspect,onRefresh])

 const state=useMemo<CardState>(()=>{
  if(!window.isSecureContext&&location.hostname!=='localhost'&&location.hostname!=='127.0.0.1')return'insecure'
  if(!notificationsSupported)return'unsupported'
  if(!workerSupported)return'worker-unavailable'
  if(Notification.permission==='denied')return'blocked'
  if(current?.lastErrorCode==='SUBSCRIPTION_EXPIRED')return'expired'
  if(Notification.permission==='granted'&&current?.enabled&&localSubscription)return'active'
  if(Notification.permission==='granted'&&!localSubscription)return'reconnect'
  return'available'
 },[current,localSubscription,notificationsSupported,workerSupported])

 const activate=async()=>{
  if(busy)return
  setBusy('activate');setFeedback('')
  try{const result=await pushSubscriptionService.subscribe();await inspect();await onRefresh();setFeedback(result.ok?'Este computador está conectado.':result.message)}
  finally{setBusy('')}
 }
 const verify=async()=>{setFeedback('');await inspect();if(Notification.permission==='granted')await pushSubscriptionService.syncExisting();await onRefresh()}
 const test=async()=>{
  if(testLock.current||!current)return
  testLock.current=true;setBusy('test');setFeedback('')
  try{const result=await pushSubscriptionService.sendTest(current.deviceId);setFeedback(result.ok?'Notificação de teste enviada para este computador.':result.message||'O teste não foi entregue.');await onRefresh()}
  finally{window.setTimeout(()=>{testLock.current=false},3000);setBusy('')}
 }
 const disable=async()=>{
  if(!current||busy||!confirm('Desativar notificações somente neste computador?'))return
  setBusy('disable');setFeedback('')
  try{const removed=await pushSubscriptionService.removeDevice(current);setFeedback(removed?'Notificações desativadas neste computador.':'Não foi possível desativar este computador.');await inspect();await onRefresh()}
  finally{setBusy('')}
 }

 if(!isDesktop())return null
 const labels:Record<CardState,string>={available:'Disponível',active:'Ativa',blocked:'Bloqueada pelo navegador',unsupported:'Navegador incompatível','worker-unavailable':'Service Worker indisponível',insecure:'Requer HTTPS',expired:'Inscrição expirada',reconnect:'Inscrição expirada'}
 return <section className={`computer-push-card ${state}`} aria-labelledby="computer-push-title">
  <header><div className="computer-push-icon"><Laptop/></div><div><h3 id="computer-push-title">Notificações neste computador</h3><p>{state==='active'?'Este computador está conectado.':state==='blocked'?'Notificações estão bloqueadas neste navegador.':state==='expired'||state==='reconnect'?'Este computador precisa ser conectado novamente.':state==='insecure'?'Use uma conexão HTTPS para ativar notificações.':state==='worker-unavailable'?'O Service Worker não está disponível neste navegador.':state==='unsupported'?'Este navegador não oferece os recursos necessários de Push.':'Receba as novas vendas neste computador.'}</p></div><span><i/>{labels[state]}</span></header>
  {state==='active'&&current&&<dl><div><dt>Dispositivo</dt><dd>{current.name}</dd></div><div><dt>Navegador</dt><dd>{current.browser}</dd></div><div><dt>Sistema</dt><dd>{current.operatingSystem}</dd></div><div><dt>Última atualização</dt><dd>{date(current.lastSeenAt)}</dd></div></dl>}
  {state==='blocked'&&<p className="computer-push-guide">Abra as configurações do site no navegador e permita Notificações.</p>}
  <footer>
   {(state==='available'||state==='expired'||state==='reconnect')&&<button className="btn btn-primary" disabled={Boolean(busy)} onClick={()=>void activate()}><BellRing/>{busy==='activate'?'Conectando…':'Permitir notificações neste computador'}</button>}
   {state==='blocked'&&<button className="btn" disabled={Boolean(busy)} onClick={()=>void verify()}><RefreshCcw/>Verificar novamente</button>}
   {state==='active'&&<><button className="btn btn-primary" disabled={Boolean(busy)} onClick={()=>void test()}><Send/>{busy==='test'?'Enviando…':'Enviar teste'}</button><button className="btn" disabled={Boolean(busy)} onClick={()=>void disable()}><Unplug/>{busy==='disable'?'Desativando…':'Desativar neste computador'}</button></>}
   {state==='active'&&<CheckCircle2 className="computer-push-check"/>}
  </footer>
  {feedback&&<p className="computer-push-feedback" role="status" aria-live="polite">{feedback}</p>}
 </section>
}
