import type {DemoPaymentMethod,DemoTransaction,ModePushConfig,ModePushStats} from '../demo/types'
import type {PushSendResult} from '../services/pushSubscriptionService'

export type ModePushCommand={
 eventId:string
 notificationType:string
 title:string
 body:string
 currency:string
 target:'all'|'devices'|'desktop'|'mobile'
 deviceIds:string[]
}
type Task={sessionId:string;sale:DemoTransaction;config:ModePushConfig}
type Options={
 send:(command:ModePushCommand)=>Promise<PushSendResult>
 onStats?:(stats:ModePushStats)=>void
 now?:()=>number
 setTimer?:(callback:()=>void,delay:number)=>ReturnType<typeof setTimeout>
 clearTimer?:(timer:ReturnType<typeof setTimeout>)=>void
}
const blankStats=():ModePushStats=>({attempted:0,sent:0,failed:0,expired:0,skipped:0,lastSentAt:'',lastError:''})
const modeMethods=['Pix','Cartão de crédito','Boleto','Assinatura'] as const
const isModeMethod=(value:string):value is DemoPaymentMethod=>modeMethods.includes(value as DemoPaymentMethod)
const methodType:Record<DemoPaymentMethod,string>={'Pix':'pix_paid','Cartão de crédito':'credit_card_approved','Boleto':'boleto_paid','Assinatura':'subscription_approved'}
const methodLabel:Record<DemoPaymentMethod,string>={'Pix':'Pix','Cartão de crédito':'Cartão','Boleto':'Boleto','Assinatura':'Assinatura'}
const intervalFor=(frequency:ModePushConfig['frequency'])=>frequency==='5s'?5_000:frequency==='15s'?15_000:frequency==='60s'?60_000:0
const money=(cents:number,currency:string)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency}).format(cents/100)

