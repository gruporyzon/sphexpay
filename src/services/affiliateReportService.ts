import { supabase } from '../lib/supabase'
import { activeSeller } from '../store/useWorkspaceStore'

// Vendas atribuídas a afiliados (link ?ref=) e controle de comissão paga pelo vendedor.
export type AffiliateSale={orderId:string;affiliateId:string;affiliateName:string;affiliatePublicId:string;buyerName:string;productName:string;paymentMethod:string;status:string;amountCents:number;currency:string;commissionCents:number;commissionPaidAt:string|null;occurredAt:string}

export const affiliateReportService={
 async sales(start:Date,end:Date):Promise<AffiliateSale[]>{
  if(!supabase)throw new Error('A conexão com o servidor não está disponível.')
  const {data,error}=await supabase.rpc('seller_affiliate_sales',{p_seller:activeSeller(),p_start:start.toISOString(),p_end:end.toISOString()})
  if(error)throw new Error('Não foi possível carregar as vendas dos afiliados.')
  return((data||[]) as Record<string,unknown>[]).map(row=>({orderId:String(row.order_id),affiliateId:String(row.affiliate_id),affiliateName:String(row.affiliate_name||''),affiliatePublicId:String(row.affiliate_public_id||''),buyerName:String(row.buyer_name||''),productName:String(row.product_name||''),paymentMethod:String(row.payment_method||''),status:String(row.status||''),amountCents:Number(row.amount_cents)||0,currency:String(row.currency||'BRL'),commissionCents:Number(row.commission_cents)||0,commissionPaidAt:typeof row.commission_paid_at==='string'?row.commission_paid_at:null,occurredAt:String(row.occurred_at)}))
 },
 async setPaid(orderIds:string[],paid:boolean){
  if(!supabase)throw new Error('A conexão com o servidor não está disponível.')
  const {error}=await supabase.rpc('set_affiliate_commission_paid',{p_order_ids:orderIds,p_paid:paid})
  if(error)throw new Error('Não foi possível atualizar o pagamento da comissão.')
 }
}
