import { supabase } from '../lib/supabase'
import { getOrCreateDeviceIdentity } from './deviceIdentityService'

export type PushRegistrationStatus='active'|'unsupported'|'not-installed'|'missing-key'|'invalid-key'|'permission-denied'|'permission-required'|'backend-unavailable'|'storage-unconfigured'|'error'
export type PushRegistrationResult={ok:boolean;status:PushRegistrationStatus;code?:string;message:string;device?:PushDevice;httpStatus?:number}
export type PushSendResult={ok:boolean;eventId?:string;code?:string;reason?:string;message?:string;sent?:number;failed?:number;expired?:number;duplicates?:number;results?:Array<{deviceId:string;status:string;code?:string}>;httpStatus?:number;retryAfterMs?:number}
export type PushDevice={id:string;deviceId:string;name:string;platform:string;browser:string;operatingSystem:string;type:string;status:'Conectado'|'Ativo'|'Desconectado'|'Expirado'|'Erro';enabled:boolean;lastSeenAt:string;lastSuccessAt?:string|null;isCurrentDevice:boolean;lastErrorCode?:string|null}
export interface PushDiagnostic{
 https:boolean;notificationsApi:boolean;permission:'default'|'granted'|'denied'|'unsupported';serviceWorkerSupported:boolean;serviceWorkerRegistered:boolean;serviceWorkerActive:boolean;serviceWorkerControlling:boolean;serviceWorkerReady:boolean;pushManagerSupported:boolean;installed:boolean;deviceIdentityCreated:boolean;currentDeviceFound:boolean;subscription:boolean;saved:boolean;sessionAuthenticated:boolean;registrationApiResponded:boolean;databaseConfirmed:boolean;activeDevices:number;vapidConfigured:boolean;vapidPresent:boolean;vapidValid:boolean;vapidCompatible:boolean;vapidStatus:'loaded'|'missing'|'invalid'|'incompatible';backendConfigured:boolean;storageConfigured:boolean;platform:string;browser:string;lastTest:string;lastDelivery:string;lastError:string;lastErrorCode:string;lastHttpStatus:number|null
}
type PushPayload={eventId:string;type:string;title:string;body:string;route:string;tag?:string;icon?:string;createdAt?:string;currency?:string;commission?:number|null;notificationType?:string;metadata?:Record<string,string>;targetDeviceId?:string;targetDeviceIds?:string[];target?:'all';targetCategory?:'desktop'|'mobile'}
export type ModePushInput={eventId:string;notificationType:string;title:string;body:string;currency:string;target:'all'|'devices'|'desktop'|'mobile';deviceIds:string[]}
type HealthResponse={vapidConfigured?:boolean;storageConfigured?:boolean;sendConfigured?:boolean;codes?:string[]}
const lastStateKey='sphexpay_push_diagnostics_v2'
const isIOS=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone)
export const requiresStandaloneForPush=(userAgent=navigator.userAgent,standalone=isStandalone())=>/iPad|iPhone|iPod/.test(userAgent)&&!standalone
const platform=()=>isIOS()?'iOS':/Android/i.test(navigator.userAgent)?'Android':/Mac/i.test(navigator.userAgent)?'macOS':/Windows/i.test(navigator.userAgent)?'Windows':'Outro'
const browser=()=>/Edg/i.test(navigator.userAgent)?'Edge':/CriOS|Chrome/i.test(navigator.userAgent)?'Chrome':/Firefox/i.test(navigator.userAgent)?'Firefox':/Safari/i.test(navigator.userAgent)?'Safari':'Navegador'
type DiagnosticState=Pick<PushDiagnostic,'lastTest'|'lastDelivery'|'lastError'|'lastErrorCode'|'lastHttpStatus'|'registrationApiResponded'|'databaseConfirmed'>
const readState=()=>{try{return JSON.parse(localStorage.getItem(lastStateKey)||'{}') as Partial<DiagnosticState>}catch{return{}}}
const writeState=(values:Partial<DiagnosticState>)=>{try{localStorage.setItem(lastStateKey,JSON.stringify({...readState(),...values}))}catch{/* Diagnóstico não impede a entrega. */}}
const log=(message:string)=>{if(import.meta.env.DEV)console.info(`[PUSH] ${message}`)}
const errorMessage=(code?:string,message?:string)=>message||({NO_ACTIVE_SUBSCRIPTIONS:'Nenhum dispositivo ativo foi encontrado.',VAPID_NOT_CONFIGURED:'As chaves do servidor de notificações não foram configuradas.',SUPABASE_SERVER_CREDENTIALS_MISSING:'As credenciais server-side do armazenamento ainda não foram configuradas.',SUBSCRIPTION_EXPIRED:'A inscrição deste dispositivo expirou. Ative novamente.',DELIVERY_LOG_SAVE_FAILED:'A tentativa não pôde ser registrada no histórico de entregas.',PERMISSION_DENIED:'A permissão de notificações está bloqueada neste dispositivo.',SESSION_MISSING:'Sessão autenticada não encontrada. Entre novamente.',INVALID_ACCESS_TOKEN:'A sessão expirou. Entre novamente.',BACKEND_UNAVAILABLE:'O servidor de notificações está indisponível.',INVALID_PAYLOAD:'Os dados da notificação são inválidos.'}[code||'']||`Falha técnica no envio${code?` (${code})`:''}.`)
const technicalError=(error:unknown)=>{
 const name=error instanceof DOMException?error.name:error instanceof Error?error.name:'Error'
 const explicit=error instanceof Error&&/^(?:VAPID_|SERVICE_WORKER_|SUBSCRIPTION_|OLD_SUBSCRIPTION_)/.test(error.message)?error.message:''
 const code=name==='NotAllowedError'?'PUSH_PERMISSION_NOT_ALLOWED':name==='InvalidAccessError'?'PUSH_VAPID_INCOMPATIBLE':name==='AbortError'?'PUSH_SUBSCRIBE_ABORTED':name==='TypeError'?'PUSH_SUBSCRIBE_TYPE_ERROR':name==='InvalidStateError'?'SERVICE_WORKER_NOT_ACTIVE':explicit||'PUSH_SUBSCRIBE_FAILED'
 const message={PUSH_PERMISSION_NOT_ALLOWED:'O navegador recusou a criação da inscrição.',PUSH_VAPID_INCOMPATIBLE:'A chave pública não é compatível com este navegador ou com a inscrição anterior.',PUSH_SUBSCRIBE_ABORTED:'O navegador interrompeu a criação da inscrição.',PUSH_SUBSCRIBE_TYPE_ERROR:'O navegador rejeitou os parâmetros da inscrição.',SERVICE_WORKER_NOT_ACTIVE:'O Service Worker ainda não está ativo.',SERVICE_WORKER_UNSUPPORTED:'Service Worker não suportado.',SERVICE_WORKER_READY_FAILED:'O Service Worker não ficou pronto para criar a inscrição.',VAPID_PUBLIC_KEY_INVALID:'A chave pública VAPID é estruturalmente inválida.',VAPID_PUBLIC_KEY_MISSING:'A chave pública VAPID está ausente.',SUBSCRIPTION_KEYS_MISSING:'A inscrição criada não contém as chaves exigidas.',OLD_SUBSCRIPTION_UNSUBSCRIBE_FAILED:'A inscrição vinculada ao par anterior não pôde ser removida.',PUSH_SUBSCRIBE_FAILED:'Falha técnica ao criar a PushSubscription.'}[code]||'Falha técnica ao criar a PushSubscription.'
 return{code,message:`${code}: ${message}`}
}

