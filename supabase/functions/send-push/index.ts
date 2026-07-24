import {createClient} from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const titles:Record<string,string>={sale_approved:'Venda aprovada!',sale_pending:'Venda pendente!',pix_generated:'Pix gerado!',pix_paid:'Pix pago!',credit_card_approved:'Pagamento cartão de crédito aprovado!',boleto_generated:'Boleto gerado!',subscription_approved:'Assinatura aprovada!',subscription_renewed:'Assinatura renovada!',refund_done:'Reembolso realizado!',chargeback_received:'Chargeback recebido!',withdrawal_sent:'Saque enviado!',withdrawal_completed:'Saque concluído!',payment_refused:'Pagamento recusado!'}
Deno.serve(async request=>{
 if(request.method!=='POST')return new Response('Method not allowed',{status:405})
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),publicKey=Deno.env.get('VAPID_PUBLIC_KEY'),privateKey=Deno.env.get('VAPID_PRIVATE_KEY'),subject=Deno.env.get('VAPID_SUBJECT')
 if(!url||!anon||!serviceRole||!publicKey||!privateKey||!subject)return Response.json({error:'Push server is not configured'},{status:503})
 const authorization=request.headers.get('Authorization')||'',authClient=createClient(url,anon,{global:{headers:{Authorization:authorization}}}),{data:{user}}=await authClient.auth.getUser()
 if(!user)return Response.json({error:'Unauthorized'},{status:401})
 const input=await request.json(),title=titles[input.type]
 if(!title||typeof input.body!=='string')return Response.json({error:'Invalid notification payload'},{status:400})
 const admin=createClient(url,serviceRole),{data:subscriptions,error}=await admin.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id',user.id)
 if(error)return Response.json({error:'Unable to load subscriptions'},{status:500})
 webpush.setVapidDetails(subject,publicKey,privateKey)
 const payload=JSON.stringify({title,body:input.body,tag:input.tag||`${input.type}-${Date.now()}`,url:input.url||'/app/notificacoes',notificationId:input.notificationId})
 const results=await Promise.allSettled((subscriptions||[]).map(async subscription=>{try{await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},payload)}catch(pushError){if((pushError as {statusCode?:number}).statusCode===404||(pushError as {statusCode?:number}).statusCode===410)await admin.from('push_subscriptions').delete().eq('id',subscription.id);throw pushError}}))
 return Response.json({sent:results.filter(result=>result.status==='fulfilled').length,failed:results.filter(result=>result.status==='rejected').length})
})
