import {supabase} from '../lib/supabase'

export type StripeOnboardingStatus='not_connected'|'pending'|'in_review'|'requirements_due'|'enabled'
export type StripeConnectStatus={connected:boolean;accountId?:string;detailsSubmitted:boolean;chargesEnabled:boolean;payoutsEnabled:boolean;onboardingStatus:StripeOnboardingStatus;requirements:{currentlyDue:string[];eventuallyDue:string[]}}

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
 status:()=>authenticatedFetch('/api/stripe/connect/status') as Promise<StripeConnectStatus>,
 createAccount:()=>authenticatedFetch('/api/stripe/connect/account',{method:'POST'}) as Promise<StripeConnectStatus>,
 onboarding:()=>authenticatedFetch('/api/stripe/connect/onboarding',{method:'POST'}) as Promise<{url:string}>
}
