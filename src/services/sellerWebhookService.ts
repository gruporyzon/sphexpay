import { supabase } from '../lib/supabase'

// Webhooks de saída do vendedor. O banco gera as entregas a partir das vendas reais e envia
// assinadas (HMAC-SHA256); aqui só há gestão, segredo sob demanda, teste e histórico.
export type WebhookEvent='sale.approved'|'sale.refunded'|'sale.chargeback'
export const WEBHOOK_EVENTS:{value:WebhookEvent;label:string}[]=[
 {value:'sale.approved',label:'Venda aprovada'},{value:'sale.refunded',label:'Venda reembolsada'},{value:'sale.chargeback',label:'Contestação recebida'}
]
export type SellerWebhook={id:string;name:string;url:string;events:WebhookEvent[];active:boolean;createdAt:string;updatedAt:string}
export type WebhookDeliveryStatus='pending'|'sending'|'succeeded'|'failed'
export type WebhookDelivery={id:string;webhookId:string;eventType:WebhookEvent|'webhook.test';status:WebhookDeliveryStatus;attempts:number;responseStatus:number|null;lastError:string|null;nextAttemptAt:string;deliveredAt:string|null;createdAt:string}
export type WebhookInput={name:string;url:string;events:WebhookEvent[]}

const ERRORS:Record<string,string>={
 WEBHOOK_URL_INVALID:'Use um endereço https público (sem IP, localhost ou porta diferente de 443).',
 WEBHOOK_EVENTS_REQUIRED:'Escolha pelo menos um evento.',
 WEBHOOK_NAME_INVALID:'Dê um nome de 1 a 60 caracteres.',
 WEBHOOK_LIMIT:'Você chegou ao limite de 10 webhooks.',
 WEBHOOK_TEST_RATE_LIMIT:'Aguarde alguns segundos antes de enviar outro teste.',
 WEBHOOK_NOT_FOUND:'Este webhook não existe mais.'
}
const failure=(error:{message?:string}|null,fallback:string)=>{const code=Object.keys(ERRORS).find(key=>error?.message?.includes(key));return new Error(code?ERRORS[code]:fallback)}
const client=()=>{if(!supabase)throw new Error('A conexão com o servidor não está disponível.');return supabase}

export const sellerWebhookService={
 async list():Promise<SellerWebhook[]>{
  const {data,error}=await client().from('seller_webhooks').select('id,name,url,events,active,created_at,updated_at').order('created_at',{ascending:false})
  if(error)throw new Error('Não foi possível carregar seus webhooks.')
  return(data||[]).map(row=>({id:row.id,name:row.name,url:row.url,events:row.events as WebhookEvent[],active:row.active,createdAt:row.created_at,updatedAt:row.updated_at}))
 },
 async deliveries():Promise<WebhookDelivery[]>{
  const {data,error}=await client().from('webhook_deliveries').select('id,webhook_id,event_type,status,attempts,response_status,last_error,next_attempt_at,delivered_at,created_at').order('created_at',{ascending:false}).limit(50)
  if(error)throw new Error('Não foi possível carregar as entregas.')
  return(data||[]).map(row=>({id:row.id,webhookId:row.webhook_id,eventType:row.event_type,status:row.status,attempts:row.attempts,responseStatus:row.response_status,lastError:row.last_error,nextAttemptAt:row.next_attempt_at,deliveredAt:row.delivered_at,createdAt:row.created_at}))
 },
 async create(input:WebhookInput):Promise<{id:string;secret:string}>{
  const {data,error}=await client().rpc('create_seller_webhook',{p_name:input.name,p_url:input.url,p_events:input.events})
  if(error||!data)throw failure(error,'Não foi possível criar o webhook.')
  return data as {id:string;secret:string}
 },
 async update(id:string,input:WebhookInput&{active:boolean}){
  const {error}=await client().rpc('update_seller_webhook',{p_id:id,p_name:input.name,p_url:input.url,p_events:input.events,p_active:input.active})
  if(error)throw failure(error,'Não foi possível salvar o webhook.')
 },
 async remove(id:string){
  const {error}=await client().from('seller_webhooks').delete().eq('id',id)
  if(error)throw new Error('Não foi possível remover o webhook.')
 },
 async secret(id:string,rotate=false):Promise<string>{
  const {data,error}=await client().rpc('reveal_seller_webhook_secret',{p_id:id,p_rotate:rotate})
  if(error||typeof data!=='string')throw failure(error,'Não foi possível obter o segredo.')
  return data
 },
 async test(id:string){
  const {error}=await client().rpc('send_test_seller_webhook',{p_id:id})
  if(error)throw failure(error,'Não foi possível enviar o teste.')
 }
}
