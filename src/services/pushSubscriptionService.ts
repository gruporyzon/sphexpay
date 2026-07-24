import { supabase } from '../lib/supabase'

export type PushRegistrationStatus='active'|'unsupported'|'not-installed'|'missing-key'|'permission-denied'|'backend-unavailable'|'error'
export type PushRegistrationResult={ok:boolean;status:PushRegistrationStatus;message:string}
export type PushSendResult={ok:boolean;code?:string;message:string;sent?:number;failed?:number;duplicates?:number}
export interface PushDiagnostic{
 https:boolean;notificationsApi:boolean;permission:'default'|'granted'|'denied'|'unsupported';serviceWorkerSupported:boolean;serviceWorkerRegistered:boolean;serviceWorkerActive:boolean;serviceWorkerControlling:boolean;pushManagerSupported:boolean;installed:boolean;subscription:boolean;saved:boolean;vapidConfigured:boolean;backendConfigured:boolean;platform:string;browser:string;lastTest:string;lastDelivery:string;lastError:string
}
type PushPayload={eventId:string;type:string;title:string;body:string;route:string;createdAt?:string;currency?:string;commission?:number|null}
const lastStateKey='sphexpay_push_diagnostics_v1'
const isIOS=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone)
const platform=()=>isIOS()?'iOS':/Android/i.test(navigator.userAgent)?'Android':/Mac/i.test(navigator.userAgent)?'macOS':/Windows/i.test(navigator.userAgent)?'Windows':'Outro'
const browser=()=>/Edg/i.test(navigator.userAgent)?'Edge':/CriOS|Chrome/i.test(navigator.userAgent)?'Chrome':/Firefox/i.test(navigator.userAgent)?'Firefox':/Safari/i.test(navigator.userAgent)?'Safari':'Navegador'
const vapidKey=()=>String(import.meta.env.VITE_VAPID_PUBLIC_KEY||'').trim()
const pushEndpoint=()=>String(import.meta.env.VITE_PUSH_API_URL||'/api/push/send').trim()||'/api/push/send'
const readState=()=>{try{return JSON.parse(localStorage.getItem(lastStateKey)||'{}') as Partial<Pick<PushDiagnostic,'lastTest'|'lastDelivery'|'lastError'>>}catch{return{}}}
const writeState=(values:Partial<Pick<PushDiagnostic,'lastTest'|'lastDelivery'|'lastError'>>)=>{try{localStorage.setItem(lastStateKey,JSON.stringify({...readState(),...values}))}catch{/* Diagnóstico não impede a entrega. */}}
 const decodeKey=(value:string)=>{const normalized=value.trim().replace(/\s/g,'').replace(/-/g,'+').replace(/_/g,'/'),padding='='.repeat((4-normalized.length%4)%4),raw=atob(normalized+padding),result=Uint8Array.from([...raw].map(character=>character.charCodeAt(0)));if(result.length!==65)throw new Error('INVALID_VAPID_PUBLIC_KEY');return result}
const log=(message:string)=>{if(import.meta.env.DEV)console.info(`[PUSH] ${message}`)}
const errorMessage=(code?:string,message?:string)=>message||({NO_ACTIVE_SUBSCRIPTIONS:'Nenhum dispositivo ativo foi encontrado.',VAPID_NOT_CONFIGURED:'O servidor de notificações ainda não foi configurado.',SUBSCRIPTION_EXPIRED:'A inscrição deste dispositivo expirou. Ative novamente.',PERMISSION_DENIED:'A permissão de notificações está bloqueada neste dispositivo.',BACKEND_UNAVAILABLE:'O servidor de notificações está indisponível.',INVALID_PAYLOAD:'Os dados da notificação são inválidos.'}[code||'']||'Não foi possível enviar a notificação ao dispositivo.')

async function registration(){
 if(!('serviceWorker'in navigator))return null
 let current=await navigator.serviceWorker.getRegistration('/')
 if(!current)current=await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'})
 const ready=await navigator.serviceWorker.ready
 log('Service Worker ready')
 if(ready.waiting&&!navigator.serviceWorker.controller)ready.waiting.postMessage({type:'SKIP_WAITING'})
 return ready
}

