import type { AppNotification,CommerceNotificationType,Sale } from '../types'

export type CommerceNotificationPayload={id:string;type:CommerceNotificationType;commission:number|null;currency:Sale['currency'];createdAt:string;route:string;status?:string;title?:string;body?:string}
export const notificationTitles:Record<CommerceNotificationType,string>={
 sale_approved:'Venda aprovada!',
 sale_pending:'Venda pendente!',
 pix_generated:'Pix gerado!',
 pix_approved:'Pix aprovado!',
 pix_paid:'Pix pago!',
 credit_card_approved:'Pagamento no cartão aprovado!',
 credit_card_refused:'Pagamento no cartão recusado',
 boleto_generated:'Boleto gerado!',
 boleto_paid:'Boleto pago!',
 subscription_approved:'Assinatura aprovada!',
 subscription_renewed:'Assinatura renovada!',
 refund_done:'Reembolso realizado!',
 chargeback_received:'Chargeback recebido!',
 withdrawal_requested:'Saque solicitado',
 withdrawal_sent:'Saque enviado!',
 withdrawal_completed:'Saque realizado com sucesso',
 payment_refused:'Pagamento recusado!'
}
export const notificationRoutes:Record<CommerceNotificationType,string>={
 sale_approved:'/app/vendas',sale_pending:'/app/vendas',pix_generated:'/app/transacoes',pix_approved:'/app/transacoes',pix_paid:'/app/transacoes',credit_card_approved:'/app/transacoes',credit_card_refused:'/app/transacoes',boleto_generated:'/app/transacoes',boleto_paid:'/app/transacoes',subscription_approved:'/app/assinaturas',subscription_renewed:'/app/assinaturas',refund_done:'/app/transacoes',chargeback_received:'/app/transacoes',withdrawal_requested:'/app/saques',withdrawal_sent:'/app/saques',withdrawal_completed:'/app/saques',payment_refused:'/app/transacoes'
}
export function formatCommission(value:number|null|undefined,currency:Sale['currency']='BRL'){
 if(value===null||value===undefined||!Number.isFinite(value))return'Sua comissão: —'
 const locale=currency==='USD'?'en-US':'pt-BR'
 const formatted=new Intl.NumberFormat(locale,{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value)
 return `Sua comissão: ${currency==='USD'?formatted.replace('$','US$'):formatted}`
}
export function relativeNotificationTime(value:string,now=Date.now()){
 const difference=Math.max(0,now-new Date(value).getTime()),minutes=Math.floor(difference/60000)
 if(minutes<1)return'Agora'
 if(minutes<60)return`Há ${minutes} min`
 const hours=Math.floor(minutes/60)
 if(hours<24)return`Há ${hours} h`
 const days=Math.floor(hours/24)
 return days===1?'Ontem':`Há ${days} dias`
}
export function saleEventType(sale:Sale):CommerceNotificationType{
 if(sale.status==='Reembolsado')return'refund_done'
 if(sale.status==='Recusado')return sale.method==='Cartão de crédito'?'credit_card_refused':'payment_refused'
 if(sale.status==='Pendente')return sale.method==='Pix'?'pix_generated':sale.method==='Boleto'?'boleto_generated':'sale_pending'
 if(sale.status==='Aprovado')return sale.method==='Cartão de crédito'?'credit_card_approved':sale.method==='Assinatura'?'subscription_approved':sale.method==='Pix'?'pix_approved':sale.method==='Boleto'?'boleto_paid':'sale_approved'
 return'sale_pending'
}
export function commercePayloadFromSale(sale:Sale):CommerceNotificationPayload{
 const type=saleEventType(sale)
 return{id:`NTF-${sale.id}`,type,commission:sale.status==='Aprovado'?Math.max(0,sale.amount-sale.fee):null,currency:sale.currency,createdAt:new Date().toISOString(),route:notificationRoutes[type],status:sale.status}
}
export function payloadFromNotification(notification:AppNotification):CommerceNotificationPayload|null{
 const type=notification.metadata?.eventType
 if(!type||!notification.metadata?.currency)return null
 return{id:notification.id,type,commission:notification.metadata.commission??null,currency:notification.metadata.currency,createdAt:notification.createdAt,route:notification.detailPath||notificationRoutes[type],status:notification.metadata.status}
}
