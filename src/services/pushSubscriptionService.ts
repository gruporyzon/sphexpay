import { supabase } from '../lib/supabase'

export type PushRegistrationStatus='active'|'unsupported'|'not-installed'|'missing-key'|'invalid-key'|'permission-denied'|'backend-unavailable'|'storage-unconfigured'|'error'
export type PushRegistrationResult={ok:boolean;status:PushRegistrationStatus;message:string}
export type PushSendResult={ok:boolean;code?:string;message:string;sent?:number;failed?:number;duplicates?:number}
export interface PushDiagnostic{
 https:boolean;notificationsApi:boolean;permission:'default'|'granted'|'denied'|'unsupported';serviceWorkerSupported:boolean;serviceWorkerRegistered:boolean;serviceWorkerActive:boolean;serviceWorkerControlling:boolean;pushManagerSupported:boolean;installed:boolean;subscription:boolean;saved:boolean;vapidConfigured:boolean;vapidStatus:'loaded'|'missing'|'invalid';backendConfigured:boolean;storageConfigured:boolean;platform:string;browser:string;lastTest:string;lastDelivery:string;lastError:string
}
type PushPayload={eventId:string;type:string;title:string;body:string;route:string;createdAt?:string;currency?:string;commission?:number|null}
type HealthResponse={vapidConfigured?:boolean;storageConfigured?:boolean;sendConfigured?:boolean;codes?:string[]}
const lastStateKey='sphexpay_push_diagnostics_v2'
const isIOS=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone)
export const requiresStandaloneForPush=(userAgent=navigator.userAgent,standalone=isStandalone())=>/iPad|iPhone|iPod/.test(userAgent)&&!standalone
const platform=()=>isIOS()?'iOS':/Android/i.test(navigator.userAgent)?'Android':/Mac/i.test(navigator.userAgent)?'macOS':/Windows/i.test(navigator.userAgent)?'Windows':'Outro'
const browser=()=>/Edg/i.test(navigator.userAgent)?'Edge':/CriOS|Chrome/i.test(navigator.userAgent)?'Chrome':/Firefox/i.test(navigator.userAgent)?'Firefox':/Safari/i.test(navigator.userAgent)?'Safari':'Navegador'
const readState=()=>{try{return JSON.parse(localStorage.getItem(lastStateKey)||'{}') as Partial<Pick<PushDiagnostic,'lastTest'|'lastDelivery'|'lastError'>>}catch{return{}}}
const writeState=(values:Partial<Pick<PushDiagnostic,'lastTest'|'lastDelivery'|'lastError'>>)=>{try{localStorage.setItem(lastStateKey,JSON.stringify({...readState(),...values}))}catch{/* Diagnóstico não impede a entrega. */}}
const log=(message:string)=>{if(import.meta.env.DEV)console.info(`[PUSH] ${message}`)}
const errorMessage=(code?:string,message?:string)=>message||({NO_ACTIVE_SUBSCRIPTIONS:'Nenhum dispositivo ativo foi encontrado.',VAPID_NOT_CONFIGURED:'As chaves do servidor de notificações não foram configuradas.',PUSH_STORAGE_NOT_CONFIGURED:'O armazenamento seguro de dispositivos ainda não foi configurado.',SUPABASE_SERVER_CREDENTIALS_MISSING:'As credenciais server-side do armazenamento ainda não foram configuradas.',SUBSCRIPTION_EXPIRED:'A inscrição deste dispositivo expirou. Ative novamente.',PERMISSION_DENIED:'A permissão de notificações está bloqueada neste dispositivo.',BACKEND_UNAVAILABLE:'O servidor de notificações está indisponível.',INVALID_PAYLOAD:'Os dados da notificação são inválidos.'}[code||'']||'Não foi possível enviar a notificação ao dispositivo.')

export function getVapidPublicKey(){
 const value=String(import.meta.env.VITE_VAPID_PUBLIC_KEY||'').trim()
 if(!value)throw new Error('VAPID_PUBLIC_KEY_MISSING')
 if(!/^[A-Za-z0-9_-]+$/.test(value)||value.toLowerCase().includes('example'))throw new Error('VAPID_PUBLIC_KEY_INVALID')
 let decoded:Uint8Array
 try{decoded=urlBase64ToUint8Array(value)}catch{throw new Error('VAPID_PUBLIC_KEY_INVALID')}
 if(decoded.length!==65||decoded[0]!==4)throw new Error('VAPID_PUBLIC_KEY_INVALID')
 return decoded
}

export function urlBase64ToUint8Array(value:string){
 const normalized=value.trim()
 const padding='='.repeat((4-(normalized.length%4))%4)
 const base64=(normalized+padding).replace(/-/g,'+').replace(/_/g,'/')
 const rawData=atob(base64)
 return Uint8Array.from([...rawData].map(character=>character.charCodeAt(0)))
}

