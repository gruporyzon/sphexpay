import type { AppNotification,Sale } from '../types'
import { commercePayloadFromSale,formatCommission,notificationTitles } from '../lib/notificationCatalog'

export function saleNotification(sale:Sale):AppNotification{
 const payload=commercePayloadFromSale(sale),approved=sale.status==='Aprovado'
 return{id:`NTF-${sale.id}`,kind:approved?'sale':sale.method==='Assinatura'?'subscription':'payment',category:sale.method==='Assinatura'?'Assinaturas':approved?'Vendas':'Financeiro',title:notificationTitles[payload.type],description:formatCommission(payload.commission,payload.currency),createdAt:payload.createdAt,read:false,priority:approved?'high':sale.status==='Recusado'?'critical':'normal',metadata:{buyer:sale.customer,product:sale.product,amount:sale.amount,commission:payload.commission,currency:sale.currency,method:sale.method,status:sale.status,country:sale.country,eventType:payload.type,source:'local'},detailPath:payload.route}
}
