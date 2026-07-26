import type { RealtimeChannel } from '@supabase/supabase-js'
import { competitionConfig } from '../config/competition'
import { supabase } from '../lib/supabase'
import type { CompetitionStanding } from './competitionEngine'

export type CompetitionSnapshot={standings:CompetitionStanding[];updatedAt:string;source:'supabase'|'unavailable'}

export const competitionService={
 async load():Promise<CompetitionSnapshot>{
  if(!supabase)return{standings:[],updatedAt:new Date().toISOString(),source:'unavailable'}
  const {data,error}=await supabase.rpc('get_competition_leaderboard',{p_competition_slug:competitionConfig.slug})
  if(error)throw new Error('COMPETITION_UNAVAILABLE')
  return{standings:(data||[]).map((row:Record<string,unknown>)=>({
   userId:String(row.user_id),publicName:String(row.public_name||'Participante'),avatarUrl:typeof row.avatar_url==='string'?row.avatar_url:null,
   eligibleRevenueCents:Number(row.eligible_revenue_cents||0),eligibleSalesCount:Number(row.eligible_sales_count||0),
   targetReachedAt:typeof row.target_reached_at==='string'?row.target_reached_at:null,qualifyingTransactionId:null,
   lastEligibleSaleAt:typeof row.last_eligible_sale_at==='string'?row.last_eligible_sale_at:null,
   auditStatus:(row.audit_status||'pending') as CompetitionStanding['auditStatus']
  })),updatedAt:new Date().toISOString(),source:'supabase'}
 },
 subscribe(onChange:()=>void):RealtimeChannel|null{
  if(!supabase)return null
  return supabase.channel(`competition:${competitionConfig.id}`)
   .on('postgres_changes',{event:'*',schema:'public',table:'competition_participants'},onChange)
   .subscribe()
 },
 disconnect(channel:RealtimeChannel|null){if(channel&&supabase)void supabase.removeChannel(channel)}
}
