export type SubscriptionStatus='active'|'past_due'|'cancelled'|'inactive'

export interface SubscriptionRecord{
 id:string
 customerId:string|null
 customerName:string
 customerEmail:string|null
 productId:string|null
 productName:string
 status:SubscriptionStatus
 createdAt:string
 currentPeriodEnd:string|null
 cancelledAt:string|null
 statusChangedAt:string|null
 amountCents?:number
 currency?:string
 billingInterval?:string|null
 cycles?:number
}

export interface SubscriptionProduct{id:string;name:string}
export interface SubscriptionDataset{items:SubscriptionRecord[];products:SubscriptionProduct[];truncated:boolean}
