import { useEffect,useMemo,useState } from 'react'
import { AlarmClock,Check,Save } from 'lucide-react'
import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { Loading,StateMessage } from '../ui'
import { useAuth } from '../../hooks/useAuth'
import { REMINDER_HOURS,STYLE_LABEL,buildRevenueReminder,type ReminderStyle } from '../../../server/notifications/revenueMessages.js'
import { DEFAULT_REMINDER_SETTINGS,revenueReminderService,type RevenueReminderSettings as Settings } from '../../services/revenueReminderService'

const STYLES:ReminderStyle[]=['mixed','professional','humor']
const STYLE_HINT:Record<ReminderStyle,string>={mixed:'Alterna entre mensagens profissionais e de humor.',professional:'Resumo direto do faturamento.',humor:'Mensagens divertidas com o valor real.'}
const hourLabel=(hour:number)=>`${String(hour).padStart(2,'0')}h`

// Lembretes de faturamento no celular e no computador: horários de Brasília, valores reais
// das vendas aprovadas. A prévia usa um valor de exemplo, marcado como exemplo.
export function RevenueReminderSettings(){useAppLocale(state=>state.locale)
 const firstName=String(useAuth().user?.user_metadata?.full_name||'').split(' ')[0]
 const [settings,setSettings]=useState<Settings|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[previewHour,setPreviewHour]=useState(12)
 useEffect(()=>{let active=true;revenueReminderService.get().then(value=>{if(active)setSettings(value)}).catch(reason=>{if(active){setSettings(DEFAULT_REMINDER_SETTINGS);setError(reason instanceof Error?reason.message:'Não foi possível carregar os lembretes.')}});return()=>{active=false}},[])
 const previews=useMemo(()=>settings?[0,1].map(seed=>buildRevenueReminder({hour:previewHour,revenueCents:previewHour===8?18900:128700,sales:previewHour===8?1:6,style:settings.style,firstName,seed})):[],[settings,previewHour,firstName])
 if(!settings)return <Loading label="Carregando lembretes"/>
 const update=(patch:Partial<Settings>)=>{setSaved(false);setSettings({...settings,...patch})}
 const toggleHour=(hour:number)=>update({hours:settings.hours.includes(hour)?settings.hours.filter(item=>item!==hour):[...settings.hours,hour].sort((a,b)=>a-b)})
 const save=async()=>{setBusy(true);setError('');try{await revenueReminderService.save(settings);setSaved(true)}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível salvar.')}finally{setBusy(false)}}
 return <section className="revenue-reminders" aria-labelledby="revenue-reminders-title">
  <header className="revenue-reminders-head"><AlarmClock aria-hidden="true"/><div><h3 id="revenue-reminders-title"><T>Lembretes de faturamento</T></h3><p><T>Receba no celular e no computador quanto você já faturou no dia, nos horários que escolher (horário de Brasília). À meia-noite chega o fechamento do dia anterior.</T></p></div>
   <label className="revenue-reminders-switch"><input type="checkbox" checked={settings.enabled} onChange={event=>update({enabled:event.target.checked})}/><span><T>{settings.enabled?'Ligado':'Desligado'}</T></span></label></header>
  <fieldset className="revenue-reminders-group" disabled={!settings.enabled}><legend><T>Estilo das mensagens</T></legend>
   <div className="revenue-reminders-options">{STYLES.map(style=><label key={style} className={settings.style===style?'active':''}><input type="radio" name="reminder-style" checked={settings.style===style} onChange={()=>update({style})}/><b><T>{STYLE_LABEL[style]}</T></b><small><T>{STYLE_HINT[style]}</T></small></label>)}</div></fieldset>
  <fieldset className="revenue-reminders-group" disabled={!settings.enabled}><legend><T>Horários</T></legend>
   <div className="revenue-reminders-hours">{REMINDER_HOURS.map(hour=><label key={hour} className={settings.hours.includes(hour)?'active':''}><input type="checkbox" checked={settings.hours.includes(hour)} onChange={()=>toggleHour(hour)}/>{hourLabel(hour)}</label>)}</div></fieldset>
  <div className="revenue-reminders-preview"><div className="revenue-reminders-preview-head"><span><T>Prévia com valores de exemplo</T></span>
   <label className="sr-only" htmlFor="reminder-preview-hour"><T>Horário da prévia</T></label><select id="reminder-preview-hour" className="input" value={previewHour} onChange={event=>setPreviewHour(Number(event.target.value))}>{REMINDER_HOURS.map(hour=><option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select></div>
   {previews.map((message,index)=><article key={index} className="revenue-reminders-card"><b>{message.title}</b><p>{message.body}</p></article>)}</div>
  {error&&<StateMessage title={uiText('Atenção')}><span>{error}</span></StateMessage>}
  <div className="revenue-reminders-actions"><button className="btn btn-primary" disabled={busy||settings.enabled&&!settings.hours.length} onClick={()=>void save()}><Save size={15}/><T>{busy?' Salvando...':' Salvar lembretes'}</T></button>{saved&&<span className="revenue-reminders-saved"><Check size={14}/><T>Lembretes salvos</T></span>}</div>
 </section>
}
