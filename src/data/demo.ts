import type { DemoState } from '../types'
import { revenueAwards } from '../config/revenueAwards'

const d=(days:number,h=12)=>new Date(Date.now()-days*86400000+h*3600000).toISOString()
export const initialData:DemoState={
 storageVersion:5,revenue:284750,available:124820.40,pending:38920.80,goal:350000,period:{preset:'30d'},liveSales:true,theme:'light',themePreference:'light',
 notifications:[
  {id:'NTF-18',kind:'security',category:'Segurança',title:'Aviso de segurança',description:'Revise os dispositivos com acesso autorizado à sua conta.',createdAt:d(0,11),read:false,detailPath:'/configuracoes'},
  {id:'NTF-17',kind:'goal',category:'Sistema',title:'Meta de faturamento alcançada',description:'A meta configurada para o período foi alcançada.',createdAt:d(0,10),read:false,detailPath:'/'},
  {id:'NTF-13',kind:'system',category:'Sistema',title:'Atualização importante da plataforma',description:'Melhorias de desempenho e segurança foram aplicadas à sua conta.',createdAt:d(0,9),read:false,detailPath:'/configuracoes'},
  {id:'NTF-09',kind:'achievement',category:'Sistema',title:'Nova conquista desbloqueada',description:'O marco de R$ 100 mil em faturamento foi alcançado.',createdAt:d(1,8),read:true,detailPath:'/premiacoes'},
  {id:'NTF-08',kind:'security',category:'Segurança',title:'Acesso em novo dispositivo',description:'Um novo acesso foi identificado em São Paulo, Brasil.',createdAt:d(2,6),read:true,detailPath:'/configuracoes'},
 ],
 preferences:{
  notifications:{internal:false,device:false,sales:true,withdrawals:true,subscriptions:true,security:true,achievements:true,sound:false,vibration:false,frequency:'realtime',groupSimilar:true,muteRepeated:true,priorityApproved:true,priorityPix:true,priorityCard:true,saleApproved:true,pixGenerated:true,cardApproved:true,subscriptionEvents:true,withdrawalEvents:true,soundVolume:.35,soundStyle:'signal',quietHours:false,quietFrom:'22:00',quietTo:'07:00',doNotDisturb:false,importantOnly:false},
  assistant:{microphone:true,readAloud:true,voice:'',voiceGender:'female',language:'pt-BR',speechRate:.96,pitch:1.04,volume:1,interruptOnSend:true,autoSendVoice:false},
  sales:{automaticUpdates:true,updateFrequency:18,saleSound:false,showNotifications:false,recentCount:7},
  mobileNavigation:{opacity:82}
 },
 sales:[
  {id:'SPX-84291',customer:'Marina Costa',email:'marina@example.local',product:'Scale Pro',amount:1297,currency:'BRL',method:'Pix',status:'Aprovado',date:d(0,8),country:'Brasil',fee:25.94},
  {id:'SPX-84290',customer:'Lucas Andrade',email:'lucas@example.local',product:'Growth Club',amount:497,currency:'BRL',method:'Cartão de crédito',status:'Aprovado',date:d(0,7),country:'Brasil',fee:19.88},
  {id:'SPX-84289',customer:'Sophie Martin',email:'sophie@example.local',product:'Global Masterclass',amount:189,currency:'EUR',method:'Cartão de crédito',status:'Em análise',date:d(0,6),country:'França',fee:7.56},
  {id:'SPX-84288',customer:'Mateo García',email:'mateo@example.local',product:'Growth Club',amount:89,currency:'USD',method:'Assinatura',status:'Aprovado',date:d(1),country:'Estados Unidos',fee:3.56},
  {id:'SPX-84287',customer:'Beatriz Lima',email:'bia@example.local',product:'Creator Lab',amount:697,currency:'BRL',method:'Boleto',status:'Pendente',date:d(1,2),country:'Brasil',fee:6.9},
  {id:'SPX-84286',customer:'James Wilson',email:'james@example.local',product:'Global Masterclass',amount:249,currency:'USD',method:'Cartão de crédito',status:'Recusado',date:d(2),country:'Estados Unidos',fee:0},
  {id:'SPX-84285',customer:'Ana Souza',email:'ana@example.local',product:'Scale Pro',amount:1297,currency:'BRL',method:'Pix',status:'Reembolsado',date:d(3),country:'Brasil',fee:25.94}
 ],
 products:[
  {id:'PRD-01',name:'Scale Pro',description:'Programa avançado de escala digital',price:1297,billing:'Única',active:true,sales:128,revenue:166016,color:'#f15a24'},
  {id:'PRD-02',name:'Growth Club',description:'Comunidade e encontros mensais',price:497,billing:'Recorrente',monthly:497,annual:4970,active:true,sales:96,revenue:47712,color:'#0f172a'},
  {id:'PRD-03',name:'Creator Lab',description:'Formação completa para creators',price:697,billing:'Única',active:true,sales:74,revenue:51578,color:'#fb923c'},
  {id:'PRD-04',name:'Global Masterclass',description:'Masterclass internacional',price:249,billing:'Única',active:false,sales:52,revenue:12948,color:'#64748b'}
 ],
 customers:[
  {id:'CUS-01',name:'Marina Costa',email:'marina@example.local',phone:'+55 11 99999-1010',country:'Brasil',spent:7890,purchases:7,lastPurchase:d(0),products:['Scale Pro','Growth Club'],status:'Ativo'},
  {id:'CUS-02',name:'Lucas Andrade',email:'lucas@example.local',phone:'+55 21 99999-2020',country:'Brasil',spent:4970,purchases:10,lastPurchase:d(0),products:['Growth Club'],status:'Ativo'},
  {id:'CUS-03',name:'Sophie Martin',email:'sophie@example.local',phone:'+33 6 00 00 00',country:'França',spent:1890,purchases:4,lastPurchase:d(1),products:['Global Masterclass'],status:'Ativo'},
  {id:'CUS-04',name:'Mateo García',email:'mateo@example.local',phone:'+1 305 555 0101',country:'Estados Unidos',spent:1068,purchases:12,lastPurchase:d(1),products:['Growth Club'],status:'Ativo'}
 ],
 subscriptions:[
  {id:'SUB-01',customer:'Lucas Andrade',plan:'Growth Club',status:'Ativa',amount:497,nextCharge:d(-8)},
  {id:'SUB-02',customer:'Mateo García',plan:'Growth Club Global',status:'Ativa',amount:89,nextCharge:d(-12)},
  {id:'SUB-03',customer:'Carla Mendes',plan:'Growth Club',status:'Período gratuito',amount:497,nextCharge:d(-5)},
  {id:'SUB-04',customer:'John Carter',plan:'Growth Club Global',status:'Inadimplente',amount:89,nextCharge:d(2)}
 ],
 chart:Array.from({length:30},(_,i)=>{const revenue=Math.round(6500+Math.sin(i/2)*2600+i*180+((i*791)%2400));return{label:`${String(i+1).padStart(2,'0')}/07`,revenue,profit:Math.round(revenue*.72),sales:Math.round(revenue/380)}}),
 achievements:revenueAwards.map(award=>({id:award.id,title:award.name,target:award.target,image:award.image,order:award.order,description:award.description,glow:award.glow,redeemed:false})),
 withdrawals:[]
}

