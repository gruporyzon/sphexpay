import { competitionConfig } from '../config/competition'

export type CompetitionEvent={transactionId:string;userId:string;type:'approved'|'cancelled'|'refunded'|'chargeback';amountCents:number;occurredAt:string}
export type CompetitionStanding={userId:string;publicName:string;avatarUrl?:string|null;eligibleRevenueCents:number;eligibleSalesCount:number;targetReachedAt?:string|null;qualifyingTransactionId?:string|null;lastEligibleSaleAt?:string|null;auditStatus:'pending'|'eligible'|'ineligible'|'approved'}

export function eligibleRevenue(events:CompetitionEvent[]){
 const ordered=[...events].sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)),seen=new Set<string>(),excluded=new Set(ordered.filter(event=>event.type!=='approved').map(event=>event.transactionId))
 return ordered.reduce((total,event)=>{
  if(event.type!=='approved'||seen.has(event.transactionId)||excluded.has(event.transactionId))return total
  seen.add(event.transactionId)
  return total+Math.max(0,Math.trunc(event.amountCents))
 },0)
}

export function targetReached(events:CompetitionEvent[]){
 const ordered=[...events].filter(event=>event.type==='approved').sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)),seen=new Set<string>(),excluded=new Set(events.filter(event=>event.type!=='approved').map(event=>event.transactionId))
 let total=0
 for(const event of ordered){
  if(seen.has(event.transactionId)||excluded.has(event.transactionId))continue
  seen.add(event.transactionId);total+=Math.max(0,Math.trunc(event.amountCents))
  if(total>=competitionConfig.targetCents)return{targetReachedAt:event.occurredAt,qualifyingTransactionId:event.transactionId}
 }
 return{targetReachedAt:null,qualifyingTransactionId:null}
}

export function sortStandings(rows:CompetitionStanding[]){
 return[...rows].sort((a,b)=>b.eligibleRevenueCents-a.eligibleRevenueCents
  ||String(a.targetReachedAt||'9999').localeCompare(String(b.targetReachedAt||'9999'))
  ||String(a.lastEligibleSaleAt||'9999').localeCompare(String(b.lastEligibleSaleAt||'9999'))
  ||a.userId.localeCompare(b.userId))
}

export const maskPublicName=(value:string)=>{
 const clean=value.trim()
 if(!clean)return'Participante'
 const parts=clean.split(/\s+/)
 return parts.length===1?`${parts[0].slice(0,2)}***`:`${parts[0]} ${parts.at(-1)?.slice(0,1)}.`
}
