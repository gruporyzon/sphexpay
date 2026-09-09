import Stripe from 'stripe'

let stripeClient,clientKey

export function getStripeMode(){
 const key=process.env.STRIPE_SECRET_KEY?.trim()||''
 const match=/^sk_(test|live)_.+$/.exec(key)
 if(!match)throw Object.assign(new Error('Chave secreta Stripe ausente ou inválida.'),{code:'STRIPE_NOT_CONFIGURED'})
 return match[1]
}

export function getStripe(){
 getStripeMode()
 const key=typeof process.env.STRIPE_SECRET_KEY==='string'?process.env.STRIPE_SECRET_KEY.trim():''
 if(!key)throw Object.assign(new Error('Stripe não configurada.'),{code:'STRIPE_NOT_CONFIGURED'})
 if(!stripeClient||clientKey!==key){clientKey=key;stripeClient=new Stripe(key,{timeout:5000,maxNetworkRetries:0,appInfo:{name:'SphexPay',version:'1.0.0'}})}
 return stripeClient
}

export function resetStripeClient(){stripeClient=undefined;clientKey=undefined}
