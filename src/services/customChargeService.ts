import { supabase } from '../lib/supabase'
import type { CustomCharge } from './stripeConnectService'

// Leitura das cobranças do próprio vendedor (RLS). Criar e cancelar passa pelo servidor.
export const customChargeService={
 async list():Promise<CustomCharge[]>{
  if(!supabase)throw new Error('A conexão com o servidor não está disponível.')
  const {data,error}=await supabase.from('custom_charges').select('id,customer_name,customer_email,description,amount_cents,currency,methods,status,due_date,hosted_url,created_at,paid_at,stripe_mode').order('created_at',{ascending:false}).limit(200)
  if(error)throw new Error('Não foi possível carregar suas cobranças.')
  return((data||[]) as Record<string,unknown>[]).map(row=>({id:String(row.id),customerName:String(row.customer_name),customerEmail:String(row.customer_email),description:String(row.description),amountCents:Number(row.amount_cents)||0,currency:String(row.currency||'BRL'),methods:(row.methods||[]) as CustomCharge['methods'],status:row.status as CustomCharge['status'],dueDate:String(row.due_date),hostedUrl:typeof row.hosted_url==='string'?row.hosted_url:null,createdAt:String(row.created_at),paidAt:typeof row.paid_at==='string'?row.paid_at:null,mode:row.stripe_mode==='live'?'live':'test'}))
 }
}
