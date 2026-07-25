import {createClient} from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const titles:Record<string,string>={
 device_test:'Notificações ativadas',
 sale_approved:'Venda aprovada!',sale_pending:'Venda pendente!',pix_generated:'Pix gerado!',pix_approved:'Pix aprovado!',pix_paid:'Pix pago!',
 credit_card_approved:'Pagamento no cartão aprovado!',credit_card_refused:'Pagamento no cartão recusado',boleto_generated:'Boleto gerado!',boleto_paid:'Boleto pago!',
 subscription_approved:'Assinatura aprovada!',subscription_renewed:'Assinatura renovada!',refund_done:'Reembolso realizado!',chargeback_received:'Chargeback recebido!',
 withdrawal_requested:'Saque solicitado',withdrawal_sent:'Saque enviado!',withdrawal_completed:'Saque realizado com sucesso',payment_refused:'Pagamento recusado!',
}
const routes:Record<string,string>={
 device_test:'/app/configuracoes',
 sale_approved:'/app/vendas',sale_pending:'/app/vendas',pix_generated:'/app/transacoes',pix_approved:'/app/transacoes',pix_paid:'/app/transacoes',
 credit_card_approved:'/app/transacoes',credit_card_refused:'/app/transacoes',boleto_generated:'/app/transacoes',boleto_paid:'/app/transacoes',
 subscription_approved:'/app/assinaturas',subscription_renewed:'/app/assinaturas',refund_done:'/app/transacoes',chargeback_received:'/app/transacoes',
 withdrawal_requested:'/app/saques',withdrawal_sent:'/app/saques',withdrawal_completed:'/app/saques',payment_refused:'/app/transacoes',
}
const sanitizeNotificationBody=(value:unknown)=>typeof value==='string'?value.replace(/^\s*(?:from\s+SphexPay\s*(?:\r?\n|[-–—:]\s*)?|enviado\s+por\s+SphexPay\s*(?:\r?\n)?)/i,'').trim():''

Deno.serve(async request=>{
 if(request.method!=='POST')return new Response('Method not allowed',{status:405})
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),publicKey=Deno.env.get('VAPID_PUBLIC_KEY'),privateKey=Deno.env.get('VAPID_PRIVATE_KEY'),subject=Deno.env.get('VAPID_SUBJECT')
 if(!url||!anon||!serviceRole||!publicKey||!privateKey||!subject)return Response.json({success:false,code:'VAPID_NOT_CONFIGURED',message:'O servidor de notificações ainda não foi configurado.'},{status:503})
 const authorization=request.headers.get('Authorization')||'',authClient=createClient(url,anon,{global:{headers:{Authorization:authorization}}}),{data:{user}}=await authClient.auth.getUser()
 if(!user)return Response.json({success:false,code:'UNAUTHORIZED',message:'Sessão inválida. Entre novamente.'},{status:401})
 const input=await request.json(),mappedTitle=titles[input.type],customTitle=typeof input.title==='string'?input.title.trim():'',title=customTitle||mappedTitle,eventId=typeof input.eventId==='string'?input.eventId.trim():'',body=sanitizeNotificationBody(input.body)
 if(!mappedTitle||!title||title.length>70||!eventId||eventId.length>160||!body||body.length>160)return Response.json({success:false,code:'INVALID_PAYLOAD',message:'Payload de notificação inválido.'},{status:400})
 const route=routes[input.type],admin=createClient(url,serviceRole),{data:subscriptions,error}=await admin.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id',user.id).eq('enabled',true)
 if(error)return Response.json({success:false,code:'SUBSCRIPTIONS_QUERY_FAILED',message:'Não foi possível consultar os dispositivos ativos.'},{status:500})
 if(!subscriptions?.length)return Response.json({success:false,code:'NO_ACTIVE_SUBSCRIPTIONS',message:'Nenhum dispositivo ativo foi encontrado.',sent:0,failed:0},{status:404})
 try{webpush.setVapidDetails(subject,publicKey,privateKey)}catch{return Response.json({success:false,code:'VAPID_NOT_CONFIGURED',message:'O servidor de notificações ainda não foi configurado.'},{status:503})}
 const payload=JSON.stringify({eventId,type:input.type,title,body,route,createdAt:input.createdAt||new Date().toISOString()})
 const results=await Promise.allSettled((subscriptions||[]).map(async subscription=>{
  const attemptedAt=new Date().toISOString()
  const {error:insertError}=await admin.from('push_delivery_log').insert({user_id:user.id,subscription_id:subscription.id,event_id:eventId,status:'sending',attempted_at:attemptedAt})
  if(insertError){
   if(insertError.code!=='23505')throw insertError
   const {data:claimed,error:claimError}=await admin.from('push_delivery_log').update({status:'sending',attempted_at:attemptedAt,delivered_at:null}).eq('subscription_id',subscription.id).eq('event_id',eventId).eq('status','failed').select('id').maybeSingle()
   if(claimError)throw claimError
   if(!claimed)return 'duplicate'
  }
  try{
   await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},payload)
   await admin.from('push_delivery_log').update({status:'delivered',delivered_at:new Date().toISOString()}).eq('subscription_id',subscription.id).eq('event_id',eventId)
   await admin.from('push_subscriptions').update({last_seen_at:new Date().toISOString(),last_success_at:new Date().toISOString(),last_error:null}).eq('id',subscription.id)
   return 'delivered'
  }catch(pushError){
   const code=(pushError as {statusCode?:number}).statusCode
   await admin.from('push_delivery_log').update({status:'failed'}).eq('subscription_id',subscription.id).eq('event_id',eventId)
   await admin.from('push_subscriptions').update({enabled:code===404||code===410?false:true,last_error:code===404||code===410?'SUBSCRIPTION_EXPIRED':String((pushError as {message?:string}).message||'PUSH_DELIVERY_FAILED').slice(0,180)}).eq('id',subscription.id)
   throw pushError
  }
 }))
 const sent=results.filter(result=>result.status==='fulfilled'&&result.value==='delivered').length,failed=results.filter(result=>result.status==='rejected').length
 return Response.json({success:failed===0,sent,duplicates:results.filter(result=>result.status==='fulfilled'&&result.value==='duplicate').length,failed,message:failed?'Não foi possível entregar a notificação em todos os dispositivos.':'Notificação enviada ao dispositivo.'})
})
