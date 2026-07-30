import type { Product } from '../types'
import type { Currency,FinancialTransaction } from '../lib/dashboardFinance'

export interface DemoTransaction extends FinancialTransaction{
 demo:true
 source:'mode'
 eventId:string
 productId:string|null
 productPriceCents:number
 grossAmountCents:number
 discountCents:number
 netAmountCents:number
 customerDisplayName:string
 customerEmail:string
 customerId:string
 countryCode:string
 countryName:string
 cityName:string
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
 title:string
 description:string
 createdAt:string
 read:boolean
 transactionId?:string
}

export type DemoPreset='light'|'normal'|'high'|'launch'|'peak'|'subscriptions'|'international'|'custom'
export type DemoFrequencyUnit='seconds'|'minutes'
export type DemoPaymentMethod='Pix'|'Cartão de crédito'|'Boleto'|'Assinatura'
export type ModePushFrequency='each'|'5s'|'15s'|'60s'|'summary'
export type ModePushDestination='current'|'all'|'selected'
export interface ModePushConfig{
 enabled:boolean
 approved:boolean
 methods:DemoPaymentMethod[]
 destination:ModePushDestination
 deviceIds:string[]
 vary:boolean
 frequency:ModePushFrequency
 maxPerSession:number
 enabledAt:string
}
export interface ModePushStats{
 attempted:number
 sent:number
 failed:number
 expired:number
 skipped:number
 lastSentAt:string
 lastError:string
}
export type DemoCountryCode='BR'|'US'|'CA'|'PT'|'GB'|'FR'|'DE'|'ES'|'IT'|'NL'|'IE'|'CH'
export interface DemoWeightedOption<T extends string>{id:T;enabled:boolean;weight:number}
export interface DemoConfig{
 preset:DemoPreset
 initialSales:number
 minFrequency:number
 maxFrequency:number
 frequencyUnit:DemoFrequencyUnit
 minAmountCents:number
 maxAmountCents:number
 targetTicketCents:number
 memoryLimit:number
 peakStartHour:number
 peakEndHour:number
 peakMultiplier:number
 peakDurationMinutes:number
 graphSpeed:number
 awardMultiplier:number
 approvalRate:number
 declinedRate:number
 pendingRate:number
 refundRate:number
 chargebackRate:number
 methods:DemoWeightedOption<DemoPaymentMethod>[]
 currencies:DemoWeightedOption<Currency>[]
 countries:DemoWeightedOption<DemoCountryCode>[]
 useProductPrices:boolean
 adaptive:boolean
 sessionGoalCents:number
 pushNotifications:ModePushConfig
}

export interface DemoSession{
 version:2
 active:boolean
 paused:boolean
 sessionId:string
 seed:number
 ownerId:string
 startedAt:string
 expiresAt:string
 lastEventAt:string
 ledger:DemoTransaction[]
 notifications:DemoNotification[]
 products:DemoProduct[]
 config:DemoConfig
 eventCount:number
 approvedCount:number
 sessionVolumeCents:number
 intensity:number
 exchangeRates:Record<Currency,number>
}

export interface DemoCustomer{
 id:string
 name:string
 email:string
 purchases:number
 totalCentsByCurrency:Partial<Record<Currency,number>>
 lastOrderAt:string
 lastProduct:string
 countryName:string
 cityName:string
}

export const productToDemo=(product:Product&{currency?:Currency}):DemoProduct=>({
 id:product.id,
 name:product.name,
 priceCents:Math.round(product.price*100),
 currency:product.currency??'BRL',
 active:true,
 fallback:false
})
