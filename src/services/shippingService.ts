import { supabase } from '../lib/supabase'

// Fretes do vendedor (escrita direta sob RLS) e encomendas pagas com endereço de entrega.
export type ShippingRate={id:string;name:string;carrier:string;priceCents:number;minOrderCents:number;deliveryDaysMin:number|null;deliveryDaysMax:number|null;active:boolean}
export type ShippingRateInput=Omit<ShippingRate,'id'>
export type FulfillmentStatus='pending'|'preparing'|'shipped'|'delivered'|'returned'
export type Shipment={orderId:string;buyerName:string;buyerEmail:string;productName:string;amountCents:number;shippingCents:number;currency:string;orderStatus:string;address:{recipient:string;postalCode:string;street:string;number:string;complement:string;district:string;city:string;state:string};rateName:string|null;status:FulfillmentStatus;trackingCode:string|null;shippedAt:string|null;deliveredAt:string|null;createdAt:string}
export const FULFILLMENT_LABEL:Record<FulfillmentStatus,string>={pending:'Aguardando envio',preparing:'Em preparação',shipped:'Enviado',delivered:'Entregue',returned:'Devolvido'}

const client=()=>{if(!supabase)throw new Error('A conexão com o servidor não está disponível.');return supabase}
const fromRate=(row:Record<string,unknown>):ShippingRate=>({id:String(row.id),name:String(row.name),carrier:String(row.carrier||''),priceCents:Number(row.price_cents)||0,minOrderCents:Number(row.min_order_cents)||0,deliveryDaysMin:row.delivery_days_min==null?null:Number(row.delivery_days_min),deliveryDaysMax:row.delivery_days_max==null?null:Number(row.delivery_days_max),active:Boolean(row.active)})
const toRow=(input:ShippingRateInput)=>({name:input.name.trim(),carrier:input.carrier.trim()||null,price_cents:input.priceCents,min_order_cents:input.minOrderCents,delivery_days_min:input.deliveryDaysMin,delivery_days_max:input.deliveryDaysMax,active:input.active,updated_at:new Date().toISOString()})

export const shippingService={
 async rates():Promise<ShippingRate[]>{
  const {data,error}=await client().from('shipping_rates').select('*').order('created_at',{ascending:false}).limit(100)
  if(error)throw new Error('Não foi possível carregar os fretes.')
  return((data||[]) as Record<string,unknown>[]).map(fromRate)
 },
 async saveRate(input:ShippingRateInput,id?:string){
  const db=client()
  if(id){const {error}=await db.from('shipping_rates').update(toRow(input)).eq('id',id);if(error)throw new Error('Não foi possível salvar o frete.');return}
  const {data:{user}}=await db.auth.getUser()
  if(!user)throw new Error('Sua sessão expirou. Entre novamente.')
  const {error}=await db.from('shipping_rates').insert({...toRow(input),seller_id:user.id})
  if(error)throw new Error('Não foi possível criar o frete.')
 },
 async removeRate(id:string){const {error}=await client().from('shipping_rates').delete().eq('id',id);if(error)throw new Error('Não foi possível excluir o frete.')},
 async shipments():Promise<Shipment[]>{
  const {data,error}=await client().rpc('my_shipments')
  if(error)throw new Error('Não foi possível carregar as encomendas.')
  return((data||[]) as Record<string,unknown>[]).map(row=>{const address=(row.shipping_address||{}) as Record<string,unknown>;return{orderId:String(row.order_id),buyerName:String(row.buyer_name||''),buyerEmail:String(row.buyer_email||''),productName:String(row.product_name||''),amountCents:Number(row.amount_cents)||0,shippingCents:Number(row.shipping_cents)||0,currency:String(row.currency||'BRL'),orderStatus:String(row.order_status||''),address:{recipient:String(address.recipient||''),postalCode:String(address.postalCode||''),street:String(address.street||''),number:String(address.number||''),complement:String(address.complement||''),district:String(address.district||''),city:String(address.city||''),state:String(address.state||'')},rateName:typeof row.shipping_rate_name==='string'?row.shipping_rate_name:null,status:(row.fulfillment_status||'pending') as FulfillmentStatus,trackingCode:typeof row.tracking_code==='string'?row.tracking_code:null,shippedAt:typeof row.shipped_at==='string'?row.shipped_at:null,deliveredAt:typeof row.delivered_at==='string'?row.delivered_at:null,createdAt:String(row.created_at)}})
 },
 async updateShipment(orderId:string,status:FulfillmentStatus,trackingCode:string){
  const {error}=await client().rpc('update_shipment',{p_order_id:orderId,p_status:status,p_tracking_code:trackingCode})
  if(error)throw new Error(error.message?.includes('INVALID_TRACKING')?'Código de rastreio inválido: use letras, números, espaço, ponto, barra ou hífen.':'Não foi possível atualizar a encomenda.')
 }
}
