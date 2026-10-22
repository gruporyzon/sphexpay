import { supabase } from '../lib/supabase'

// Central de cupons: todos os cupons do vendedor (RLS) com o produto de cada um.
export type CouponSummary={id:string;code:string;productId:string;productName:string;discountType:'percentage'|'fixed';discountValue:number;usesCount:number;totalLimit:number|null;startsAt:string|null;expiresAt:string|null;status:'active'|'paused'|'archived'}

const client=()=>{if(!supabase)throw new Error('A conexão com o servidor não está disponível.');return supabase}
export const couponCenterService={
 async list():Promise<CouponSummary[]>{
  const {data,error}=await client().from('product_coupons').select('id,code,product_id,discount_type,discount_value,uses_count,total_limit,starts_at,expires_at,status,products(name)').is('deleted_at',null).order('created_at',{ascending:false}).limit(500)
  if(error)throw new Error('Não foi possível carregar os cupons.')
  return((data||[]) as Record<string,unknown>[]).map(row=>({id:String(row.id),code:String(row.code),productId:String(row.product_id),productName:String((row.products as {name?:string}|null)?.name||'Produto'),discountType:row.discount_type==='fixed'?'fixed':'percentage',discountValue:Number(row.discount_value)||0,usesCount:Number(row.uses_count)||0,totalLimit:row.total_limit==null?null:Number(row.total_limit),startsAt:typeof row.starts_at==='string'?row.starts_at:null,expiresAt:typeof row.expires_at==='string'?row.expires_at:null,status:(row.status||'active') as CouponSummary['status']}))
 },
 async setStatus(id:string,status:'active'|'paused'){
  const {error}=await client().from('product_coupons').update({status,updated_at:new Date().toISOString()}).eq('id',id)
  if(error)throw new Error('Não foi possível atualizar o cupom.')
 }
}
