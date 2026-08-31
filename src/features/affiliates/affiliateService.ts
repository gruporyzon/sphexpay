import {supabase} from '../../lib/supabase'
import type {Affiliate,AffiliateFilters,AffiliatePage,AffiliateProduct,AffiliateProductOption,AffiliateStatus} from './types'

const fields='id,public_id,name,email,status,joined_at'
const client=()=>{if(!supabase)throw new Error('SUPABASE_UNAVAILABLE');return supabase}
const currentMerchant=async()=>{const {data,error}=await client().auth.getUser();if(error||!data.user)throw error||new Error('AUTH_REQUIRED');return data.user.id}
const safeTerm=(value:string)=>value.trim().replace(/[^\p{L}\p{N}@.\- ]/gu,' ')
const fromProduct=(row:Record<string,unknown>):AffiliateProduct=>{const product=row.products as Record<string,unknown>|null;return{id:String(row.id),productId:String(row.product_id),productName:String(product?.name||'Produto indisponível'),commissionType:row.commission_type as AffiliateProduct['commissionType'],commissionValue:Number(row.commission_value),currency:(row.currency||'BRL') as AffiliateProduct['currency']}}
const fromRow=(row:Record<string,unknown>,products:AffiliateProduct[]):Affiliate=>({id:String(row.id),publicId:String(row.public_id),name:String(row.name||row.email||row.public_id),email:row.email?String(row.email):null,status:row.status as AffiliateStatus,joinedAt:String(row.joined_at),products})

async function matchingAffiliateIds(merchantId:string,filters:AffiliateFilters){
 const ids=new Set<string>(),term=safeTerm(filters.query)
 if(term){
  const {data:products,error:productError}=await client().from('products').select('id').eq('seller_id',merchantId).ilike('name',`%${term}%`).is('deleted_at',null).limit(100)
  if(productError)throw productError
  if(products?.length){const {data,error}=await client().from('affiliate_products').select('affiliate_id').eq('merchant_id',merchantId).in('product_id',products.map(row=>row.id));if(error)throw error;(data||[]).forEach(row=>ids.add(String(row.affiliate_id)))}
 }
 if(filters.productId){const {data,error}=await client().from('affiliate_products').select('affiliate_id').eq('merchant_id',merchantId).eq('product_id',filters.productId);if(error)throw error;(data||[]).forEach(row=>ids.add(String(row.affiliate_id)))}
 return ids
}

export const affiliateService={
 async list(filters:AffiliateFilters,page=1,pageSize=20):Promise<AffiliatePage>{
  const merchantId=await currentMerchant(),matching=await matchingAffiliateIds(merchantId,filters),term=safeTerm(filters.query)
  let query=client().from('affiliates').select(fields,{count:'exact'}).eq('merchant_id',merchantId)
  if(filters.status)query=query.eq('status',filters.status)
  if(filters.from)query=query.gte('joined_at',`${filters.from}T00:00:00.000Z`)
  if(filters.to)query=query.lte('joined_at',`${filters.to}T23:59:59.999Z`)
  if(filters.productId&&!matching.size)return{items:[],count:0,page,pageSize}
  if(filters.productId)query=query.in('id',[...matching])
  else if(term){const direct=`name.ilike.%${term}%,email.ilike.%${term}%,public_id.ilike.%${term}%`;query=matching.size?query.or(`${direct},id.in.(${[...matching].join(',')})`):query.or(direct)}
  const from=(page-1)*pageSize,{data,error,count}=await query.order('joined_at',{ascending:false}).range(from,from+pageSize-1)
  if(error)throw error
  const rows=(data||[]) as Record<string,unknown>[],affiliateIds=rows.map(row=>String(row.id));let productMap=new Map<string,AffiliateProduct[]>()
  if(affiliateIds.length){const {data:links,error:linksError}=await client().from('affiliate_products').select('id,affiliate_id,product_id,commission_type,commission_value,currency,products(name)').eq('merchant_id',merchantId).in('affiliate_id',affiliateIds).order('created_at');if(linksError)throw linksError;productMap=(links||[]).reduce((map,row)=>{const id=String(row.affiliate_id),list=map.get(id)||[];list.push(fromProduct(row as unknown as Record<string,unknown>));map.set(id,list);return map},new Map<string,AffiliateProduct[]>())}
  return{items:rows.map(row=>fromRow(row,productMap.get(String(row.id))||[])),count:count||0,page,pageSize}
 },
 async products():Promise<AffiliateProductOption[]>{const merchantId=await currentMerchant(),{data,error}=await client().from('products').select('id,name').eq('seller_id',merchantId).is('deleted_at',null).order('name').limit(500);if(error)throw error;return(data||[]).map(row=>({id:String(row.id),name:String(row.name)}))},
 async all(filters:AffiliateFilters){const first=await this.list(filters,1,500),items=[...first.items];for(let page=2;items.length<first.count;page+=1){const next=await this.list(filters,page,500);items.push(...next.items);if(!next.items.length)break}return items}
}