export function getVapidPublicKey(){
 const value=String(import.meta.env.VITE_VAPID_PUBLIC_KEY||'').trim().replace(/\s+/g,'')
 if(!value)throw new Error('VAPID_PUBLIC_KEY_MISSING')
 if(!/^[A-Za-z0-9_-]+={0,2}$/.test(value)||value.toLowerCase().includes('example'))throw new Error('VAPID_PUBLIC_KEY_INVALID')
 let decoded:Uint8Array
 try{decoded=urlBase64ToUint8Array(value)}catch{throw new Error('VAPID_PUBLIC_KEY_INVALID')}
 if(decoded.length!==65||decoded[0]!==4)throw new Error('VAPID_PUBLIC_KEY_INVALID')
 return decoded
}

export function urlBase64ToUint8Array(value:string){
 const normalized=value.replace(/\s+/g,'').replace(/=+$/g,'')
 if(!normalized||!/^[A-Za-z0-9_-]+$/.test(normalized))throw new Error('VAPID_PUBLIC_KEY_INVALID')
 const padding='='.repeat((4-(normalized.length%4))%4)
 const base64=(normalized+padding).replace(/-/g,'+').replace(/_/g,'/')
 const rawData=atob(base64)
 return Uint8Array.from([...rawData].map(character=>character.charCodeAt(0)))
}

