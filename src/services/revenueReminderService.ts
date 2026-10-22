import { supabase } from '../lib/supabase'
import { REMINDER_HOURS,type ReminderStyle } from '../../server/notifications/revenueMessages.js'

// Preferências dos lembretes de faturamento da própria conta (RLS: só a própria linha).
// Sem linha salva vale o padrão: ligado, estilo misto e todos os horários.
export type RevenueReminderSettings={enabled:boolean;style:ReminderStyle;hours:number[]}
export const DEFAULT_REMINDER_SETTINGS:RevenueReminderSettings={enabled:true,style:'mixed',hours:[...REMINDER_HOURS]}

const client=()=>{if(!supabase)throw new Error('A conexão com o servidor não está disponível.');return supabase}
const userId=async()=>{const id=(await client().auth.getSession()).data.session?.user.id;if(!id)throw new Error('Sua sessão expirou. Entre novamente.');return id}

export const revenueReminderService={
 async get():Promise<RevenueReminderSettings>{
  const id=await userId()
  const {data,error}=await client().from('revenue_reminder_settings').select('enabled,style,hours').eq('user_id',id).maybeSingle()
  if(error)throw new Error('Não foi possível carregar os lembretes.')
  if(!data)return DEFAULT_REMINDER_SETTINGS
  return{enabled:Boolean(data.enabled),style:(['mixed','professional','humor'].includes(String(data.style))?data.style:'mixed') as ReminderStyle,hours:(Array.isArray(data.hours)?data.hours:[]).map(Number).sort((a,b)=>a-b)}
 },
 async save(settings:RevenueReminderSettings){
  const id=await userId(),hours=[...new Set(settings.hours)].filter(hour=>(REMINDER_HOURS as readonly number[]).includes(hour)).sort((a,b)=>a-b)
  const {error}=await client().from('revenue_reminder_settings').upsert({user_id:id,enabled:settings.enabled,style:settings.style,hours,updated_at:new Date().toISOString()},{onConflict:'user_id'})
  if(error)throw new Error('Não foi possível salvar os lembretes.')
 }
}