let registrationPromise:Promise<ServiceWorkerRegistration>|null=null
export async function ensureServiceWorker(){
 if(!('serviceWorker'in navigator))throw new Error('SERVICE_WORKER_UNSUPPORTED')
 if(!registrationPromise){registrationPromise=(async()=>{
  const current=await navigator.serviceWorker.getRegistration('/')
  const registration=current||await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'})
  await registration.update().catch(()=>undefined)
  const ready=await navigator.serviceWorker.ready
  log('Service Worker ready')
  if(ready.waiting)ready.waiting.postMessage({type:'SKIP_WAITING'})
  return ready
 })().catch(error=>{registrationPromise=null;throw error})}
 return registrationPromise
}

const vapidStatus=()=>{try{getVapidPublicKey();return'loaded' as const}catch(error){return error instanceof Error&&error.message==='VAPID_PUBLIC_KEY_INVALID'?'invalid' as const:'missing' as const}}
const authHeaders=async()=>{const session=supabase?(await supabase.auth.getSession()).data.session:null;const headers:Record<string,string>={Accept:'application/json'};if(session?.access_token)headers.Authorization=`Bearer ${session.access_token}`;return headers}
const parseResponse=async(response:Response):Promise<PushSendResult>=>{let data:{success?:boolean;code?:string;message?:string;sent?:number;failed?:number;duplicates?:number}={};try{data=await response.json()}catch{/* Diagnóstico estruturado será usado abaixo. */}const ok=response.ok&&data.success===true&&(data.sent??0)>0;return{ok,code:data.code,message:ok?'Notificação enviada ao dispositivo.':errorMessage(data.code,data.message),sent:data.sent,failed:data.failed,duplicates:data.duplicates}}

