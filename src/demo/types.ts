import type { Product } from '../types'
import type { Currency,FinancialTransaction } from '../lib/dashboardFinance'

export interface DemoTransaction extends FinancialTransaction{
 demo:true
 eventId:string
 productId:string|null
 productPriceCents:number
 grossAmountCents:number
 discountCents:number
 netAmountCents:number
 customerDisplayName:string
 customerEmail:string
 createdAt:string
 approvedAt?:string
 updatedAt:string
}

export interface DemoProduct{
 id:string
 name:string
 priceCents:number
 currency:Currency
 active:true
 fallback:boolean
}

export interface DemoNotification{
 id:string
 demo:true
 title:'Venda demonstrativa aprovada'|'Meta demonstrativa alcançada'
 description:string
 createdAt:string
 read:boolean
 transactionId?:string
}

export interface DemoSession{
 version:1
 active:boolean
 sessionId:string
 seed:number
 ownerId:string
 startedAt:string
 expiresAt:string
 lastEventAt:string
 ledger:DemoTransaction[]
 notifications:DemoNotification[]
 products:DemoProduct[]
}

export interface DemoCustomer{
 id:string
 name:string
 email:string
 purchases:number
 totalCentsByCurrency:Partial<Record<Currency,number>>
 lastOrderAt:string
 lastProduct:string
}

export const productToDemo=(product:Product&{currency?:Currency}):DemoProduct=>({
 id:product.id,
 name:product.name,
 priceCents:Math.round(product.price*100),
 currency:product.currency??'BRL',
 active:true,
 fallback:false
})
