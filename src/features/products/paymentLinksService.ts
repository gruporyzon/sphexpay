import { supabase } from '../../lib/supabase'
import { activeSeller } from '../../store/useWorkspaceStore'

// Links de pagamento reais: cada checkout publicado tem um endereço público /pay/{id} que cobra
// pela Stripe. Visitas e vendas vêm do banco (seller_payment_links, na conta ativa), nunca de
// valores locais.
export type PaymentLink={checkoutId:string;checkoutName:string;status:string;isPublished:boolean;productId:string;productName:string;offerName:string|null;priceCents:number|null;currency:string;billingType:string|null;views:number;started:number;paidCount:number;paidCents:number}

export const paymentLinkUrl=(checkoutId:string)=>`${window.location.origin}/pay/${checkoutId}`

export async function listPaymentLinks():Promise<PaymentLink[]>{
 if(!supabase)throw new Error('SUPABASE_UNAVAILABLE')
 const {data,error}=await supabase.rpc('seller_payment_links',{p_seller:activeSeller()})
 if(error)throw error
 return ((data||[]) as Record<string,unknown>[]).map(row=>({
  checkoutId:String(row.checkout_id),checkoutName:String(row.checkout_name||''),status:String(row.status||'draft'),isPublished:row.is_published===true,
  productId:String(row.product_id),productName:String(row.product_name||''),offerName:row.offer_name?String(row.offer_name):null,
  priceCents:row.price_cents==null?null:Number(row.price_cents),currency:String(row.currency||'BRL'),billingType:row.billing_type?String(row.billing_type):null,
  views:Number(row.views||0),started:Number(row.started||0),paidCount:Number(row.paid_count||0),paidCents:Number(row.paid_cents||0)
 }))
}
