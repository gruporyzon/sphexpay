import { createClient } from '@supabase/supabase-js'
import { serviceRoleKey,supabaseUrl } from '../push/config.js'

const tokenFrom=request=>String(request.headers.authorization||'').replace(/^Bearer\s+/i,'').trim()

export default async function handler(request,response){
 if(request.method!=='GET')return response.status(405).json({success:false,code:'METHOD_NOT_ALLOWED'})
 const url=supabaseUrl(),key=serviceRoleKey(),token=tokenFrom(request)
 if(!url||!key)return response.status(503).json({success:false,code:'SERVER_NOT_CONFIGURED'})
 if(!token)return response.status(401).json({success:false,code:'UNAUTHORIZED'})
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
 const {data:{user}}=await client.auth.getUser(token)
 if(!user)return response.status(401).json({success:false,code:'UNAUTHORIZED'})
 if(user.app_metadata?.role!=='admin')return response.status(403).json({success:false,code:'FORBIDDEN'})
 const [
  {data:lastTransaction},{data:lastApproved},{data:lastPush},
  {count:devices},{count:pending},{count:failed}
 ]=await Promise.all([
  client.from('payment_transactions').select('updated_at').order('updated_at',{ascending:false}).limit(1).maybeSingle(),
  client.from('payment_transactions').select('approved_at').eq('status','approved').order('approved_at',{ascending:false}).limit(1).maybeSingle(),
  client.from('push_delivery_log').select('delivered_at').eq('status','delivered').order('delivered_at',{ascending:false}).limit(1).maybeSingle(),
  client.from('push_subscriptions').select('id',{count:'exact',head:true}).eq('enabled',true),
  client.from('financial_event_outbox').select('id',{count:'exact',head:true}).eq('status','pending'),
  client.from('financial_event_outbox').select('id',{count:'exact',head:true}).eq('status','failed')
 ])
 return response.status(200).json({
  success:true,webhookConfigured:Boolean(process.env.PAYMENT_WEBHOOK_SECRET),
  realtimeTable:'payment_transactions',pushConfigured:Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY),
  lastTransactionAt:lastTransaction?.updated_at||null,lastApprovedAt:lastApproved?.approved_at||null,
  lastPushAt:lastPush?.delivered_at||null,activeDevices:devices||0,pendingEvents:pending||0,failedEvents:failed||0
 })
}
