import { supabase } from '../lib/supabase'

// Indicação de vendedores: 10% da taxa SphexPay das vendas aprovadas do indicado por 12 meses.
export const REFERRAL_STORAGE='sphex-referral-code'
export const REFERRAL_CODE=/^SPX-[A-Z0-9]{8}$/
export type ReferralSale={referredId:string;referredName:string;referredSince:string;occurredAt:string;amountCents:number;feeCents:number;commissionCents:number;currency:string}
export type ReferralSummary={referred:number;active:number;paidCents:number;payouts:{month:string;amountCents:number;paidAt:string}[]}
export type AdminReferralRow={referrerId:string;referrerName:string;referrerEmail:string;sales:number;commissionCents:number;paidCents:number|null;paidAt:string|null}

const client=()=>{if(!supabase)throw new Error('A conexão com o servidor não está disponível.');return supabase}
// Guarda o código do link de cadastro (/criar-conta?indicacao=SPX-...) até a conta existir.
export function rememberReferral(search:string){
 const code=new URLSearchParams(search).get('indicacao')?.trim().toUpperCase()
 if(!code||!REFERRAL_CODE.test(code))return
 try{localStorage.setItem(REFERRAL_STORAGE,code)}catch{/* Sem armazenamento: o vínculo não acontece. */}
}
export const referralService={
 async code():Promise<string>{const {data,error}=await client().rpc('my_referral_code');if(error||typeof data!=='string')throw new Error('Não foi possível gerar seu link de indicação.');return data},
 async claimPending(){
  let code:string|null=null
  try{code=localStorage.getItem(REFERRAL_STORAGE)}catch{return false}
  if(!code||!REFERRAL_CODE.test(code))return false
  const {data,error}=await client().rpc('claim_referral',{p_code:code})
  if(error)return false
  try{localStorage.removeItem(REFERRAL_STORAGE)}catch{/* já tentado */}
  return data===true
 },
 async sales(start:Date,end:Date):Promise<ReferralSale[]>{
  const {data,error}=await client().rpc('my_referral_sales',{p_start:start.toISOString(),p_end:end.toISOString()})
  if(error)throw new Error('Não foi possível carregar suas indicações.')
  return((data||[]) as Record<string,unknown>[]).map(row=>({referredId:String(row.referred_id),referredName:String(row.referred_name||'Vendedor'),referredSince:String(row.referred_since),occurredAt:String(row.occurred_at),amountCents:Number(row.amount_cents)||0,feeCents:Number(row.fee_cents)||0,commissionCents:Number(row.commission_cents)||0,currency:String(row.currency||'BRL')}))
 },
 async summary():Promise<ReferralSummary>{
  const {data,error}=await client().rpc('my_referral_summary')
  if(error||!data)throw new Error('Não foi possível carregar suas indicações.')
  const value=data as {referred:number;active:number;paid_cents:number;payouts:{month:string;amount_cents:number;paid_at:string}[]}
  return{referred:Number(value.referred)||0,active:Number(value.active)||0,paidCents:Number(value.paid_cents)||0,payouts:(value.payouts||[]).map(item=>({month:item.month,amountCents:Number(item.amount_cents)||0,paidAt:item.paid_at}))}
 },
 async adminMonth(month:string):Promise<AdminReferralRow[]>{
  const {data,error}=await client().rpc('admin_referral_month',{p_month:month})
  if(error)throw new Error('Não foi possível carregar as comissões de indicação.')
  return((data||[]) as Record<string,unknown>[]).map(row=>({referrerId:String(row.referrer_id),referrerName:String(row.referrer_name||''),referrerEmail:String(row.referrer_email||''),sales:Number(row.sales)||0,commissionCents:Number(row.commission_cents)||0,paidCents:row.paid_cents==null?null:Number(row.paid_cents),paidAt:typeof row.paid_at==='string'?row.paid_at:null}))
 },
 async adminMarkPaid(referrerId:string,month:string,amountCents:number){
  const {error}=await client().rpc('admin_mark_referral_paid',{p_referrer:referrerId,p_month:month,p_amount_cents:amountCents})
  if(error)throw new Error('Não foi possível registrar o pagamento.')
 }
}
