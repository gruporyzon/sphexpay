import { sendPushToUser } from './send-service.js'
import { REMINDER_HOURS,buildRevenueReminder,buildSaleNotification } from '../notifications/revenueMessages.js'

// Avisos automáticos pedidos pelo próprio banco (pg_net), nunca pelo navegador:
//  - kind 'sale': venda real aprovada ou pendente -> "Venda aprovada!" / "Valor: R$ 197,00".
//  - kind 'reminders': a cada hora cheia; nos horários escolhidos (padrão 0h, 8h, 12h, 15h,
//    18h e 20h de Brasília) envia o faturamento do dia com mensagem profissional ou de humor.
// Acesso: cabeçalho x-sphex-notify conferido por sphex_notify_token_ok (token no Vault do banco).

const TZ='America/Sao_Paulo'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Data (AAAA-MM-DD) e hora de Brasília.
export function brasilia(now){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(part=>[part.type,part.value]))
 return{date:`${parts.year}-${parts.month}-${parts.day}`,hour:Number(parts.hour)}
}
const previousDay=date=>{const day=new Date(`${date}T12:00:00Z`);day.setUTCDate(day.getUTCDate()-1);return day.toISOString().slice(0,10)}
const seedFor=(userId,date,hour)=>{let hash=0;for(const char of `${userId}${date}${hour}`)hash=(hash*31+char.charCodeAt(0))|0;return Math.abs(hash)}

export async function isAutomaticRequest(client,token){
 if(typeof token!=='string'||token.length!==64)return false
 const {data,error}=await client.rpc('sphex_notify_token_ok',{p_token:token})
 return!error&&data===true
}

export async function notifySale(client,transactionId,options={}){
 if(typeof transactionId!=='string'||!UUID.test(transactionId))return{status:400,body:{success:false,code:'INVALID_TRANSACTION'}}
 const {data:sale,error}=await client.from('payment_transactions').select('user_id,transaction_id,provider,status,amount_cents,currency').eq('id',transactionId).maybeSingle()
 if(error)return{status:500,body:{success:false,code:'TRANSACTION_QUERY_FAILED'}}
 if(!sale||sale.provider!=='stripe'||!['approved','pending'].includes(sale.status))return{status:200,body:{success:true,skipped:true}}
 const message=buildSaleNotification(sale.status,Number(sale.amount_cents)||0,sale.currency||'BRL')
 const result=await sendPushToUser({client,userId:sale.user_id,eventId:`sale:${sale.transaction_id}:${sale.status}`,type:sale.status==='approved'?'sale_approved':'sale_pending',
  title:message.title,body:message.body,route:`/app/vendas/${sale.transaction_id}`,pushClient:options.pushClient})
 return{status:200,body:{success:true,sent:result.sent||0}}
}

export async function notifyReminders(client,options={}){
 const now=brasilia(options.now||new Date())
 if(!REMINDER_HOURS.includes(now.hour))return{status:200,body:{success:true,skipped:true,hour:now.hour}}
 const day=now.hour===0?previousDay(now.date):now.date
 const {data:targets,error}=await client.rpc('revenue_reminder_targets',{p_hour:now.hour,p_day:day})
 if(error)return{status:500,body:{success:false,code:'TARGETS_QUERY_FAILED'}}
 const slot=`${now.date}T${String(now.hour).padStart(2,'0')}`
 let users=0,sent=0
 for(const target of targets||[]){
  // Um envio por vendedor e horário, mesmo se o agendador disparar de novo.
  const {data:claimed,error:claimError}=await client.from('revenue_reminder_log').upsert({user_id:target.user_id,slot},{onConflict:'user_id,slot',ignoreDuplicates:true}).select('user_id')
  if(claimError||!claimed?.length)continue
  const message=buildRevenueReminder({hour:now.hour,revenueCents:Number(target.revenue_cents)||0,sales:Number(target.sales)||0,style:target.style,firstName:target.first_name||undefined,seed:seedFor(target.user_id,now.date,now.hour)})
  try{
   const result=await sendPushToUser({client,userId:target.user_id,eventId:`reminder:${slot}`,type:'revenue_reminder',title:message.title,body:message.body,route:'/app',pushClient:options.pushClient})
   sent+=result.sent||0;users++
  }catch{/* segue para o próximo vendedor */}
 }
 return{status:200,body:{success:true,hour:now.hour,users,sent}}
}

export async function handleAutomatic(client,input,options={}){
 if(input?.kind==='sale')return notifySale(client,input.transactionId,options)
 if(input?.kind==='reminders')return notifyReminders(client,options)
 return{status:400,body:{success:false,code:'UNKNOWN_KIND'}}
}