export class ModePushQueue{
 private pending:Task[]=[]
 private processed=new Set<string>()
 private active=0
 private running=true
 private timer:ReturnType<typeof setTimeout>|null=null
 private summary:Task[]=[]
 private lastSentAt=0
 private lastVariant=-1
 private stats=blankStats()
 private readonly send:Options['send']
 private readonly onStats?:Options['onStats']
 private readonly now:()=>number
 private readonly setTimer:NonNullable<Options['setTimer']>
 private readonly clearTimer:NonNullable<Options['clearTimer']>
 constructor(options:Options){
  this.send=options.send;this.onStats=options.onStats;this.now=options.now??Date.now
  this.setTimer=options.setTimer??setTimeout;this.clearTimer=options.clearTimer??clearTimeout
 }
 start(){this.running=true;this.drain()}
 pause(){this.running=false;this.pending=[];this.summary=[];this.clearSummaryTimer()}
 resume(){this.start()}
 stop(){this.pause();this.processed.clear();this.lastSentAt=0;this.lastVariant=-1}
 reset(){this.stop();this.stats=blankStats();this.emit();this.running=true}
 markKnown(sessionId:string,sales:DemoTransaction[]){for(const sale of sales)this.processed.add(this.key(sessionId,sale))}
 enqueue(sessionId:string,sale:DemoTransaction,config:ModePushConfig){
  const key=this.key(sessionId,sale)
  if(this.processed.has(key)){this.skip();return false}
  this.processed.add(key)
  if(!config.enabled||!config.approved||sale.source!=='mode'||sale.status!=='approved'||!isModeMethod(sale.paymentMethod)||!config.methods.includes(sale.paymentMethod)){this.skip();return false}
  if(config.enabledAt&&new Date(sale.approvedAt??sale.updatedAt??sale.createdAt).getTime()<=new Date(config.enabledAt).getTime()){this.skip();return false}
  if(!this.running){this.skip();return false}
  if(this.stats.attempted+this.pending.length+this.summary.length>=config.maxPerSession){this.skip('Limite da sessão atingido.');return false}
  if((config.destination==='current'||config.destination==='selected')&&!config.deviceIds.length){this.skip('Nenhum dispositivo disponível para notificações.');return false}
  const task={sessionId,sale,config}
  if(config.frequency==='summary'){this.summary.push(task);this.scheduleSummary();return true}
  const interval=intervalFor(config.frequency)
  if(interval&&this.lastSentAt>0&&this.now()-this.lastSentAt<interval){this.skip();return false}
  if(this.pending.length>=100){this.skip('Limite seguro da fila atingido.');return false}
  this.pending.push(task);this.drain();return true
 }
 snapshot(){return{...this.stats}}
 private key(sessionId:string,sale:DemoTransaction){return`mode-sale:${sessionId}:${sale.eventId}`}
 private scheduleSummary(){
  if(this.timer)return
  this.timer=this.setTimer(()=>{this.timer=null;if(!this.running){this.summary=[];return}const tasks=this.summary.splice(0);if(!tasks.length)return;const first=tasks[0],last=tasks.at(-1)!,total=tasks.reduce((sum,item)=>sum+item.sale.amountCents,0),command=this.command(first,`${tasks.length} vendas aprovadas`,tasks.every(item=>item.sale.currency===first.sale.currency)?`Total do período: ${money(total,first.sale.currency)}`:`${tasks.length} recebimentos confirmados`,`summary-${last.sale.eventId}`);this.pending.push({...first,sale:{...first.sale,eventId:command.eventId}});this.drain(command)},15_000)
 }
 private drain(forced?:ModePushCommand){
  if(!this.running)return
  while(this.active<2&&this.pending.length){
   const task=this.pending.shift()!,command=forced??this.command(task)
   forced=undefined;this.active++;this.stats.attempted++;this.emit()
   void this.send(command).then(result=>{
    this.stats.sent+=result.sent??0;this.stats.failed+=result.failed??(result.ok?0:1);this.stats.expired+=result.expired??0
    if(result.ok){this.lastSentAt=this.now();this.stats.lastSentAt=new Date(this.now()).toISOString();this.stats.lastError=''}
    else this.stats.lastError=result.message??result.code??'Falha no envio.'
    if(result.httpStatus===401||result.httpStatus===403||result.httpStatus===429){this.running=false;this.pending=[];this.summary=[];this.clearSummaryTimer()}
   }).catch(()=>{this.stats.failed++;this.stats.lastError='Falha no envio.'}).finally(()=>{this.active--;this.emit();this.drain()})
  }
 }
 private command(task:Task,title?:string,body?:string,eventSuffix?:string):ModePushCommand{
  const {sale,sessionId,config}=task,method=isModeMethod(sale.paymentMethod)?sale.paymentMethod:'Pix',label=methodLabel[method],baseIndex=Math.abs([...sale.eventId].reduce((sum,char)=>sum+char.charCodeAt(0),0))%3,index=config.vary&&baseIndex===this.lastVariant?(baseIndex+1)%3:baseIndex
  if(config.vary)this.lastVariant=index
  const baseTitle=method==='Boleto'?'Boleto confirmado':method==='Assinatura'?'Assinatura aprovada':`Venda aprovada · ${label}`
  const titles=config.vary?[[baseTitle,`Pagamento confirmado · ${label}`,`Mais uma venda aprovada`][index]]:[baseTitle]
  const commission=sale.commissionCents??0,amount=commission>0?commission:sale.amountCents
  const bodies=config.vary?[commission>0?`Sua comissão: ${money(amount,sale.currency)}`:`Valor: ${money(amount,sale.currency)}`,`Valor confirmado: ${money(amount,sale.currency)}`,`Recebimento aprovado: ${money(amount,sale.currency)}`]:[commission>0?`Sua comissão: ${money(amount,sale.currency)}`:`Valor: ${money(amount,sale.currency)}`]
  return{eventId:`mode-sale:${sessionId}:${eventSuffix??sale.eventId}`,notificationType:methodType[method],title:title??titles[0],body:body??bodies[index],currency:sale.currency,target:config.destination==='all'?'all':config.destination==='desktop'?'desktop':config.destination==='mobile'?'mobile':'devices',deviceIds:[...config.deviceIds]}
 }
 private skip(message=''){this.stats.skipped++;if(message)this.stats.lastError=message;this.emit()}
 private emit(){this.onStats?.({...this.stats})}
 private clearSummaryTimer(){if(this.timer)this.clearTimer(this.timer);this.timer=null}
}
