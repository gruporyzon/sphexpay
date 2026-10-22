import {supabase} from '../lib/supabase'

export type StripeOnboardingStatus='not_connected'|'pending'|'in_review'|'requirements_due'|'enabled'
export type StripeConnectStatus={mode:'test'|'live';onboardingComplete:boolean;connected:boolean;accountId?:string;detailsSubmitted:boolean;chargesEnabled:boolean;payoutsEnabled:boolean;onboardingStatus:StripeOnboardingStatus;requirements:{currentlyDue:string[];eventuallyDue:string[]}}

export type StripeAmount={amountCents:number;currency:string}
export type StripePayoutStatus='paid'|'pending'|'in_transit'|'canceled'|'failed'
export type StripePayout={id:string;amountCents:number;currency:string;status:StripePayoutStatus;automatic:boolean;createdAt:string|null;arrivalDate:string|null;failureMessage:string|null;destination:{bankName:string|null;last4:string|null}|null}
export type StripePayoutSchedule={interval:'manual'|'daily'|'weekly'|'monthly'|null;delayDays:number|null;weeklyAnchor:string|null;monthlyAnchor:number|null}
export type StripeConnectFinance={mode:'test'|'live';connected:boolean;payoutsEnabled:boolean;balance:{available:StripeAmount[];pending:StripeAmount[]};schedule:StripePayoutSchedule|null;payouts:StripePayout[]}
export type StripeDisputeStatus='warning_needs_response'|'warning_under_review'|'warning_closed'|'needs_response'|'under_review'|'won'|'lost'|'prevented'
export type StripeDispute={id:string;amountCents:number;currency:string;status:StripeDisputeStatus;reason:string;method:'card'|'pix';createdAt:string|null;dueBy:string|null;transactionId:string|null;productName:string|null;customerName:string|null}
export type StripeRefundResult={refundId:string;status:string;amountCents:number;currency:string}

const authenticatedFetch=async(path:string,init?:RequestInit)=>{
 if(!supabase)throw new Error('A autenticação não está disponível neste ambiente.')
 const {data:{session}}=await supabase.auth.getSession()
 if(!session?.access_token)throw new Error('Sua sessão expirou. Entre novamente.')
 const response=await fetch(path,{...init,headers:{Accept:'application/json',Authorization:`Bearer ${session.access_token}`,...init?.headers}})
 const body=await response.json().catch(()=>({})) as {message?:string}
 if(!response.ok)throw new Error(body.message||'Não foi possível acessar a configuração de pagamentos.')
 return body
}

export const stripeConnectService={
 configureProductPayments:(productId:string,enabled:boolean,method:'card'|'pix'|'boleto'='card')=>authenticatedFetch('/api/stripe/connect/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId,enabled,method})}) as Promise<{enabled:boolean;method:string;methods:string[]}>,
 status:()=>authenticatedFetch('/api/stripe/connect/status') as Promise<StripeConnectStatus>,
 finance:()=>authenticatedFetch('/api/stripe/connect/status?view=finance') as Promise<StripeConnectFinance>,
 disputes:()=>authenticatedFetch('/api/stripe/connect/status?view=disputes') as Promise<{mode:'test'|'live';disputes:StripeDispute[]}>,
 refund:(transactionId:string)=>authenticatedFetch('/api/stripe/connect/status?action=refund',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transactionId})}) as Promise<StripeRefundResult>,
 createAccount:()=>authenticatedFetch('/api/stripe/connect/account',{method:'POST'}) as Promise<StripeConnectStatus>,
 onboarding:()=>authenticatedFetch('/api/stripe/connect/onboarding',{method:'POST'}) as Promise<{url:string}>
}
