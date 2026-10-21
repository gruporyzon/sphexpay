import { supabase } from '../lib/supabase'
import type { ShippingAddress } from '../types'

// Jornada de premiações a partir do faturamento real (vendas aprovadas em reais) e
// pedidos de plaquinha gravados no banco pela RPC request_award.
export type AwardRequestState='requested'|'preparing'|'shipped'|'delivered'|'cancelled'
export type StoredAwardRequest={id:string;awardId:string;status:AwardRequestState;address:ShippingAddress;trackingCode:string|null;requestedAt:string;updatedAt:string}
export type AwardJourney={revenueCents:number;requests:StoredAwardRequest[]}

export const AWARD_STATUS_LABEL:Record<AwardRequestState,string>={requested:'Solicitação recebida',preparing:'Em preparação',shipped:'Enviada',delivered:'Entregue',cancelled:'Cancelada'}

const ERRORS:Record<string,string>={
 AWARD_NOT_UNLOCKED:'Esta premiação ainda não foi liberada pelo seu faturamento.',
 AWARD_ALREADY_IN_PROGRESS:'Este pedido já está em preparação e não pode mais ser alterado. Fale com o suporte.',
 INVALID_ADDRESS:'Revise o endereço de entrega: há campos obrigatórios vazios ou longos demais.'
}

const fromRow=(row:Record<string,unknown>):StoredAwardRequest=>({
 id:String(row.id),awardId:String(row.award_id),status:row.status as AwardRequestState,address:row.address as ShippingAddress,
 trackingCode:typeof row.tracking_code==='string'?row.tracking_code:null,requestedAt:String(row.requested_at),updatedAt:String(row.updated_at)
})

export const awardService={
 async journey():Promise<AwardJourney>{
  if(!supabase)throw new Error('A conexão com o servidor não está disponível.')
  const {data,error}=await supabase.rpc('my_award_journey')
  if(error||!data)throw new Error('Não foi possível carregar sua jornada de premiações.')
  const value=data as {revenue_cents:number;requests:Record<string,unknown>[]}
  return{revenueCents:Number(value.revenue_cents)||0,requests:(value.requests||[]).map(fromRow)}
 },
 async request(awardId:string,address:ShippingAddress):Promise<StoredAwardRequest>{
  if(!supabase)throw new Error('A conexão com o servidor não está disponível.')
  const {data,error}=await supabase.rpc('request_award',{p_award_id:awardId,p_address:address})
  if(error||!data){const code=Object.keys(ERRORS).find(key=>error?.message?.includes(key));throw new Error(code?ERRORS[code]:'Não foi possível registrar o pedido agora. Tente novamente.')}
  // Aviso à equipe de envio: best-effort, o pedido já está salvo.
  try{await supabase.functions.invoke('team-notify',{body:{event:'award_requested',award_id:awardId}})}catch{/* best-effort */}
  return fromRow(data as Record<string,unknown>)
 }
}
