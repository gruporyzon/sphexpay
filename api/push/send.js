import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const titles={device_test:'Notificações ativadas',sale_approved:'Venda aprovada!',sale_pending:'Venda pendente!',pix_generated:'Pix gerado!',pix_approved:'Pix aprovado!',pix_paid:'Pix pago!',credit_card_approved:'Pagamento no cartão aprovado!',credit_card_refused:'Pagamento no cartão recusado',boleto_generated:'Boleto gerado!',boleto_paid:'Boleto pago!',subscription_approved:'Assinatura aprovada!',subscription_renewed:'Assinatura renovada!',refund_done:'Reembolso realizado!',chargeback_received:'Chargeback recebido!',withdrawal_requested:'Saque solicitado',withdrawal_sent:'Saque enviado!',withdrawal_completed:'Saque realizado com sucesso',payment_refused:'Pagamento recusado!'}
const routes={device_test:'/app/configuracoes',sale_approved:'/app/vendas',sale_pending:'/app/vendas',pix_generated:'/app/transacoes',pix_approved:'/app/transacoes',pix_paid:'/app/transacoes',credit_card_approved:'/app/transacoes',credit_card_refused:'/app/transacoes',boleto_generated:'/app/transacoes',boleto_paid:'/app/transacoes',subscription_approved:'/app/assinaturas',subscription_renewed:'/app/assinaturas',refund_done:'/app/transacoes',chargeback_received:'/app/transacoes',withdrawal_requested:'/app/saques',withdrawal_sent:'/app/saques',withdrawal_completed:'/app/saques',payment_refused:'/app/transacoes'}
const clean=value=>typeof value==='string'?value.replace(/^\s*(?:from\s+SphexPay\s*(?:\r?\n|[-–—:]\s*)?|enviado\s+por\s+SphexPay\s*(?:\r?\n)?)/i,'').trim():''
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})
const supabaseUrl=()=>process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL
const configured=()=>Boolean(supabaseUrl()&&process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT)

export default async function handler(request,response){
 if(request.method!=='POST')return response.status(405).json({success:false,code:'METHOD_NOT_ALLOWED',message:'Método não permitido.'})
 if(!configured())return response.status(503).json({success:false,code:'VAPID_NOT_CONFIGURED',message:'O servidor de notificações ainda não foi configurado.'})
 const supabase=createClient(supabaseUrl(),process.env.SUPABASE_SERVICE_ROLE_KEY),token=String(request.headers.authorization||'').replace(/^Bearer\s+/i,'').trim()
 if(!token)return response.status(401).json({success:false,code:'UNAUTHORIZED',message:'Sessão inválida. Entre novamente.'})
 const {data:{user}}=await supabase.auth.getUser(token);if(!user)return response.status(401).json({success:false,code:'UNAUTHORIZED',message:'Sessão inválida. Entre novamente.'})
 let input;try{input=typeof request.body==='string'?JSON.parse(request.body):request.body||{}}catch{return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'Os dados da notificação são inválidos.'})}
 const type=String(input.type||''),eventId=String(input.eventId||'').trim(),customTitle=clean(input.title),title=type==='device_test'?titles[type]:customTitle||titles[type],body=clean(input.body)
 if(!title||!routes[type]||!eventId||eventId.length>160||!body||body.length>240)return response.status(400).json({success:false,code:'INVALID_PAYLOAD',message:'Os dados da notificação são inválidos.'})
 try{webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY)}catch{return response.status(503).json({success:false,code:'VAPID_NOT_CONFIGURED',message:'O servidor de notificações ainda não foi configurado.'})}
 const {data:subscriptions,error}=await supabase.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id',user.id).eq('enabled',true)
 if(error)return response.status(500).json({success:false,code:'SUBSCRIPTIONS_QUERY_FAILED',message:'Não foi possível consultar os dispositivos ativos.'})
 if(!subscriptions?.length)return response.status(404).json({success:false,code:'NO_ACTIVE_SUBSCRIPTIONS',message:'Nenhum dispositivo ativo foi encontrado.',sent:0,failed:0})
 const payload=JSON.stringify({eventId,type,title,body,route:routes[type],createdAt:input.createdAt||new Date().toISOString()})
 const results=await Promise.all(subscriptions.map(async subscription=>{
  const attemptedAt=new Date().toISOString()
  const {error:insertError}=await supabase.from('push_delivery_log').insert({user_id:user.id,subscription_id:subscription.id,event_id:eventId,status:'sending',attempted_at:attemptedAt})
  if(insertError){
   if(insertError.code!=='23505')return'failed'
   const {data:claimed,error:claimError}=await supabase.from('push_delivery_log').update({status:'sending',attempted_at:attemptedAt,delivered_at:null}).eq('subscription_id',subscription.id).eq('event_id',eventId).eq('status','failed').select('id').maybeSingle()
   if(claimError)return'failed'
   if(!claimed)return'duplicate'
  }
  try{
   await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},payload)
   await supabase.from('push_subscriptions').update({last_seen_at:new Date().toISOString(),last_success_at:new Date().toISOString(),last_error:null}).eq('id',subscription.id)
   await supabase.from('push_delivery_log').update({status:'delivered',delivered_at:new Date().toISOString()}).eq('subscription_id',subscription.id).eq('event_id',eventId)
   return'sent'
  }catch(error){
   const statusCode=error?.statusCode
   await supabase.from('push_subscriptions').update({enabled:statusCode===404||statusCode===410?false:true,last_error:statusCode===404||statusCode===410?'SUBSCRIPTION_EXPIRED':String(error?.message||'PUSH_DELIVERY_FAILED').slice(0,180)}).eq('id',subscription.id)
   await supabase.from('push_delivery_log').update({status:'failed'}).eq('subscription_id',subscription.id).eq('event_id',eventId)
   return statusCode===404||statusCode===410?'expired':'failed'
  }
 }))
 const sent=results.filter(result=>result==='sent').length,duplicates=results.filter(result=>result==='duplicate').length,failed=results.filter(result=>result==='failed'||result==='expired').length
 if(!sent&&!duplicates&&results.some(result=>result==='expired'))return response.status(410).json({success:false,code:'SUBSCRIPTION_EXPIRED',message:'A inscrição deste dispositivo expirou. Ative novamente.',sent:0,failed})
 if(!sent&&!duplicates)return response.status(502).json({success:false,code:'PUSH_DELIVERY_FAILED',message:'O Push Service recusou a entrega da notificação.',sent:0,failed})
 return response.status(200).json({success:true,sent,failed,duplicates})
}
