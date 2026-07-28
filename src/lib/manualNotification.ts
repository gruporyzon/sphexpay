export type ManualNotificationType='sale_approved'|'sale_pending'|'pix_generated'|'pix_paid'|'credit_card_approved'|'credit_card_refused'|'boleto_generated'|'boleto_paid'|'subscription_renewed'|'withdrawal_completed'|'refund_done'|'chargeback_received'|'custom'
export type ManualCurrency='BRL'|'USD'|'EUR'
export type ManualValueKind='commission'|'sale'|'received'|'custom'
export type NotificationIntervalUnit='seconds'|'minutes'|'hours'
export interface ManualNotificationDraft{notificationType:ManualNotificationType;title:string;body:string;value:string;valueKind:ManualValueKind;currency:ManualCurrency;customer:string;method:string;route:string;icon:string;showTime:boolean}
type Template={label:string;title:string;body:string}
export const manualNotificationTemplates:Record<ManualNotificationType,Template>={
 sale_approved:{label:'Venda aprovada',title:'Venda aprovada!',body:'Sua comissão de {valor} foi confirmada.'},
 sale_pending:{label:'Venda pendente',title:'Venda pendente',body:'Existe um pagamento de {valor} aguardando confirmação.'},
 pix_generated:{label:'Pix criado',title:'Pix gerado!',body:'Uma cobrança Pix de {valor} foi criada.'},
 pix_paid:{label:'Pix pago',title:'Pix confirmado!',body:'Um pagamento de {valor} foi confirmado.'},
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
export const notificationVariables=['{valor}','{cliente}','{metodo}','{horario}','{moeda}'] as const
const required:Record<string,keyof ManualNotificationDraft>={valor:'value',cliente:'customer',metodo:'method'}
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
export const applyAiSuggestion=<T extends ManualNotificationDraft>(draft:T,suggestion:{title:string;body:string}):T=>({...draft,title:suggestion.title.slice(0,60),body:suggestion.body.slice(0,160)})
export const intervalToMilliseconds=(value:number,unit:NotificationIntervalUnit)=>value*({seconds:1000,minutes:60000,hours:3600000}[unit])
export const intervalLimits:Record<NotificationIntervalUnit,{min:number;max:number}>={seconds:{min:3,max:3600},minutes:{min:1,max:1440},hours:{min:1,max:168}}
export function validateSequence(quantity:number,interval:number,unit:NotificationIntervalUnit){
 if(!Number.isInteger(quantity)||quantity<1||quantity>100)return'A quantidade deve ser um número inteiro entre 1 e 100.'
 const limits=intervalLimits[unit]
 if(!Number.isInteger(interval)||interval<limits.min||interval>limits.max)return`O intervalo em ${unit==='seconds'?'segundos':unit==='minutes'?'minutos':'horas'} deve ficar entre ${limits.min} e ${limits.max}.`
 return''
}
export function formatEstimatedDuration(milliseconds:number){
 if(milliseconds<=0)return'Envio imediato.'
 const totalSeconds=Math.floor(milliseconds/1000),hours=Math.floor(totalSeconds/3600),minutes=Math.floor(totalSeconds%3600/60),seconds=totalSeconds%60
 const parts=[hours&&`${hours} hora${hours===1?'':'s'}`,minutes&&`${minutes} minuto${minutes===1?'':'s'}`,seconds&&`${seconds} segundo${seconds===1?'':'s'}`].filter(Boolean)
 return`Duração estimada: ${parts.join(' e ')}.`
}
export function localNotificationVariations(type:ManualNotificationType,value:string){
 const amount=value||'o valor informado'
 const variations:Record<ManualNotificationType,Array<{title:string;body:string}>>={
  sale_approved:[{title:'Venda aprovada!',body:`Sua comissão de ${amount} foi confirmada.`},{title:'Pagamento confirmado!',body:`Uma nova venda de ${amount} foi aprovada.`},{title:'Venda concluída!',body:`A confirmação de ${amount} foi recebida com sucesso.`}],
  sale_pending:[{title:'Venda pendente',body:`Um pagamento de ${amount} aguarda confirmação.`},{title:'Pagamento em análise',body:`O valor de ${amount} está sendo processado.`},{title:'Confirmação pendente',body:`A venda de ${amount} ainda está em análise.`}],
  pix_generated:[{title:'Pix gerado!',body:`Uma cobrança Pix de ${amount} foi criada.`},{title:'Cobrança Pix criada',body:`O Pix de ${amount} está aguardando pagamento.`},{title:'Pix disponível',body:`A cobrança de ${amount} foi gerada com sucesso.`}],
  pix_paid:[{title:'Pix confirmado!',body:`Um pagamento de ${amount} foi confirmado.`},{title:'Pix recebido!',body:`O recebimento de ${amount} foi aprovado.`},{title:'Pagamento confirmado',body:`O Pix de ${amount} foi pago com sucesso.`}],
  credit_card_approved:[{title:'Cartão aprovado!',body:`Pagamento de ${amount} aprovado com sucesso.`},{title:'Pagamento aprovado',body:`A cobrança de ${amount} no cartão foi confirmada.`},{title:'Venda no cartão confirmada',body:`O valor de ${amount} foi aprovado.`}],
  credit_card_refused:[{title:'Cartão recusado',body:`O pagamento de ${amount} não foi aprovado.`},{title:'Pagamento não aprovado',body:`A cobrança de ${amount} foi recusada.`},{title:'Falha no cartão',body:`Não foi possível aprovar o valor de ${amount}.`}],
  boleto_generated:[{title:'Boleto gerado',body:`O boleto de ${amount} está disponível.`},{title:'Cobrança criada',body:`Um boleto de ${amount} foi gerado.`},{title:'Boleto disponível',body:`A cobrança de ${amount} já pode ser paga.`}],
  boleto_paid:[{title:'Boleto pago!',body:`Pagamento de ${amount} confirmado.`},{title:'Pagamento recebido',body:`O boleto de ${amount} foi compensado.`},{title:'Boleto confirmado',body:`O recebimento de ${amount} foi concluído.`}],
  subscription_renewed:[{title:'Assinatura renovada!',body:`A renovação de ${amount} foi confirmada.`},{title:'Renovação confirmada',body:`A assinatura foi renovada por ${amount}.`},{title:'Assinatura ativa',body:`O pagamento de ${amount} foi aprovado.`}],
  withdrawal_completed:[{title:'Saque concluído',body:`Seu saque de ${amount} foi concluído.`},{title:'Saque confirmado',body:`O envio de ${amount} foi finalizado.`},{title:'Valor enviado',body:`O saque de ${amount} foi processado.`}],
  refund_done:[{title:'Reembolso realizado',body:`O reembolso de ${amount} foi processado.`},{title:'Valor reembolsado',body:`A devolução de ${amount} foi concluída.`},{title:'Reembolso confirmado',body:`O valor de ${amount} foi devolvido.`}],
  chargeback_received:[{title:'Chargeback recebido',body:`Uma contestação de ${amount} requer atenção.`},{title:'Contestação recebida',body:`O valor de ${amount} está em disputa.`},{title:'Atenção ao chargeback',body:`Revise a contestação de ${amount}.`}],
  custom:[{title:'Aviso da SphexPay',body:'Você tem uma nova atualização.'},{title:'Nova informação',body:'Confira a atualização disponível.'},{title:'Aviso importante',body:'Há uma nova informação para você.'}]
 }
 return variations[type]
}
const money=(raw:string,currency:ManualCurrency)=>{if(!raw.trim())return'';const clean=raw.trim().replace(/\s/g,'');const normalized=clean.includes(',')?clean.replace(/\./g,'').replace(',','.'):clean.replace(/,/g,'');const value=Number(normalized);if(!Number.isFinite(value)||value<0)return'';return new Intl.NumberFormat(currency==='USD'?'en-US':currency==='EUR'?'de-DE':'pt-BR',{style:'currency',currency}).format(value)}
export function formatManualNotification(draft:ManualNotificationDraft){
 const formattedValue=money(draft.value,draft.currency)
 const values:Record<string,string>={valor:formattedValue,cliente:draft.customer.trim(),metodo:draft.method.trim(),horario:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),moeda:draft.currency}
 const used=[...draft.title.matchAll(/\{(\w+)\}/g),...draft.body.matchAll(/\{(\w+)\}/g)].map(match=>match[1])
 const labels:Partial<Record<keyof ManualNotificationDraft,string>>={value:'valor',customer:'cliente',method:'método'}
 const missing=[...new Set(used.filter(name=>required[name]&&!values[name]).map(name=>required[name]))].map(name=>labels[name]||name)
 const replace=(text:string)=>text.replace(/\{(\w+)\}/g,(_,name:string)=>values[name]||'').replace(/\s{2,}/g,' ').replace(/\s+([.,;:!?])/g,'$1').trim()
 if(!draft.title.trim())missing.unshift('título')
 if(!draft.body.trim())missing.push('mensagem')
 if(!draft.route.startsWith('/app'))missing.push('rota de destino')
 return{title:replace(draft.title).slice(0,80),body:replace(draft.body).slice(0,180),formattedValue,valueLabel:valueKindLabels[draft.valueKind],missing:[...new Set(missing)]}
}