const seeded=(seed:number)=>{let value=seed|0;return()=>{value=Math.imul(value^value>>>15,1|value);value^=value+Math.imul(value^value>>>7,61|value);return((value^value>>>14)>>>0)/4294967296}}
export const newLiveSale=(seed=Date.now()):DemoState['sales'][number]=>{
 const random=seeded(seed)
 const names=['Camila Rocha','Diego Santos','Emily Johnson','Alejandro Ruiz','Claire Dubois','Marta Rossi']; const countries=['Brasil','Brasil','Estados Unidos','Espanha','França','Itália'];
 const i=Math.floor(random()*names.length),amounts=[497,697,89,249,189,229],currencies=(['BRL','BRL','USD','EUR','EUR','EUR'] as const),statuses=(['Aprovado','Aprovado','Aprovado','Pendente','Em análise','Recusado'] as const),status=statuses[Math.floor(random()*statuses.length)]
 return {id:`SPX-${seed.toString(36)}-${Math.floor(random()*1679616).toString(36).padStart(4,'0')}`,customer:names[i],email:'cliente@example.local',product:['Growth Club','Creator Lab','Growth Club','Global Masterclass','Global Masterclass','Creator Lab'][i],amount:amounts[i],currency:currencies[i],method:(['Pix','Cartão de crédito','Assinatura','Cartão de crédito','Cartão de crédito','Boleto'] as const)[i],status,date:new Date(seed).toISOString(),country:countries[i],fee:status==='Aprovado'?amounts[i]*.03:0}
}
