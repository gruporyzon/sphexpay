export type ManualNotificationType='sale_approved'|'sale_pending'|'pix_generated'|'pix_paid'|'credit_card_approved'|'credit_card_refused'|'boleto_generated'|'boleto_paid'|'subscription_renewed'|'withdrawal_completed'|'refund_done'|'chargeback_received'|'custom'
export type ManualCurrency='BRL'|'USD'|'EUR'
export type ManualValueKind='commission'|'sale'|'received'|'custom'
export interface ManualNotificationDraft{notificationType:ManualNotificationType;title:string;body:string;value:string;valueKind:ManualValueKind;currency:ManualCurrency;product:string;customer:string;method:string;route:string;icon:string;showTime:boolean}
type Template={label:string;title:string;body:string}
export const manualNotificationTemplates:Record<ManualNotificationType,Template>={
 sale_approved:{label:'Venda aprovada',title:'Venda aprovada!',body:'{produto} • Sua comissão: {valor}'},
 sale_pending:{label:'Venda pendente',title:'Venda pendente',body:'Existe um pagamento de {valor} aguardando confirmação.'},
 pix_generated:{label:'Pix criado',title:'Pix criado',body:'Um Pix de {valor} foi gerado para {produto}.'},
 pix_paid:{label:'Pix pago',title:'Pix pago!',body:'Pagamento de {valor} confirmado para {produto}.'},
 credit_card_approved:{label:'Cartão aprovado',title:'Cartão aprovado!',body:'Pagamento de {valor} aprovado com sucesso.'},
 credit_card_refused:{label:'Cartão recusado',title:'Cartão recusado',body:'O pagamento de {valor} não foi aprovado.'},
 boleto_generated:{label:'Boleto criado',title:'Boleto criado',body:'Boleto de {valor} disponível para {cliente}.'},
 boleto_paid:{label:'Boleto pago',title:'Boleto pago!',body:'Pagamento de {valor} confirmado.'},
 subscription_renewed:{label:'Assinatura renovada',title:'Assinatura renovada!',body:'A assinatura de {cliente} foi renovada por {valor}.'},
 withdrawal_completed:{label:'Saque concluído',title:'Saque concluído',body:'Seu saque de {valor} foi concluído.'},
 refund_done:{label:'Reembolso',title:'Reembolso realizado',body:'O reembolso de {valor} foi processado.'},
 chargeback_received:{label:'Chargeback',title:'Chargeback recebido',body:'Uma contestação de {valor} requer atenção.'},
 custom:{label:'Aviso personalizado',title:'Aviso da SphexPay',body:'Escreva sua mensagem.'}
}
export const notificationVariables=['{produto}','{valor}','{cliente}','{metodo}','{horario}','{moeda}'] as const
const required:Record<string,keyof ManualNotificationDraft>={produto:'product',valor:'value',cliente:'customer',metodo:'method'}
export const valueKindLabels:Record<ManualValueKind,string>={commission:'Sua comissão',sale:'Valor da venda',received:'Valor recebido',custom:'Valor personalizado'}
export const normalizeBrazilianAmount=(raw:string)=>{
 const filtered=raw.replace(/[^\d.,]/g,'')
 if(!filtered)return''
 const comma=filtered.lastIndexOf(','),dot=filtered.lastIndexOf('.'),decimal=Math.max(comma,dot)
 if(decimal<0)return filtered.replace(/\D/g,'').slice(0,12)
 const integer=filtered.slice(0,decimal).replace(/\D/g,'').slice(0,12)||'0'
 const fraction=filtered.slice(decimal+1).replace(/\D/g,'').slice(0,2)
 return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g,'.')},${fraction}`
}
export const amountToMinor=(raw:string)=>{const value=Number(raw.replace(/\./g,'').replace(',','.'));return Number.isFinite(value)&&value>=0?Math.round(value*100):null}
const money=(raw:string,currency:ManualCurrency)=>{if(!raw.trim())return'';const clean=raw.trim().replace(/\s/g,'');const normalized=clean.includes(',')?clean.replace(/\./g,'').replace(',','.'):clean.replace(/,/g,'');const value=Number(normalized);if(!Number.isFinite(value)||value<0)return'';return new Intl.NumberFormat(currency==='USD'?'en-US':currency==='EUR'?'de-DE':'pt-BR',{style:'currency',currency}).format(value)}
export function formatManualNotification(draft:ManualNotificationDraft){
 const formattedValue=money(draft.value,draft.currency)
 const values:Record<string,string>={produto:draft.product.trim(),valor:formattedValue,cliente:draft.customer.trim(),metodo:draft.method.trim(),horario:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),moeda:draft.currency}
 const used=[...draft.title.matchAll(/\{(\w+)\}/g),...draft.body.matchAll(/\{(\w+)\}/g)].map(match=>match[1])
 const labels:Partial<Record<keyof ManualNotificationDraft,string>>={product:'produto',value:'valor',customer:'cliente',method:'método'}
 const missing=[...new Set(used.filter(name=>required[name]&&!values[name]).map(name=>required[name]))].map(name=>labels[name]||name)
 const replace=(text:string)=>text.replace(/\{(\w+)\}/g,(_,name:string)=>values[name]||'').replace(/\s{2,}/g,' ').replace(/\s+([.,;:!?])/g,'$1').trim()
 if(!draft.title.trim())missing.unshift('título')
 if(!draft.body.trim())missing.push('mensagem')
 if(!draft.route.startsWith('/app'))missing.push('rota de destino')
 return{title:replace(draft.title).slice(0,80),body:replace(draft.body).slice(0,180),formattedValue,valueLabel:valueKindLabels[draft.valueKind],missing:[...new Set(missing)]}
}