const serviceWorkerTimeoutMs=12_000
const timeout=<T>(promise:Promise<T>,code:string)=>new Promise<T>((resolve,reject)=>{
 const timer=window.setTimeout(()=>reject(new Error(code)),serviceWorkerTimeoutMs)
 promise.then(value=>{window.clearTimeout(timer);resolve(value)},error=>{window.clearTimeout(timer);reject(error)})
})

export async function getReadyServiceWorkerRegistration(){
 if(!('serviceWorker'in navigator))throw new Error('SERVICE_WORKER_UNSUPPORTED')
 const current=await navigator.serviceWorker.getRegistration('/')
 const registration=current||await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'})
 if(registration.scope&&(new URL(registration.scope).origin!==location.origin||new URL(registration.scope).pathname!=='/'))throw new Error('SERVICE_WORKER_SCOPE_INVALID')
 await registration.update().catch(()=>undefined)
 const ready=await timeout(Promise.resolve(navigator.serviceWorker.ready),'SERVICE_WORKER_READY_TIMEOUT')
 log('Service Worker ready')
 if(ready.waiting)ready.waiting.postMessage({type:'SKIP_WAITING'})
 return ready
}
export const ensureServiceWorker=getReadyServiceWorkerRegistration

const vapidStatus=()=>{try{getVapidPublicKey();return'loaded' as const}catch(error){return error instanceof Error&&error.message==='VAPID_PUBLIC_KEY_INVALID'?'invalid' as const:'missing' as const}}
const currentSession=async()=>supabase?(await supabase.auth.getSession()).data.session:null
const parseResponse=async(response:Response):Promise<PushSendResult>=>{let data:{success?:boolean;eventId?:string;code?:string;reason?:string;message?:string;sent?:number;failed?:number;expired?:number;duplicates?:number}={};try{data=await response.json()}catch{/* Código HTTP ainda é preservado. */}const ok=response.ok&&data.success===true&&((data.sent??0)>0||(data.duplicates??0)>0);const retryAfter=Number(response.headers.get('Retry-After'));return{ok,eventId:data.eventId,code:data.code,reason:data.reason,message:ok?'Notificação enviada ao dispositivo.':errorMessage(data.code,data.message),sent:data.sent,failed:data.failed,expired:data.expired,duplicates:data.duplicates,httpStatus:response.status,retryAfterMs:Number.isFinite(retryAfter)&&retryAfter>0?retryAfter*1000:undefined}}

let subscriptionPromise:Promise<PushRegistrationResult>|null=null

