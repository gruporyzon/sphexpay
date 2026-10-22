import {supabase} from '../../lib/supabase'
import type {Affiliate,AffiliateFilters,AffiliateInput,AffiliateLinkInput,AffiliatePage,AffiliateProduct,AffiliateProductOption,AffiliateStatus} from './types'

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
 async products():Promise<AffiliateProductOption[]>{const merchantId=await currentMerchant(),{data,error}=await client().from('products').select('id,name,currency').eq('seller_id',merchantId).is('deleted_at',null).order('name').limit(500);if(error)throw error;return(data||[]).map(row=>({id:String(row.id),name:String(row.name),currency:(['BRL','USD','EUR'].includes(String(row.currency))?row.currency:'BRL') as 'BRL'|'USD'|'EUR'}))},
 async all(filters:AffiliateFilters){const first=await this.list(filters,1,500),items=[...first.items];for(let page=2;items.length<first.count;page+=1){const next=await this.list(filters,page,500);items.push(...next.items);if(!next.items.length)break}return items},
 // Cadastro e vínculos: escrita direta sob RLS (o vendedor só altera os próprios afiliados).
 async save(input:AffiliateInput,id?:string):Promise<{id:string;publicId:string}>{
  const merchantId=await currentMerchant(),row={name:input.name.trim(),email:input.email.trim()?input.email.trim().toLowerCase():null,status:input.status}
  const query=id?client().from('affiliates').update(row).eq('id',id).eq('merchant_id',merchantId):client().from('affiliates').insert({...row,merchant_id:merchantId})
  const {data,error}=await query.select('id,public_id').single()
  if(error)throw new Error(error.code==='23505'?'Já existe um afiliado com este e-mail.':'Não foi possível salvar o afiliado.')
  return{id:String(data.id),publicId:String(data.public_id)}
 },
 async saveProduct(affiliateId:string,link:AffiliateLinkInput){
  const merchantId=await currentMerchant()
  const {data,error}=await client().from('affiliate_products').upsert({merchant_id:merchantId,affiliate_id:affiliateId,product_id:link.productId,commission_type:link.commissionType,commission_value:link.commissionValue,currency:link.currency},{onConflict:'affiliate_id,product_id'}).select('id').single()
  if(error||!data)throw new Error('Não foi possível vincular o produto.')
  return String(data.id)
 },
 async removeProduct(linkId:string){
  const merchantId=await currentMerchant(),{error}=await client().from('affiliate_products').delete().eq('id',linkId).eq('merchant_id',merchantId)
  if(error)throw new Error('Não foi possível remover o produto.')
 },
 async remove(id:string){
  const merchantId=await currentMerchant(),{error}=await client().from('affiliates').delete().eq('id',id).eq('merchant_id',merchantId)
  if(error)throw new Error('Não foi possível excluir o afiliado.')
 }
}
