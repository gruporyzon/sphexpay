import {supabase} from '../../lib/supabase'
import type {SubscriptionDataset,SubscriptionRecord,SubscriptionStatus} from './types'

type Json=Record<string,unknown>
type TransactionRow={id:string;transaction_id:string|null;external_transaction_id:string|null;customer_name:string|null;customer_display_name:string|null;product_id:string|null;product_name:string|null;product_name_snapshot:string|null;payment_method:string|null;status:string|null;occurred_at:string;approved_at:string|null;updated_at:string|null;metadata:Json|null}

const text=(value:unknown)=>typeof value==='string'&&value.trim()?value.trim():null
const nested=(source:Json|null,path:string)=>path.split('.').reduce<unknown>((value,key)=>value&&typeof value==='object'?(value as Json)[key]:null,source)
const first=(source:Json|null,paths:string[])=>paths.map(path=>text(nested(source,path))).find(Boolean)||null
const dateValue=(value:string|null)=>value&&!Number.isNaN(Date.parse(value))?new Date(value).toISOString():null
const statusOf=(raw:string|null,transactionStatus:string|null):SubscriptionStatus=>{
 const value=(raw||transactionStatus||'').toLowerCase()
 if(['cancelled','canceled','refunded','chargeback'].some(item=>value.includes(item)))return 'cancelled'
 if(['inactive','expired','past_due','unpaid','declined'].some(item=>value.includes(item)))return 'inactive'
 return 'active'
}

function normalize(row:TransactionRow,recurringProducts:Set<string>):SubscriptionRecord|null{
 const metadata=row.metadata
 const subscriptionId=first(metadata,['subscriptionId','subscription_id','subscription.id','recurrence.id'])
 const recurring=Boolean(subscriptionId)||(row.product_id?recurringProducts.has(row.product_id):false)||/(subscription|assinatura|recurring|recorrente)/i.test(row.payment_method||'')
 if(!recurring)return null
 const rawStatus=first(metadata,['subscriptionStatus','subscription_status','subscription.status','status'])
 const createdAt=dateValue(first(metadata,['subscriptionCreatedAt','subscription_created_at','subscription.created_at'])||row.approved_at||row.occurred_at)||row.occurred_at
 const currentPeriodEnd=dateValue(first(metadata,['currentPeriodEnd','current_period_end','subscription.current_period_end','nextCharge','next_charge']))
 const cancelledAt=dateValue(first(metadata,['cancelledAt','canceledAt','cancelled_at','canceled_at','subscription.cancelled_at']))
 return {id:subscriptionId||row.external_transaction_id||row.transaction_id||row.id,customerId:first(metadata,['customerId','customer_id','customer.id']),customerName:row.customer_display_name||row.customer_name||first(metadata,['customerName','customer_name','customer.name'])||'Cliente não informado',customerEmail:first(metadata,['customerEmail','customer_email','customer.email','email']),productId:row.product_id,productName:row.product_name_snapshot||row.product_name||first(metadata,['productName','product_name','product.name'])||'Produto não informado',status:statusOf(rawStatus,row.status),createdAt,currentPeriodEnd,cancelledAt,statusChangedAt:dateValue(row.updated_at)}
}

export const subscriptionService={
 async load(merchantId:string):Promise<SubscriptionDataset>{
  if(!supabase)throw new Error('Supabase indisponível.')
  const [{data:products,error:productsError},{data:transactions,error:transactionsError}]=await Promise.all([
   supabase.from('products').select('id,name').eq('seller_id',merchantId).eq('billing_type','subscription').is('deleted_at',null).order('name').limit(200),
   supabase.from('payment_transactions').select('id,transaction_id,external_transaction_id,customer_name,customer_display_name,product_id,product_name,product_name_snapshot,payment_method,status,occurred_at,approved_at,updated_at,metadata').eq('user_id',merchantId).order('occurred_at',{ascending:false}).limit(501)
  ])
  if(productsError)throw productsError
  if(transactionsError)throw transactionsError
  const productList=(products||[]).map(item=>({id:String(item.id),name:String(item.name)})),recurringIds=new Set(productList.map(item=>item.id)),seen=new Set<string>(),items:SubscriptionRecord[]=[]
  for(const row of (transactions||[]).slice(0,500) as TransactionRow[]){const item=normalize(row,recurringIds);if(item&&!seen.has(item.id)){seen.add(item.id);items.push(item)}}
  return {items,products:productList,truncated:(transactions?.length||0)>500}
 }
}