async function registerSubscription(requestPermission:boolean):Promise<PushRegistrationResult>{
 if(subscriptionPromise)return subscriptionPromise
 const operation=(async():Promise<PushRegistrationResult>=>{
  if(!window.isSecureContext&&location.hostname!=='localhost'&&location.hostname!=='127.0.0.1')return{ok:false,status:'unsupported',code:'INSECURE_CONTEXT',message:'Uma conexão HTTPS é necessária.'}
  if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window))return{ok:false,status:'unsupported',code:'PUSH_UNSUPPORTED',message:'Este navegador não oferece suporte ao Push.'}
  if(requiresStandaloneForPush())return{ok:false,status:'not-installed',code:'PWA_INSTALL_REQUIRED',message:'Adicione a SphexPay à Tela de Início.'}
  if(Notification.permission==='denied')return{ok:false,status:'permission-denied',code:'PERMISSION_DENIED',message:'Notificações estão bloqueadas neste navegador.'}
  if(Notification.permission==='default'&&!requestPermission)return{ok:false,status:'permission-required',code:'PERMISSION_REQUIRED',message:'A permissão depende de uma ação do usuário.'}
  if(Notification.permission==='default'){
   let permission:NotificationPermission
   try{permission=await Notification.requestPermission()}catch(error){const technical=technicalError(error);return{ok:false,status:'permission-denied',...technical}}
   if(permission!=='granted')return{ok:false,status:'permission-denied',code:'PUSH_PERMISSION_NOT_ALLOWED',message:`Permissão ${permission}.`}
  }
  let applicationServerKey:Uint8Array
  try{applicationServerKey=getVapidPublicKey()}catch(error){const technical=technicalError(error);return{ok:false,status:technical.code==='VAPID_PUBLIC_KEY_INVALID'?'invalid-key':'missing-key',...technical}}
  let session
  try{session=await currentSession()}catch{return{ok:false,status:'error',code:'SESSION_LOOKUP_FAILED',message:'Não foi possível consultar a sessão atual.'}}
  if(!session?.access_token)return{ok:false,status:'error',code:'SESSION_MISSING',message:errorMessage('SESSION_MISSING')}
  try{
   let registration:ServiceWorkerRegistration
   try{registration=await getReadyServiceWorkerRegistration()}catch{throw new Error('SERVICE_WORKER_READY_FAILED')}
   if(!registration.active)throw new DOMException('Service Worker inactive','InvalidStateError')
   let existing=await registration.pushManager.getSubscription()
   const existingKey=existing?.options.applicationServerKey?new Uint8Array(existing.options.applicationServerKey):null
   const keyMatches=existingKey?.length===applicationServerKey.length&&existingKey.every((byte,index)=>byte===applicationServerKey[index])
   if(existing&&!keyMatches){const removed=await existing.unsubscribe();if(!removed)throw new Error('OLD_SUBSCRIPTION_UNSUBSCRIBE_FAILED');existing=null}
   if(!existing&&!requestPermission)return{ok:false,status:'permission-required',code:'SUBSCRIPTION_RECONNECT_REQUIRED',message:'Este computador precisa ser conectado novamente.'}
   const subscription=existing||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey})
   const json=subscription.toJSON(),keys=json.keys||{}
   if(!subscription.endpoint||!keys.p256dh||!keys.auth)throw new Error('SUBSCRIPTION_KEYS_MISSING')
   const identity=await getOrCreateDeviceIdentity()
   const response=await fetch('/api/push/subscribe',{method:'POST',headers:{Accept:'application/json',Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({deviceId:identity.deviceId,subscription:{endpoint:subscription.endpoint,expirationTime:subscription.expirationTime,keys:{p256dh:keys.p256dh,auth:keys.auth}},automaticName:identity.automaticName,browser:identity.browser,operatingSystem:identity.operatingSystem,platform:identity.platform,displayMode:identity.displayMode,locale:identity.locale,timezone:identity.timezone})})
   const data=await response.json().catch(()=>({})) as {registered?:boolean;device?:PushDevice;code?:string;message?:string}
   writeState({registrationApiResponded:true,lastHttpStatus:response.status,lastErrorCode:data.code||'—'})
   if(!response.ok){const code=data.code||`HTTP_${response.status}`,message=errorMessage(code,data.message);writeState({databaseConfirmed:false,lastError:message,lastErrorCode:code});return{ok:false,status:code==='SUPABASE_SERVER_CREDENTIALS_MISSING'?'storage-unconfigured':'backend-unavailable',code,message,httpStatus:response.status}}
   if(data.registered!==true||!data.device?.id||data.device.deviceId!==identity.deviceId||data.device.enabled!==true){const code='REGISTERED_CONFIRMATION_MISSING',message='A API não confirmou o dispositivo atual.';writeState({databaseConfirmed:false,lastError:message,lastErrorCode:code});return{ok:false,status:'backend-unavailable',code,message,httpStatus:response.status}}
   writeState({registrationApiResponded:true,databaseConfirmed:true,lastHttpStatus:response.status,lastError:'—',lastErrorCode:'—'})
   log(existing?'Existing subscription found':'New subscription created')
   return{ok:true,status:'active',message:'Dispositivo conectado e confirmado no banco.',device:data.device,httpStatus:response.status}
  }catch(error){const technical=technicalError(error);writeState({databaseConfirmed:false,lastError:technical.message,lastErrorCode:technical.code});return{ok:false,status:'error',...technical}}
 })().finally(()=>{subscriptionPromise=null})
 subscriptionPromise=operation
 return operation
}

