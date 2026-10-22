import { supabase } from '../lib/supabase'

// Compradores reais (nome e e-mail informados no checkout) e carrinhos abandonados,
// lidos por RPCs que só devolvem os dados do próprio vendedor e só de vendas em produção.
export type RealCustomer={email:string;name:string;purchases:number;spentCents:number;refunded:number;otherCurrency:boolean;firstPurchaseAt:string;lastPurchaseAt:string}
export type AbandonedCheckout={id:string;buyerName:string;buyerEmail:string;productId:string;productName:string;amountCents:number;currency:string;billingType:'one_time'|'subscription';status:'pending'|'declined';createdAt:string}

export const customerService={
 async customers():Promise<RealCustomer[]>{
  if(!supabase)throw new Error('A conexão com o servidor não está disponível.')
  const {data,error}=await supabase.rpc('my_customers')
  if(error)throw new Error('Não foi possível carregar seus clientes.')
  return((data||[]) as Record<string,unknown>[]).map(row=>({email:String(row.email),name:String(row.name||''),purchases:Number(row.purchases)||0,spentCents:Number(row.spent_cents)||0,refunded:Number(row.refunded)||0,otherCurrency:Boolean(row.other_currency),firstPurchaseAt:String(row.first_purchase_at),lastPurchaseAt:String(row.last_purchase_at)}))
 },
 async abandoned():Promise<AbandonedCheckout[]>{
  if(!supabase)throw new Error('A conexão com o servidor não está disponível.')
  const {data,error}=await supabase.rpc('my_abandoned_checkouts')
  if(error)throw new Error('Não foi possível carregar os carrinhos abandonados.')
  return((data||[]) as Record<string,unknown>[]).map(row=>({id:String(row.id),buyerName:String(row.buyer_name||''),buyerEmail:String(row.buyer_email||''),productId:String(row.product_id),productName:String(row.product_name||''),amountCents:Number(row.amount_cents)||0,currency:String(row.currency||'BRL'),billingType:row.billing_type==='subscription'?'subscription':'one_time',status:row.status==='declined'?'declined':'pending',createdAt:String(row.created_at)}))
 }
}
