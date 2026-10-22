// Mensagens dos lembretes de faturamento (0h, 8h, 12h, 15h, 18h e 20h, horário de Brasília).
// Usado pelo envio automático (api/push/send.js) e pela prévia em Configurações. Só recebe números reais
// (vendas aprovadas da conta); as comparações de humor são brincadeira, nunca afirmação.

export const REMINDER_HOURS=Object.freeze([0,8,12,15,18,20])
export const STYLE_LABEL={mixed:'Misto',professional:'Profissional',humor:'Humor'}

export const formatBRL=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Math.max(0,cents)/100)
const pick=(items,seed)=>items[Math.abs(Math.trunc(seed))%items.length]
const salesText=count=>`${count} ${count===1?'venda':'vendas'}`

const PRO_TITLE={0:'Fechamento do dia',8:'Bom dia',12:'Resumo do meio-dia',15:'Resumo da tarde',18:'Resumo das 18h',20:'Resumo da noite'}
const HUMOR_TITLE={
 0:['Fechou a conta!','Placar final de ontem'],8:['Bom dia, CEO','Café e faturamento'],12:['Almoço pago?','Plantão do meio-dia'],
 15:['Pausa pro café','Plantão das 15h'],18:['Hora do rush','Fim de expediente?'],20:['Placar da noite','Antes da novela']
}

const PRO_POSITIVE=[
 (v,c,n)=>`${n}você faturou ${v} hoje em ${c}.`,
 (v,c)=>`Faturamento de hoje até agora: ${v} (${c} aprovadas).`,
 (v,c,n)=>`${n}${v} em ${c} hoje. Continue nesse ritmo.`
]
const PRO_CLOSE=[
 (v,c,n)=>`${n}ontem você faturou ${v} em ${c}. Bom descanso.`,
 (v,c)=>`Dia encerrado: ${v} em ${c} aprovadas.`
]
const PRO_ZERO={
 close:['Ontem não houve vendas aprovadas. Amanhã é uma nova chance.','Dia encerrado sem vendas aprovadas. Revise seu link e suas campanhas.'],
 morning:['Um novo dia de vendas começou. Seu link de pagamento está pronto.','Bom dia! Hoje é um ótimo dia para divulgar seus produtos.'],
 day:['Ainda sem vendas aprovadas hoje. Que tal divulgar seu link?','Nenhuma venda aprovada até agora. Uma postagem pode mudar o dia.']
}
// Faixas em centavos: quanto maior o faturamento, maior a brincadeira.
const HUMOR_TIERS=[
 [1_000_000,[(v)=>`Você faturou mais que o Papai Noel em dezembro: ${v} hoje!`,(v)=>`${v} hoje. A Receita Federal já mandou um "oi".`,(v,c)=>`${v} em ${c}. Isso não é um dia, é um fenômeno.`]],
 [100_000,[(v)=>`${v} hoje! Seu caixa tá mais cheio que ônibus às 18h.`,(v)=>`Já são ${v}. Pode pedir o delivery sem olhar o preço.`,(v,c)=>`${c} e ${v} no bolso. O algoritmo tá do seu lado.`]],
 [1,[(v)=>`${v} hoje. Pouco a pouco o cofrinho engorda.`,(v)=>`Tá rolando! ${v} até agora. O próximo Pix já tá vindo.`,(v,c)=>`${c}, ${v}. Primeiro degrau da escada do milhão.`]]
]
const HUMOR_CLOSE=[
 (v)=>`Ontem rendeu ${v}. Pode dormir sorrindo.`,
 (v,c)=>`Placar final de ontem: ${c}, ${v}. Que venha o próximo!`
]
const HUMOR_ZERO={
 close:['Ontem o caixa tirou folga. Hoje ele volta ao trabalho.','Zero ontem? Até craque perde pênalti. Bora pra hoje!'],
 morning:['O caixa acordou com fome. Bora alimentar ele com vendas?','Café na mão, link na bio. Partiu vender!'],
 day:['O caixa tá mais quieto que biblioteca. Bora mandar o link pra galera?','Zero vendas até agora, mas o dia ainda não acabou. Partiu divulgar!']
}

const clip=(text,max)=>text.length>max?`${text.slice(0,max-1).trimEnd()}…`:text

export function buildRevenueReminder({hour,revenueCents,sales,style,firstName,seed}){
 const resolved=style==='mixed'?(seed%2===0?'professional':'humor'):style
 const name=firstName?.trim()?`${firstName.trim().split(/\s+/)[0]}, `:''
 const value=formatBRL(revenueCents),count=salesText(sales),moment=hour===0?'close':hour<12?'morning':'day'
 const positive=revenueCents>0
 const title=resolved==='professional'?(PRO_TITLE[hour]||'Resumo do dia'):pick(HUMOR_TITLE[hour]||['Seu placar'],seed)
 let body
 if(resolved==='professional'){
  body=positive?pick(hour===0?PRO_CLOSE:PRO_POSITIVE,seed)(value,count,name):pick(PRO_ZERO[moment],seed)
 }else{
  const tier=HUMOR_TIERS.find(([min])=>revenueCents>=min)?.[1]
  body=positive?pick(hour===0?HUMOR_CLOSE:tier||HUMOR_TIERS[2][1],seed)(value,count,name):pick(HUMOR_ZERO[moment],seed)
 }
 // A primeira letra fica maiúscula quando a frase começa com o nome ou com o valor.
 body=body.charAt(0).toUpperCase()+body.slice(1)
 return{title:clip(title,60),body:clip(body,160),style:resolved}
}

// Avisos de venda no padrão dos gateways: só o status e o valor.
export function buildSaleNotification(status,amountCents,currency='BRL'){
 const value=new Intl.NumberFormat(currency==='USD'?'en-US':currency==='EUR'?'de-DE':'pt-BR',{style:'currency',currency}).format(amountCents/100)
 return{title:status==='approved'?'Venda aprovada!':'Venda pendente',body:`Valor: ${value}`}
}