export const pushSubscriptionService={
 supported(){return typeof window!=='undefined'&&'Notification'in window&&'serviceWorker'in navigator&&'PushManager'in window},
 deviceLabel(){return `${platform()} · ${browser()}`},
 async current(){if(!this.supported())return null;const ready=await ensureServiceWorker();return ready.pushManager.getSubscription()},
 async diagnose(userId?:string):Promise<PushDiagnostic>{
  const permission=!('Notification'in window)?'unsupported':Notification.permission
  let registration='serviceWorker'in navigator?await navigator.serviceWorker.getRegistration('/'):undefined,ready=registration?await navigator.serviceWorker.ready:null
  let subscription=false;try{subscription=Boolean(await this.current());registration=await navigator.serviceWorker.getRegistration('/');ready=registration?await navigator.serviceWorker.ready:null}catch{/* O diagnóstico continua mostrando o erro real. */}
  let saved=false,storageConfigured=false,lastDelivery=readState().lastDelivery||'—'
  if(subscription&&userId&&supabase){try{const current=await this.current(),endpoint=current?.endpoint||'',response=await fetch(`/api/push/status?endpoint=${encodeURIComponent(endpoint)}`,{method:'GET',headers:await authHeaders()});const data=await response.json() as {saved?:boolean;storageConfigured?:boolean;lastDelivery?:string;lastError?:string};saved=data.saved===true;storageConfigured=data.storageConfigured===true;lastDelivery=data.lastDelivery||lastDelivery;if(data.lastError&&data.lastError!=='—')writeState({lastError:data.lastError})}catch{/* A indisponibilidade aparece no backendConfigured. */}}
  let backendConfigured=false
  try{const response=await fetch('/api/push/health',{headers:{Accept:'application/json'}});if(response.ok){const data=await response.json() as HealthResponse;backendConfigured=data.sendConfigured===true;storageConfigured=storageConfigured||data.storageConfigured===true}}catch{/* Diagnóstico sem backend não é sucesso. */}
  const status=vapidStatus(),state=readState()
  return{https:window.isSecureContext||location.hostname==='localhost'||location.hostname==='127.0.0.1',notificationsApi:'Notification'in window,permission,serviceWorkerSupported:'serviceWorker'in navigator,serviceWorkerRegistered:Boolean(registration),serviceWorkerActive:Boolean(ready?.active),serviceWorkerControlling:Boolean(navigator.serviceWorker?.controller),pushManagerSupported:'PushManager'in window,installed:isStandalone(),subscription,saved,vapidConfigured:status==='loaded',vapidStatus:status,backendConfigured,storageConfigured,platform:platform(),browser:browser(),lastTest:state.lastTest||'—',lastDelivery,lastError:state.lastError||'—'}
 },
 async subscribe(userId:string):Promise<PushRegistrationResult>{
  if(!window.isSecureContext&&location.hostname!=='localhost'&&location.hostname!=='127.0.0.1')return{ok:false,status:'unsupported',message:'Uma conexão segura é necessária para ativar notificações.'}
  if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window))return{ok:false,status:'unsupported',message:'Este navegador não oferece suporte às notificações necessárias.'}
  if(requiresStandaloneForPush())return{ok:false,status:'not-installed',message:'Adicione a SphexPay à Tela de Início, abra pelo ícone e ative as notificações.'}
  if(Notification.permission!=='granted'){const permission=await Notification.requestPermission();if(permission!=='granted')return{ok:false,status:'permission-denied',message:permission==='denied'?'A permissão de notificações está bloqueada neste dispositivo.':'A permissão de notificações não foi concedida.'}}
  let decodedPublicKey:Uint8Array;try{decodedPublicKey=getVapidPublicKey()}catch(error){const status=error instanceof Error&&error.message==='VAPID_PUBLIC_KEY_INVALID'?'invalid-key':'missing-key';return{ok:false,status,message:status==='invalid-key'?'A chave pública de notificações é inválida.':'A chave pública de notificações ainda não foi configurada.'}}
  try{
   const ready=await ensureServiceWorker(),applicationServerKey=decodedPublicKey
   let existing=await ready.pushManager.getSubscription()
   const existingKey=existing?.options.applicationServerKey?new Uint8Array(existing.options.applicationServerKey):null
   if(existing&&existingKey&&(!existingKey.every((byte,index)=>byte===applicationServerKey[index])||existingKey.length!==applicationServerKey.length)){await existing.unsubscribe();existing=null}
   const subscription=existing||await ready.pushManager.subscribe({userVisibleOnly:true,applicationServerKey}),json=subscription.toJSON(),keys=json.keys||{}
   if(!keys.p256dh||!keys.auth)throw new Error('SUBSCRIPTION_KEYS_MISSING')
   const response=await fetch('/api/push/subscribe',{method:'POST',headers:{...(await authHeaders()),'Content-Type':'application/json'},body:JSON.stringify({subscription:{endpoint:subscription.endpoint,keys:{p256dh:keys.p256dh,auth:keys.auth}},userAgent:navigator.userAgent,platform:platform(),browser:browser(),deviceName:this.deviceLabel(),userId})})
   const data=await response.json().catch(()=>({})) as {success?:boolean;registered?:boolean;deviceId?:string;code?:string;message?:string}
   if(!response.ok||data.success!==true||data.registered!==true||!data.deviceId){const code=data.code||'BACKEND_UNAVAILABLE';return{ok:false,status:code==='PUSH_STORAGE_NOT_CONFIGURED'||code==='SUPABASE_SERVER_CREDENTIALS_MISSING'?'storage-unconfigured':'backend-unavailable',message:errorMessage(code,data.message)}}
   log(existing?'Existing subscription found':'New subscription created');log('Subscription saved');return{ok:true,status:'active',message:'Dispositivo conectado.'}
  }catch{const message='Não foi possível registrar este dispositivo.';writeState({lastError:message});return{ok:false,status:'error',message}}
 },
 async unsubscribe(){const subscription=await this.current();if(!subscription)return true;try{const response=await fetch('/api/push/unsubscribe',{method:'POST',headers:{...(await authHeaders()),'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint})});if(!response.ok)return false;const ok=await subscription.unsubscribe();if(ok)log('Device subscription removed');return ok}catch{return false}},
 async send(payload:PushPayload):Promise<PushSendResult>{
  if(!this.supported()||Notification.permission!=='granted')return{ok:false,code:'PERMISSION_DENIED',message:errorMessage('PERMISSION_DENIED')}
  const subscription=await this.current().catch(()=>null);if(!subscription)return{ok:false,code:'NO_ACTIVE_SUBSCRIPTIONS',message:errorMessage('NO_ACTIVE_SUBSCRIPTIONS')}
  try{const response=await fetch('/api/push/send',{method:'POST',headers:{...(await authHeaders()),'Content-Type':'application/json'},body:JSON.stringify(payload)});const parsed=await parseResponse(response);if(parsed.ok){log(payload.type==='device_test'?'Test request sent':'Delivery accepted');writeState({lastTest:payload.type==='device_test'?new Date().toISOString():readState().lastTest,lastDelivery:new Date().toISOString(),lastError:'—'})}else writeState({lastError:parsed.message});return parsed}catch{const parsed={ok:false,code:'BACKEND_UNAVAILABLE',message:errorMessage('BACKEND_UNAVAILABLE')};writeState({lastError:parsed.message});return parsed}
 },
 async sendTest(){return this.send({eventId:`push-test-${crypto.randomUUID?.()||Date.now()}`,type:'push_test',title:'Notificações ativadas',body:'Seu dispositivo está conectado.',route:'/app/dashboard',createdAt:new Date().toISOString()})}
}
