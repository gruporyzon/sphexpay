import { supabase } from '../lib/supabase'
import type { Product } from '../types'

const fromRow=(row:Record<string,unknown>):Product=>({
 id:String(row.id),name:String(row.name),description:String(row.description||''),
 price:Number(row.price_cents||0)/100,billing:'Única',active:Boolean(row.active),
 sales:0,revenue:0,color:'#f15a24'
})

export const productService={
 async list(sellerId:string){
  if(!supabase)return[] as Product[]
  const {data,error}=await supabase.from('products').select('id,name,description,price_cents,currency,active').eq('seller_id',sellerId).order('updated_at',{ascending:false})
  if(error)throw new Error('PRODUCTS_UNAVAILABLE')
  return(data||[]).map(row=>fromRow(row as Record<string,unknown>))
 },
 async save(sellerId:string,product:Product){
  if(!supabase)throw new Error('PRODUCT_SAVE_UNAVAILABLE')
  const record={seller_id:sellerId,name:product.name,description:product.description,price_cents:Math.round(product.price*100),currency:'BRL',active:product.active,updated_at:new Date().toISOString()}
  if(product.id){
   const {data,error}=await supabase.from('products').update(record).eq('id',product.id).eq('seller_id',sellerId).select('id,name,description,price_cents,currency,active').single()
   if(error)throw new Error('PRODUCT_SAVE_UNAVAILABLE')
   return fromRow(data as Record<string,unknown>)
  }
  const {data,error}=await supabase.from('products').insert(record).select('id,name,description,price_cents,currency,active').single()
  if(error)throw new Error('PRODUCT_SAVE_UNAVAILABLE')
  return fromRow(data as Record<string,unknown>)
 },
 async remove(sellerId:string,productId:string){
  if(!supabase)throw new Error('PRODUCT_DELETE_UNAVAILABLE')
  const {error}=await supabase.from('products').delete().eq('id',productId).eq('seller_id',sellerId)
  if(error)throw new Error('PRODUCT_DELETE_UNAVAILABLE')
 }
}
