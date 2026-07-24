import { supabase } from '../lib/supabase'

export type PushRegistrationResult={ok:boolean;status:'active'|'unsupported'|'not-installed'|'missing-key'|'permission-denied'|'backend-unavailable'|'error';message:string}
const isIOS=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone)
const decodeKey=(value:string)=>{const padding='='.repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64);return Uint8Array.from([...raw].map(character=>character.charCodeAt(0)))}
const platform=()=>isIOS()?'iOS':/Android/i.test(navigator.userAgent)?'Android':/Mac/i.test(navigator.userAgent)?'macOS':/Windows/i.test(navigator.userAgent)?'Windows':'Outro'
const browser=()=>/Edg/i.test(navigator.userAgent)?'Edge':/CriOS|Chrome/i.test(navigator.userAgent)?'Chrome':/Safari/i.test(navigator.userAgent)?'Safari':'Navegador'

export const pushSubscriptionService={
 supported(){return 'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window},
 deviceLabel(){return `${platform()} · ${browser()}`},
 async current(){if(!this.supported())return null;const registration=await navigator.serviceWorker.ready;return registration.pushManager.getSubscription()},
 async subscribe(userId:string):Promise<PushRegistrationResult>{
  if(!('Notification'in window))return{ok:false,status:'unsupported',message:'Este navegador não oferece suporte às notificações necessárias.'}
  if(isIOS()&&!isStandalone())return{ok:false,status:'not-installed',message:'Instale a SphexPay na Tela de Início para ativar notificações no iPhone.'}
  if(Notification.permission!=='granted'){const permission=await Notification.requestPermission();if(permission!=='granted')return{ok:false,status:'permission-denied',message:permission==='denied'?'Permissão de notificações negada.':'A ativação não foi concluída.'}}
  if(!('serviceWorker'in navigator)||!('PushManager'in window))return{ok:false,status:'unsupported',message:'Este navegador não oferece suporte às notificações necessárias.'}
  const publicKey=String(import.meta.env.VITE_VAPID_PUBLIC_KEY||'').trim()
  if(!publicKey)return{ok:false,status:'missing-key',message:'A permissão foi concedida, mas a chave pública VAPID ainda não foi configurada.'}
  if(!supabase)return{ok:false,status:'backend-unavailable',message:'O backend Supabase não está configurado neste ambiente.'}
  try{
   const registration=await navigator.serviceWorker.ready
   const existing=await registration.pushManager.getSubscription()
   const subscription=existing||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(publicKey)})
   const json=subscription.toJSON(),keys=json.keys||{}
   const now=new Date().toISOString(),label=`${platform()} · ${browser()}`
   const {error}=await supabase.from('push_subscriptions').upsert({user_id:userId,endpoint:subscription.endpoint,p256dh:keys.p256dh||'',auth:keys.auth||'',user_agent:navigator.userAgent,device_name:label,platform:platform(),browser:browser(),enabled:true,last_seen_at:now,updated_at:now},{onConflict:'endpoint'})
   if(error)throw error
   return{ok:true,status:'active',message:'Notificações ativadas neste dispositivo.'}
  }catch{return{ok:false,status:'error',message:'Não foi possível registrar este dispositivo.'}}
 },
 async unsubscribe(){
  const subscription=await this.current()
  if(!subscription)return true
  if(supabase)await supabase.from('push_subscriptions').delete().eq('endpoint',subscription.endpoint)
  return subscription.unsubscribe()
 }
}
