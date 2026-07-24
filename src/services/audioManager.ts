export type SphexSound='success'|'sale'|'alert'|'error'|'achievement'
export type AudioManagerState={
 enabled:boolean
 unlocked:boolean
 contextState:AudioContextState|'unavailable'
 lastError:string
}

const enabledKey='sphexpay_sound_enabled'
const mobile=()=>/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
const AudioContextClass=()=>window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext

type QueuedSound={kind:SphexSound;volume:number;key:string;priority:number;resolve:(played:boolean)=>void}

class AudioManager{
 private context?:AudioContext
 private master?:GainNode
 private queue:QueuedSound[]=[]
 private processing=false
 private listeners=new Set<()=>void>()
 private lastPlayed=new Map<string,number>()
 private state:AudioManagerState={
  enabled:typeof window!=='undefined'&&localStorage.getItem(enabledKey)==='true',
  unlocked:false,
  contextState:'unavailable',
  lastError:''
 }

 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener)}
 getSnapshot=()=>this.state
 isMobile=()=>mobile()
 getContext=()=>this.context
 async getContextForUserGesture(){
  const context=this.createContext()
  if(context?.state==='suspended')await context.resume()
  this.emit({unlocked:context?.state==='running'})
  return context
 }

 private emit(values:Partial<AudioManagerState>={}){
  this.state={...this.state,...values,contextState:this.context?.state||this.state.contextState}
  this.listeners.forEach(listener=>listener())
 }

 private createContext(){
  if(this.context?.state!=='closed')return this.context
  const Context=AudioContextClass()
  if(!Context){this.emit({contextState:'unavailable',lastError:'Web Audio não está disponível neste navegador.'});return undefined}
  this.context=new Context()
  this.master=this.context.createGain()
  this.master.gain.value=.8
  this.master.connect(this.context.destination)
  this.context.onstatechange=()=>this.emit({unlocked:this.context?.state==='running'})
  this.emit({contextState:this.context.state})
  return this.context
 }

 async activate(){
  this.emit({lastError:''})
  try{
   const context=this.createContext()
   if(!context)return false
   if(context.state==='suspended')await context.resume()
   if(context.state!=='running')throw new DOMException('O navegador manteve o áudio suspenso.','NotAllowedError')
   localStorage.setItem(enabledKey,'true')
   this.emit({enabled:true,unlocked:true,contextState:'running'})
   await this.render('success',.32)
   return true
  }catch(error){
   const name=error instanceof DOMException?error.name:'AudioError'
   this.emit({unlocked:false,lastError:name==='NotAllowedError'?'Áudio bloqueado pelo navegador. Toque novamente para ativar.':'Não foi possível ativar o áudio neste dispositivo.'})
   return false
  }
 }

 disable(){
  localStorage.setItem(enabledKey,'false')
  this.queue.splice(0).forEach(item=>item.resolve(false))
  this.emit({enabled:false,lastError:''})
 }

 async ensureAudioReady(fromUserGesture=false){
  if(!this.state.enabled)return false
  if(!this.context||this.context.state==='closed'){
   if(!fromUserGesture)return false
   this.createContext()
  }
  try{
   if(this.context?.state==='suspended')await this.context.resume()
   const ready=this.context?.state==='running'
   this.emit({unlocked:ready,lastError:ready?'':'Áudio suspenso. Toque em Reativar áudio.'})
   return ready
  }catch(error){
   const blocked=error instanceof DOMException&&error.name==='NotAllowedError'
   this.emit({unlocked:false,lastError:blocked?'Áudio bloqueado pelo navegador. Toque em Reativar áudio.':'Falha ao retomar o áudio.'})
   return false
  }
 }

 play(kind:SphexSound,volume=.35,key:string=kind,priority=1){
  return new Promise<boolean>(resolve=>{
   if(!this.state.enabled){resolve(false);return}
   const now=Date.now(),last=this.lastPlayed.get(key)||0
   if(now-last<800){resolve(false);return}
   this.lastPlayed.set(key,now)
   if(this.queue.length>=8){
    const removed=this.queue.pop()
    removed?.resolve(false)
   }
   this.queue.push({kind,volume:Math.min(.65,Math.max(0,volume)),key,priority,resolve})
   this.queue.sort((a,b)=>b.priority-a.priority)
   void this.drain()
  })
 }

 async test(kind:SphexSound='success',volume=.35){
  const ready=await this.ensureAudioReady(true)||await this.activate()
  if(!ready)return false
  return this.render(kind,volume)
 }

 private async drain(){
  if(this.processing)return
  this.processing=true
  while(this.queue.length){
   const item=this.queue.shift()!
   const ready=await this.ensureAudioReady(false)
   item.resolve(ready?await this.render(item.kind,item.volume):false)
   await new Promise(resolve=>window.setTimeout(resolve,180))
  }
  this.processing=false
 }

 private async render(kind:SphexSound,volume:number){
  const context=this.context,output=this.master
  if(!context||!output||context.state!=='running')return false
  const patterns:Record<SphexSound,Array<[number,number,number]>>={
   success:[[620,0,.09],[820,.08,.15]],
   sale:[[520,0,.08],[720,.07,.14],[940,.13,.2]],
   alert:[[460,0,.11],[460,.16,.25]],
   error:[[310,0,.12],[220,.11,.25]],
   achievement:[[520,0,.1],[760,.09,.17],[1040,.16,.3]]
  }
  const start=context.currentTime+.006
  try{
   patterns[kind].forEach(([frequency,offset,end])=>{
    const oscillator=context.createOscillator(),gain=context.createGain()
    oscillator.type=kind==='error'?'triangle':'sine'
    oscillator.frequency.setValueAtTime(frequency,start+offset)
    gain.gain.setValueAtTime(.001,start+offset)
    gain.gain.exponentialRampToValueAtTime(Math.max(.001,volume*.12),start+offset+.018)
    gain.gain.exponentialRampToValueAtTime(.001,start+end)
    oscillator.connect(gain).connect(output)
    oscillator.start(start+offset)
    oscillator.stop(start+end+.015)
   })
   return true
  }catch{
   this.emit({lastError:'Não foi possível reproduzir o som interno.'})
   return false
  }
 }

 vibrate(pattern:number[]=[180,80,180]){
  if('vibrate'in navigator)return navigator.vibrate(pattern)
  return false
 }

 diagnostics(){
  const standalone=matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone)
  const synth='speechSynthesis'in window?window.speechSynthesis:undefined
  const data={mobile:mobile(),standalone,audioContextState:this.context?.state||'not-created',soundEnabled:this.state.enabled,notificationPermission:'Notification'in window?Notification.permission:'unsupported',speechSynthesisSupported:Boolean(synth),voicesCount:synth?.getVoices().length||0}
  console.info('SphexPay audio diagnostics',data)
  return data
 }

 dispose(){
  this.queue.splice(0).forEach(item=>item.resolve(false))
 }
}

export const audioManager=new AudioManager()