export const pushSubscriptionService={
 supported(){return typeof window!=='undefined'&&'Notification'in window&&'serviceWorker'in navigator&&'PushManager'in window},
 deviceLabel(){return `${platform()} · ${browser()}`},
 async current(){if(!this.supported())return null;const ready=await ensureServiceWorker();return ready.pushManager.getSubscription()},
 async diagnose():Promise<PushDiagnostic>{
  const permission=!('Notification'in window)?'unsupported':Notification.permission
  let registration='serviceWorker'in navigator?await navigator.serviceWorker.getRegistration('/'):undefined,ready=registration?await navigator.serviceWorker.ready:null
  let currentSubscription:PushSubscription|null=null
  try{currentSubscription=await this.current();registration=await navigator.serviceWorker.getRegistration('/');ready=registration?await navigator.serviceWorker.ready:null}catch(error){const technical=technicalError(error);writeState({lastError:technical.message,lastErrorCode:technical.code})}
  const subscription=Boolean(currentSubscription),sessionAuthenticated=Boolean(await currentSession()),publicKeyStatus=vapidStatus()
  let vapidCompatible=publicKeyStatus==='loaded'
  if(currentSubscription&&publicKeyStatus==='loaded'){
   const key=getVapidPublicKey(),existingKey=currentSubscription.options.applicationServerKey?new Uint8Array(currentSubscription.options.applicationServerKey):null
   vapidCompatible=Boolean(existingKey?.length===key.length&&existingKey.every((byte,index)=>byte===key[index]))
  }
  let identity:null|Awaited<ReturnType<typeof getOrCreateDeviceIdentity>>=null
  try{identity=await getOrCreateDeviceIdentity()}catch{/* diagnóstico informa identidade ausente. */}
  let saved=false,storageConfigured=false,lastDelivery=readState().lastDelivery||'—',activeDevices=0,currentDeviceFound=false
  if(sessionAuthenticated&&identity){const devices=await this.devices();activeDevices=devices.filter(device=>device.enabled).length;const current=devices.find(device=>device.isCurrentDevice);currentDeviceFound=Boolean(current);saved=Boolean(current?.enabled);lastDelivery=current?.lastSuccessAt||lastDelivery}
  let backendConfigured=false
  try{const response=await fetch('/api/push/health',{headers:{Accept:'application/json'}});if(response.ok){const data=await response.json() as HealthResponse;backendConfigured=data.sendConfigured===true;storageConfigured=storageConfigured||data.storageConfigured===true}}catch{/* Diagnóstico sem backend não é sucesso. */}
  const state=readState(),status=!vapidCompatible&&publicKeyStatus==='loaded'?'incompatible':publicKeyStatus
  return{https:window.isSecureContext||location.hostname==='localhost'||location.hostname==='127.0.0.1',notificationsApi:'Notification'in window,permission,serviceWorkerSupported:'serviceWorker'in navigator,serviceWorkerRegistered:Boolean(registration),serviceWorkerActive:Boolean(ready?.active),serviceWorkerControlling:Boolean(navigator.serviceWorker?.controller),serviceWorkerReady:Boolean(ready?.active),pushManagerSupported:'PushManager'in window,installed:isStandalone(),deviceIdentityCreated:Boolean(identity),currentDeviceFound,subscription,saved,sessionAuthenticated,registrationApiResponded:state.registrationApiResponded===true,databaseConfirmed:saved||state.databaseConfirmed===true,activeDevices,vapidConfigured:publicKeyStatus==='loaded',vapidPresent:publicKeyStatus!=='missing',vapidValid:publicKeyStatus==='loaded',vapidCompatible,vapidStatus:status,backendConfigured,storageConfigured,platform:platform(),browser:browser(),lastTest:state.lastTest||'—',lastDelivery,lastError:state.lastError||'—',lastErrorCode:state.lastErrorCode||'—',lastHttpStatus:state.lastHttpStatus??null}
 },
 async subscribe():Promise<PushRegistrationResult>{return registerSubscription(true)},
 async syncExisting():Promise<PushRegistrationResult>{return registerSubscription(false)},
 async devices():Promise<PushDevice[]>{const session=await currentSession();if(!session?.access_token)return[];try{const identity=await getOrCreateDeviceIdentity(),response=await fetch(`/api/push/devices?currentDeviceId=${encodeURIComponent(identity.deviceId)}`,{headers:{Accept:'application/json',Authorization:`Bearer ${session.access_token}`}});const data=await response.json() as {devices?:PushDevice[]};writeState({lastHttpStatus:response.status});return response.ok&&Array.isArray(data.devices)?data.devices:[]}catch{return[]}},
 async updateDevice(id:string,values:{deviceName?:string;enabled?:boolean}){const session=await currentSession();if(!session?.access_token)return false;const response=await fetch(`/api/push/devices?id=${encodeURIComponent(id)}`,{method:'PATCH',headers:{Accept:'application/json',Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(values)});return response.ok},
 async removeDevice(device:PushDevice){const session=await currentSession();if(!session?.access_token)return false;try{const subscription=device.isCurrentDevice?await this.current():null;const response=await fetch(`/api/push/devices?id=${encodeURIComponent(device.id)}`,{method:'DELETE',headers:{Accept:'application/json',Authorization:`Bearer ${session.access_token}`}});if(!response.ok)return false;if(subscription&&!await subscription.unsubscribe())return false;writeState({databaseConfirmed:false});return true}catch{return false}},
 async send(payload:PushPayload):Promise<PushSendResult>{
  const session=await currentSession();if(!session?.access_token)return{ok:false,code:'SESSION_MISSING',message:errorMessage('SESSION_MISSING')}
  const request=async()=>{
   const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),15_000)
   try{const response=await fetch('/api/push/send',{method:'POST',signal:controller.signal,headers:{Accept:'application/json',Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});return await parseResponse(response)}
   catch(error){return{ok:false,code:error instanceof DOMException&&error.name==='AbortError'?'PUSH_TIMEOUT':'BACKEND_UNAVAILABLE',message:errorMessage(error instanceof DOMException&&error.name==='AbortError'?'PUSH_TIMEOUT':'BACKEND_UNAVAILABLE')} as PushSendResult}
   finally{window.clearTimeout(timeout)}
  }
  let parsed=await request()
  if(!parsed.ok&&(parsed.code==='PUSH_TIMEOUT'||parsed.code==='BACKEND_UNAVAILABLE'||(parsed.httpStatus??0)>=500))parsed=await request()
  if(parsed.ok){log('Delivery accepted');writeState({lastTest:payload.type==='infrastructure_test'?new Date().toISOString():readState().lastTest,lastDelivery:new Date().toISOString(),lastError:'—',lastErrorCode:'—',lastHttpStatus:parsed.httpStatus??null})}else writeState({lastError:parsed.message,lastErrorCode:parsed.code||'—',lastHttpStatus:parsed.httpStatus??null})
  return parsed
 },
 async sendTest(deviceId?:string){const targetDeviceId=deviceId||(await getOrCreateDeviceIdentity()).deviceId;return this.send({eventId:`infrastructure-test-${crypto.randomUUID?.()||Date.now()}`,type:'infrastructure_test',title:'SphexPay conectada',body:'As notificações estão funcionando neste computador.',route:'/app/configuracoes',tag:`sphexpay-infrastructure-test:${targetDeviceId}`,createdAt:new Date().toISOString(),targetDeviceId})},
 async sendManual(input:{eventId?:string;notificationType:string;title:string;body:string;route:string;icon:string;deviceIds:string[];currency:string}){const eventId=input.eventId||`manual-${crypto.randomUUID?.()||Date.now()}`;const result=await this.send({eventId,type:'manual_notification',notificationType:input.notificationType,title:input.title,body:input.body,route:input.route,icon:input.icon,tag:eventId,createdAt:new Date().toISOString(),currency:input.currency,metadata:{notificationType:input.notificationType,currency:input.currency},targetDeviceIds:input.deviceIds});return{...result,eventId:result.eventId||eventId}},
 async sendMode(input:ModePushInput){return this.send({eventId:input.eventId,type:'mode_notification',notificationType:input.notificationType,title:input.title,body:input.body,route:'/app/vendas-ao-vivo',icon:'/icons/sphexpay-app-192.png',tag:input.eventId,createdAt:new Date().toISOString(),currency:input.currency,metadata:{source:'mode',currency:input.currency},...(input.target==='all'?{target:'all' as const}:input.target==='desktop'||input.target==='mobile'?{targetCategory:input.target}:{targetDeviceIds:input.deviceIds})})},
 async sendGenerated(input:{notificationType:string;title:string;body:string;deviceId:string}){return this.send({eventId:`generator-${crypto.randomUUID?.()||Date.now()}`,type:'generator_notification',notificationType:input.notificationType,title:input.title,body:input.body,route:'/app/configuracoes',createdAt:new Date().toISOString(),...(input.deviceId==='all'?{target:'all' as const}:{targetDeviceId:input.deviceId})})}
}
