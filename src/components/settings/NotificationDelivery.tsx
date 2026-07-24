import { BellRing, MonitorSmartphone, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { browserPermissionService, type BrowserNotificationStatus } from '../../services/browserPermissionService'
import { pushSubscriptionService } from '../../services/pushSubscriptionService'
import { useDemoStore } from '../../store/useDemoStore'
import type { NotificationPreferences } from '../../types'
import { NotificationGeneratorPanel } from '../notifications/NotificationGeneratorPanel'

const statusText:Record<BrowserNotificationStatus,string>={
 unsupported:'Navegador incompatível',
 insecure:'Conexão segura necessária',
 default:'Não autorizadas',
 granted:'Ativadas',
 denied:'Permissão negada',
}

export function NotificationDelivery(){
 const {user}=useAuth(),preferences=useDemoStore(state=>state.preferences.notifications),update=useDemoStore(state=>state.updatePreferences)
 const [status,setStatus]=useState<BrowserNotificationStatus>(()=>browserPermissionService.status()),[subscribed,setSubscribed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[diagnostics,setDiagnostics]=useState<{subscription:boolean;saved:boolean;endpointHost:string;lastSeen:string;platform:string;browser:string}>()
 const set=(values:Partial<NotificationPreferences>)=>update('notifications',values)
 useEffect(()=>{let active=true;void pushSubscriptionService.current().then(subscription=>{if(active)setSubscribed(Boolean(subscription))});return()=>{active=false}},[])
 const activate=async()=>{
  if(!user){setMessage('Entre novamente para registrar este dispositivo.');return}
  setBusy(true)
  const result=await pushSubscriptionService.subscribe(user.id)
  setBusy(false);setStatus(browserPermissionService.status());setSubscribed(result.ok);set({device:result.ok,internal:false,sound:false})
  if(result.ok){const test=await pushSubscriptionService.sendTest();setMessage(test.ok?`${result.message} ${test.message}`:`${result.message} ${test.message}`)}else setMessage(result.message)
  if(user)void pushSubscriptionService.diagnose(user.id).then(setDiagnostics)
 }
 const remove=async()=>{setBusy(true);const ok=await pushSubscriptionService.unsubscribe();setBusy(false);if(ok){setSubscribed(false);set({device:false});setMessage('Dispositivo removido.');if(user)void pushSubscriptionService.diagnose(user.id).then(setDiagnostics)}}
 const test=async()=>{setBusy(true);const result=await pushSubscriptionService.sendTest();setBusy(false);setMessage(result.message);if(user)void pushSubscriptionService.diagnose(user.id).then(setDiagnostics)}
 return <><div className="notification-delivery device-only-settings">
  <section>
   <h3>Dispositivo atual</h3>
   <div className="device-permission"><div className={`permission-dot ${subscribed?'granted':status}`}/><MonitorSmartphone/><div><span className="label">Status da permissão</span><b>{subscribed?'Dispositivo registrado':statusText[status]}</b><small>{pushSubscriptionService.deviceLabel()}</small></div></div>
   <div className="flex flex-wrap gap-2 mt-5"><button className="btn btn-primary" onClick={activate} disabled={busy||status==='unsupported'||status==='insecure'||status==='denied'}>{busy?'Processando...':'Ativar notificações neste dispositivo'}</button><button className="btn" onClick={test} disabled={!subscribed||status!=='granted'}><BellRing/> Testar no dispositivo</button>{subscribed&&<button className="btn text-red-500" onClick={remove} disabled={busy}><Trash2/> Remover este dispositivo</button>}</div>
   {message&&<p className="text-xs muted mt-3" role="status">{message}</p>}
   <div className="push-diagnostics"><b>Diagnóstico seguro</b><span>Notifications API: {'Notification' in window?'Disponível':'Indisponível'}</span><span>Service Worker: {'serviceWorker' in navigator?'Disponível':'Indisponível'}</span><span>PushManager: {'PushManager' in window?'Disponível':'Indisponível'}</span><span>Permissão: {status}</span><span>PWA: {matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone)?'Instalada':'Navegador'}</span><span>Subscription: {diagnostics?.subscription||subscribed?'Ativa':'Ausente'}</span><span>Registro no Supabase: {diagnostics?.saved?'Ativo':'Não confirmado'}</span><span>Endpoint: {diagnostics?.endpointHost||'—'}</span><span>VAPID pública: {import.meta.env.VITE_VAPID_PUBLIC_KEY?'Carregada':'Não configurada'}</span></div>
   <p className="text-[11px] muted mt-5">No iPhone, instale a SphexPay pela Tela de Início antes de ativar. O som é controlado pelo sistema, pelo modo silencioso e pelo Foco.</p>
  </section>
  <section><h3>Eventos enviados ao dispositivo</h3><Toggle label="Notificações de vendas" checked={preferences.sales} onChange={sales=>set({sales})}/><Toggle label="Notificações de Pix" checked={preferences.pixGenerated!==false} onChange={pixGenerated=>set({pixGenerated})}/><Toggle label="Notificações de cartão" checked={preferences.cardApproved!==false} onChange={cardApproved=>set({cardApproved})}/><Toggle label="Notificações de boleto" checked={preferences.boletoEvents!==false} onChange={boletoEvents=>set({boletoEvents})}/><Toggle label="Notificações de assinaturas" checked={preferences.subscriptionEvents!==false} onChange={subscriptionEvents=>set({subscriptionEvents})}/><Toggle label="Notificações de saques" checked={preferences.withdrawalEvents!==false} onChange={withdrawalEvents=>set({withdrawalEvents})}/></section>
  <section><h3>Entrega nativa</h3><div className="generator-fixed-destination"><BellRing/><span><b>Notificação do sistema</b><small>Som controlado pelo dispositivo</small></span></div><p className="text-xs muted mt-4">Eventos comerciais não são exibidos como toast, card, banner ou item do sino dentro da SphexPay.</p></section>
 </div><NotificationGeneratorPanel/></>
}
function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(value:boolean)=>void}){return <label className="setting-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)}/><i/></label>}