async function parseResponse(response:Response):Promise<PushSendResult>{
 let data:{success?:boolean;code?:string;message?:string;sent?:number;failed?:number;duplicates?:number}={}
 try{data=await response.json()}catch{/* Mensagem estruturada será criada abaixo. */}
 const ok=response.ok&&data.success===true&&(data.sent??0)>0
 return{ok,code:data.code,message:ok?'Notificação enviada ao dispositivo.':errorMessage(data.code,data.message),sent:data.sent,failed:data.failed,duplicates:data.duplicates}
}

export const pushSubscriptionService={
 supported(){return typeof window!=='undefined'&&'Notification'in window&&'serviceWorker'in navigator&&'PushManager'in window},
 deviceLabel(){return `${platform()} · ${browser()}`},
 async current(){if(!this.supported())return null;const ready=await registration();return ready?.pushManager.getSubscription()||null},
 async diagnose(userId?:string):Promise<PushDiagnostic>{
  const permission=!('Notification'in window)?'unsupported':Notification.permission,initialRegistration='serviceWorker'in navigator?await navigator.serviceWorker.getRegistration('/'):undefined,subscription=Boolean(await this.current()),registrationState=initialRegistration||('serviceWorker'in navigator?await navigator.serviceWorker.getRegistration('/'):undefined),registered=Boolean(registrationState),ready=registered?await navigator.serviceWorker.ready:null,state=readState()
  let saved=false,lastDelivery=state.lastDelivery||'—'
  if(subscription&&supabase&&userId){const {data}=await supabase.from('push_subscriptions').select('last_seen_at,last_success_at,enabled').eq('user_id',userId).eq('enabled',true).order('last_seen_at',{ascending:false}).limit(1).maybeSingle();saved=Boolean(data);lastDelivery=data?.last_success_at?String(data.last_success_at):lastDelivery}
  let backendConfigured=Boolean(supabase)
  try{const response=await fetch('/api/push/health',{method:'GET',headers:{Accept:'application/json'}});if(response.ok){const data=await response.json() as {configured?:boolean};backendConfigured=Boolean(data.configured)}}catch{/* A rota pode estar indisponível durante o desenvolvimento local. */}
  return{https:window.isSecureContext||location.hostname==='localhost'||location.hostname==='127.0.0.1',notificationsApi:'Notification'in window,permission,serviceWorkerSupported:'serviceWorker'in navigator,serviceWorkerRegistered:registered,serviceWorkerActive:Boolean(ready?.active),serviceWorkerControlling:Boolean(navigator.serviceWorker?.controller),pushManagerSupported:'PushManager'in window,installed:isStandalone(),subscription,saved,vapidConfigured:Boolean(vapidKey()),backendConfigured,platform:platform(),browser:browser(),lastTest:state.lastTest||'—',lastDelivery,lastError:state.lastError||'—'}
 },
 async subscribe(userId:string):Promise<PushRegistrationResult>{
  if(!window.isSecureContext&&location.hostname!=='localhost'&&location.hostname!=='127.0.0.1')return{ok:false,status:'unsupported',message:'Uma conexão segura é necessária para ativar notificações.'}
  if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window))return{ok:false,status:'unsupported',message:'Este navegador não oferece suporte às notificações necessárias.'}
  if(isIOS()&&!isStandalone())return{ok:false,status:'not-installed',message:'Adicione a SphexPay à Tela de Início e abra pelo ícone para ativar notificações.'}
  if(Notification.permission!=='granted'){const permission=await Notification.requestPermission();if(permission!=='granted')return{ok:false,status:'permission-denied',message:permission==='denied'?'A permissão de notificações está bloqueada neste dispositivo.':'A permissão de notificações não foi concedida.'}}
  const publicKey=vapidKey();if(!publicKey)return{ok:false,status:'missing-key',message:'A chave pública de notificações ainda não foi configurada.'}
  try{
   const ready=await registration(),existing=await ready!.pushManager.getSubscription(),subscription=existing||await ready!.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(publicKey)}),json=subscription.toJSON(),keys=json.keys||{}
   if(!keys.p256dh||!keys.auth)throw new Error('SUBSCRIPTION_KEYS_MISSING')
   if(!supabase)throw new Error('BACKEND_UNAVAILABLE')
   const now=new Date().toISOString(),{error}=await supabase.from('push_subscriptions').upsert({user_id:userId,endpoint:subscription.endpoint,p256dh:keys.p256dh,auth:keys.auth,user_agent:navigator.userAgent,device_name:this.deviceLabel(),platform:platform(),browser:browser(),enabled:true,last_seen_at:now,updated_at:now,last_error:null},{onConflict:'endpoint'})
   if(error)throw error
   log(existing?'Existing subscription found':'New subscription created');log('Subscription saved');return{ok:true,status:'active',message:'Dispositivo conectado.'}
  }catch(error){const message=error instanceof Error&&error.message==='BACKEND_UNAVAILABLE'?'O servidor de notificações está indisponível.':'Não foi possível registrar este dispositivo.';writeState({lastError:message});return{ok:false,status:error instanceof Error&&error.message==='BACKEND_UNAVAILABLE'?'backend-unavailable':'error',message}}
 },
 async unsubscribe(){
  const subscription=await this.current();if(!subscription)return true
  if(supabase)await supabase.from('push_subscriptions').update({enabled:false,last_seen_at:new Date().toISOString()}).eq('endpoint',subscription.endpoint)
  const ok=await subscription.unsubscribe();if(ok)log('Device subscription removed');return ok
 },
 async send(payload:PushPayload):Promise<PushSendResult>{
  if(!this.supported()||Notification.permission!=='granted')return{ok:false,code:'PERMISSION_DENIED',message:errorMessage('PERMISSION_DENIED')}
  const subscription=await this.current();if(!subscription)return{ok:false,code:'NO_ACTIVE_SUBSCRIPTIONS',message:errorMessage('NO_ACTIVE_SUBSCRIPTIONS')}
  let response:Response|undefined
  try{
   const session=supabase?(await supabase.auth.getSession()).data.session:null,headers:Record<string,string>={'Content-Type':'application/json',Accept:'application/json'};if(session?.access_token)headers.Authorization=`Bearer ${session.access_token}`
   response=await fetch(pushEndpoint(),{method:'POST',headers,body:JSON.stringify(payload)})
   if(response.status===404||response.status===405)throw new Error('ROUTE_NOT_FOUND')
  }catch(error){
   if(error instanceof Error&&error.message==='ROUTE_NOT_FOUND'&&supabase){const result=await supabase.functions.invoke('send-push',{body:payload});if(result.error){const resultResponse=(result.error as {context?:Response}).context;if(resultResponse){const parsed=await parseResponse(resultResponse);writeState({lastError:parsed.message});return parsed}return{ok:false,code:'BACKEND_UNAVAILABLE',message:errorMessage('BACKEND_UNAVAILABLE')}}const data=result.data as {success?:boolean;code?:string;message?:string;sent?:number;failed?:number;duplicates?:number};const parsed={ok:data.success===true&&(data.sent??0)>0,code:data.code,message:data.success===true?'Notificação enviada ao dispositivo.':errorMessage(data.code,data.message),sent:data.sent,failed:data.failed,duplicates:data.duplicates};if(parsed.ok)writeState({lastTest:payload.type==='device_test'?new Date().toISOString():readState().lastTest,lastDelivery:new Date().toISOString(),lastError:'—'});else writeState({lastError:parsed.message});return parsed}
   const parsed={ok:false,code:'BACKEND_UNAVAILABLE',message:errorMessage('BACKEND_UNAVAILABLE')};writeState({lastError:parsed.message});return parsed
  }
  const parsed=await parseResponse(response);if(parsed.ok){log(payload.type==='device_test'?'Test request sent':'Delivery accepted');writeState({lastTest:payload.type==='device_test'?new Date().toISOString():readState().lastTest,lastDelivery:new Date().toISOString(),lastError:'—'});if(parsed.failed)log('Subscription expired or delivery failed')}else writeState({lastError:parsed.message});return parsed
 },
 async sendTest(){return this.send({eventId:`device-test-${crypto.randomUUID?.()||Date.now()}`,type:'device_test',title:'Notificações ativadas',body:'Seu dispositivo está conectado.',route:'/app/configuracoes',createdAt:new Date().toISOString()})}
}
