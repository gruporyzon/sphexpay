export type ManualSequenceStatus='idle'|'validating'|'preparing'|'running'|'paused'|'cancelling'|'completed'|'failed'|'cancelled'|'interrupted'

export type ManualAttemptResult={
 sent:number
 failed:number
 expired:number
 stop?:boolean
 message?:string
}

export type ManualSequenceSnapshot={
 sequenceId:string
 status:ManualSequenceStatus
 plannedCount:number
 attemptedCount:number
 sentCount:number
 failedCount:number
 expiredCount:number
 currentIndex:number
 remainingCount:number
 nextRunAt:number|null
 remainingDelayMs:number|null
}

type SchedulerOptions={
 sequenceId:string
 plannedCount:number
 intervalMs:number
 attempt:(index:number,eventId:string)=>Promise<ManualAttemptResult>
 onChange:(snapshot:ManualSequenceSnapshot,result?:ManualAttemptResult)=>void
 now?:()=>number
 setTimer?:(callback:()=>void,delay:number)=>ReturnType<typeof setTimeout>
 clearTimer?:(timer:ReturnType<typeof setTimeout>)=>void
}

export class ManualNotificationScheduler{
 private readonly options:SchedulerOptions
 private readonly now:()=>number
 private readonly setTimer:(callback:()=>void,delay:number)=>ReturnType<typeof setTimeout>
 private readonly clearTimer:(timer:ReturnType<typeof setTimeout>)=>void
 private timer:ReturnType<typeof setTimeout>|null=null
 private requestRunning=false
 private active=true
 private snapshot:ManualSequenceSnapshot

 constructor(options:SchedulerOptions){
  this.options=options
  this.now=options.now||Date.now
  this.setTimer=options.setTimer||setTimeout
  this.clearTimer=options.clearTimer||clearTimeout
  this.snapshot={
   sequenceId:options.sequenceId,status:'preparing',plannedCount:options.plannedCount,
   attemptedCount:0,sentCount:0,failedCount:0,expiredCount:0,currentIndex:0,
   remainingCount:options.plannedCount,nextRunAt:null,remainingDelayMs:null
  }
 }

 getSnapshot(){return{...this.snapshot}}

 start(){
  if(!this.active||this.requestRunning||this.snapshot.attemptedCount>0)return
  this.snapshot.status='running'
  this.emit()
  void this.execute()
 }

 pause(){
  if(!this.active||!['running'].includes(this.snapshot.status))return
  const remaining=this.snapshot.nextRunAt===null?this.options.intervalMs:Math.max(0,this.snapshot.nextRunAt-this.now())
  this.clearScheduledTimer()
  this.snapshot={...this.snapshot,status:'paused',nextRunAt:null,remainingDelayMs:remaining}
  this.emit()
 }

 resume(){
  if(!this.active||this.snapshot.status!=='paused')return
  const delay=Number.isFinite(this.snapshot.remainingDelayMs)&&this.snapshot.remainingDelayMs!==null&&this.snapshot.remainingDelayMs>=0
   ?this.snapshot.remainingDelayMs:this.options.intervalMs
  this.snapshot={...this.snapshot,status:'running',remainingDelayMs:null}
  this.emit()
  if(!this.requestRunning)this.schedule(delay)
 }

 cancel(){
  if(!this.active||['completed','failed','cancelled','interrupted'].includes(this.snapshot.status))return
  this.snapshot.status='cancelling'
  this.emit()
  this.active=false
  this.clearScheduledTimer()
  this.snapshot={...this.snapshot,status:'cancelled',nextRunAt:null,remainingDelayMs:null}
  this.emit()
 }

 interrupt(){
  if(!this.active||['completed','failed','cancelled','interrupted'].includes(this.snapshot.status))return
  this.active=false
  this.clearScheduledTimer()
  this.snapshot={...this.snapshot,status:'interrupted',nextRunAt:null,remainingDelayMs:null}
  this.emit()
 }

 private schedule(delay:number){
  if(!this.active||this.snapshot.status!=='running'||this.timer!==null)return
  const safeDelay=Math.max(0,delay)
  this.snapshot={...this.snapshot,nextRunAt:this.now()+safeDelay}
  this.emit()
  this.timer=this.setTimer(()=>{
   this.timer=null
   if(this.active&&this.snapshot.status==='running')void this.execute()
  },safeDelay)
 }

 private async execute(){
  if(!this.active||this.requestRunning||this.snapshot.status!=='running'||this.snapshot.attemptedCount>=this.snapshot.plannedCount)return
  this.requestRunning=true
  const index=this.snapshot.attemptedCount
  this.snapshot={...this.snapshot,currentIndex:index+1,nextRunAt:null}
  this.emit()
  let result:ManualAttemptResult
  try{result=await this.options.attempt(index,`${this.options.sequenceId}-${index+1}`)}
  catch{result={sent:0,failed:1,expired:0,message:'Falha inesperada no envio.'}}
  this.requestRunning=false
  if(!this.active)return
  const attemptedCount=this.snapshot.attemptedCount+1
  this.snapshot={
   ...this.snapshot,attemptedCount,sentCount:this.snapshot.sentCount+Math.max(0,result.sent),
   failedCount:this.snapshot.failedCount+Math.max(0,result.failed),
   expiredCount:this.snapshot.expiredCount+Math.max(0,result.expired),
   remainingCount:Math.max(0,this.snapshot.plannedCount-attemptedCount)
  }
  if(result.stop){
   this.active=false
   this.snapshot={...this.snapshot,status:'failed',nextRunAt:null}
  }else if(attemptedCount>=this.snapshot.plannedCount){
   this.active=false
   this.snapshot={...this.snapshot,status:'completed',nextRunAt:null}
  }
  this.emit(result)
  if(this.active&&this.snapshot.status==='running')this.schedule(this.options.intervalMs)
 }

 private clearScheduledTimer(){
  if(this.timer!==null){this.clearTimer(this.timer);this.timer=null}
 }

 private emit(result?:ManualAttemptResult){this.options.onChange({...this.snapshot},result)}
}
