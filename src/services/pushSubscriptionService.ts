import { supabase } from '../lib/supabase'

export type PushRegistrationResult={ok:boolean;status:'active'|'unsupported'|'not-installed'|'missing-key'|'permission-denied'|'backend-unavailable'|'error';message:string}
const isIOS=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone)
const decodeKey=(value:string)=>{const padding='='.repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64);return Uint8Array.from([...raw].map(character=>character.charCodeAt(0)))}

export const pushSubscriptionService={
 supported(){return 'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window},
 async current(){if(!this.supported())return null;const registration=await navigator.serviceWorker.ready;return registration.pushManager.getSubscription()},
 async subscribe(userId:string):Promise<PushRegistrationResult>{
  if(!('Notification'in window))return{ok:false,status:'unsupported',message:'Notificações não são suportadas neste navegador.'}
  if(isIOS()&&!isStandalone())return{ok:false,status:'not-installed',message:'No iPhone, adicione a SphexPay à Tela de Início antes de ativar notificações.'}
  if(Notification.permission!=='granted'){const permission=await Notification.requestPermission();if(permission!=='granted')return{ok:false,status:'permission-denied',message:permission==='denied'?'A permissão foi bloqueada no navegador. A aplicação continuará funcionando normalmente.':'A ativação não foi concluída.'}}
  if(!('serviceWorker'in navigator)||!('PushManager'in window))return{ok:false,status:'unsupported',message:'A permissão foi concedida, mas Push em segundo plano não é suportado neste navegador.'}
  const publicKey=String(import.meta.env.VITE_VAPID_PUBLIC_KEY||'').trim()
  if(!publicKey)return{ok:false,status:'missing-key',message:'A permissão foi concedida, mas a chave pública VAPID ainda não foi configurada.'}
  if(!supabase)return{ok:false,status:'backend-unavailable',message:'O backend Supabase não está configurado neste ambiente.'}
  try{
   const registration=await navigator.serviceWorker.ready
   const existing=await registration.pushManager.getSubscription()
   const subscription=existing||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(publicKey)})
   const json=subscription.toJSON(),keys=json.keys||{}
   const {error}=await supabase.from('push_subscriptions').upsert({user_id:userId,endpoint:subscription.endpoint,p256dh:keys.p256dh||'',auth:keys.auth||'',user_agent:navigator.userAgent,updated_at:new Date().toISOString()},{onConflict:'endpoint'})
   if(error)throw error
   return{ok:true,status:'active',message:'Push notifications ativadas neste dispositivo.'}
  }catch{return{ok:false,status:'error',message:'Não foi possível registrar este dispositivo para push.'}}
 },
 async unsubscribe(){
  const subscription=await this.current()
  if(!subscription)return true
  if(supabase)await supabase.from('push_subscriptions').delete().eq('endpoint',subscription.endpoint)
  return subscription.unsubscribe()
 }
}
