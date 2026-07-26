import { sendPushToUser } from './send-service.js'

const formats={
 sale_approved:{title:'Venda aprovada!',route:'/app/vendas',kind:'commission'},
 sale_pending:{title:'Venda pendente!',route:'/app/vendas',kind:'commission'},
 pix_created:{title:'Pix gerado!',route:'/app/transacoes',kind:'commission'},
 pix_paid:{title:'Pix pago!',route:'/app/transacoes',kind:'commission'},
 card_approved:{title:'Pagamento no cartão aprovado!',route:'/app/transacoes',kind:'commission'},
 card_declined:{title:'Pagamento no cartão recusado',route:'/app/transacoes',kind:'declined'},
 boleto_created:{title:'Boleto gerado!',route:'/app/transacoes',kind:'commission'},
 boleto_paid:{title:'Boleto pago!',route:'/app/transacoes',kind:'commission'},
 subscription_approved:{title:'Assinatura aprovada!',route:'/app/assinaturas',kind:'commission'},
 subscription_renewed:{title:'Assinatura renovada!',route:'/app/assinaturas',kind:'commission'},
 withdrawal_completed:{title:'Saque realizado com sucesso',route:'/app/saques',kind:'withdrawal'}
}

export const formatMoney=(minor,currency='BRL')=>new Intl.NumberFormat(currency==='USD'?'en-US':currency==='EUR'?'de-DE':'pt-BR',{style:'currency',currency}).format(minor/100)

export async function notifyConfirmedFinancialEvent({client,userId,eventId,type,currency='BRL',commissionMinor,amountMinor,metadata,pushClient}){
 const format=formats[type]
 if(!format)throw Object.assign(new Error('UNSUPPORTED_FINANCIAL_EVENT'),{code:'UNSUPPORTED_FINANCIAL_EVENT'})
 const body=format.kind==='declined'?'Confira os detalhes da transação.':format.kind==='withdrawal'?`Valor enviado: ${formatMoney(amountMinor,currency)}`:`Sua comissão: ${formatMoney(commissionMinor,currency)}`
 return sendPushToUser({client,userId,eventId,type,title:format.title,body,route:format.route,metadata,pushClient})
}
