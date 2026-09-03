import Stripe from 'stripe'

let stripeClient

export function getStripe(){
 const key=typeof process.env.STRIPE_SECRET_KEY==='string'?process.env.STRIPE_SECRET_KEY.trim():''
 if(!key)throw Object.assign(new Error('Stripe não configurada.'),{code:'STRIPE_NOT_CONFIGURED'})
 if(!stripeClient)stripeClient=new Stripe(key,{appInfo:{name:'SphexPay',version:'1.0.0'}})
 return stripeClient
}

export function resetStripeClient(){stripeClient=undefined}
