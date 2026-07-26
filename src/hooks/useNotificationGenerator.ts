import { useCallback,useEffect,useRef,useState } from 'react'
import { intervalMilliseconds,loadGeneratorData,saveGeneratorData,validateGenerator,type GeneratorConfig,type GeneratorHistory,type GeneratorPreset,type GeneratorStatus } from '../lib/notificationGenerator'
import { pushSubscriptionService } from '../services/pushSubscriptionService'

export function useNotificationGenerator(){
 const initial=useRef(loadGeneratorData())
 const [config,setConfig]=useState<GeneratorConfig>(initial.current.config),[history,setHistory]=useState<GeneratorHistory[]>(initial.current.history),[presets,setPresets]=useState<GeneratorPreset[]>(initial.current.presets)
 const [status,setStatus]=useState<GeneratorStatus>('completed'),[sent,setSent]=useState(0),[message,setMessage]=useState('')
 const timer=useRef<number|undefined>(undefined),scheduled=useRef<number|undefined>(undefined),runId=useRef(''),count=useRef(0),previousValue=useRef<number|undefined>(undefined),activeConfig=useRef(config),starting=useRef(false)
 useEffect(()=>{saveGeneratorData(config,history,presets)},[config,history,presets])
 const clearTimers=useCallback(()=>{if(timer.current)window.clearTimeout(timer.current);if(scheduled.current)window.clearTimeout(scheduled.current);timer.current=undefined;scheduled.current=undefined},[])
 useEffect(()=>clearTimers,[clearTimers])
 const patchHistory=useCallback((id:string,values:Partial<GeneratorHistory>)=>setHistory(items=>items.map(item=>item.id===id?{...item,...values}:item)),[])
 const deliver=useCallback(async(...args:[GeneratorConfig,number])=>{
  void args
  setMessage('Simulações financeiras não são enviadas ao dispositivo. Use o teste real de conexão.')
  return false
 },[])
 const finish=useCallback((finalStatus:GeneratorStatus,text:string)=>{clearTimers();setStatus(finalStatus);setMessage(text);patchHistory(runId.current,{sent:count.current,status:finalStatus})},[clearTimers,patchHistory])
 const tick=useCallback(async()=>{
  const current=activeConfig.current,index=count.current
  if(current.endAt&&Date.now()>new Date(current.endAt).getTime()){finish('completed','Período de envio concluído.');return}
  const ok=await deliver(current,index)
  if(!ok){finish('failed','Não foi possível enviar a notificação ao dispositivo.');return}
  count.current+=1;setSent(count.current);patchHistory(runId.current,{sent:count.current,status:'running'})
  if(!current.continuous&&count.current>=current.quantity){finish('completed','Sequência concluída.');return}
  timer.current=window.setTimeout(()=>void tick(),intervalMilliseconds(current))
 },[deliver,finish,patchHistory])
 const begin=useCallback(async(next=config)=>{
  if(starting.current||status==='running'||status==='scheduled'){setMessage('Já existe uma sequência em execução.');return false}
  starting.current=true
  try{
   const error=validateGenerator(next);if(error){setMessage(error);return false}
   if(typeof Notification!=='undefined'&&Notification.permission!=='granted'){setMessage('Ative as notificações neste dispositivo antes de iniciar.');return false}
   if(!(await pushSubscriptionService.current())){setMessage('Conecte um dispositivo antes de iniciar a sequência.');return false}
   clearTimers();activeConfig.current={...next};count.current=0;setSent(0);previousValue.current=undefined;runId.current=crypto.randomUUID?.()||String(Date.now())
   const item:GeneratorHistory={id:runId.current,createdAt:new Date().toISOString(),title:next.title,value:next.value,currency:next.currency,type:next.types[0],destination:next.destination,requested:next.continuous?0:next.quantity,sent:0,intervalMs:intervalMilliseconds(next),status:next.mode==='scheduled'?'scheduled':'running',config:{...next}}
   setHistory(items=>[item,...items].slice(0,100));setStatus(item.status);setMessage(item.status==='scheduled'?'Agendamento criado.':'Sequência iniciada.')
   if(next.mode==='scheduled'){const delay=new Date(next.startAt).getTime()-Date.now();scheduled.current=window.setTimeout(()=>{setStatus('running');void tick()},delay)}else void tick()
   return true
  }finally{starting.current=false}
 },[clearTimers,config,status,tick])
 const pause=()=>{if(status!=='running')return;clearTimers();setStatus('paused');patchHistory(runId.current,{status:'paused'});setMessage('Sequência pausada.')}
 const resume=()=>{if(status!=='paused')return;setStatus('running');patchHistory(runId.current,{status:'running'});setMessage('Sequência retomada.');void tick()}
 const stop=()=>{if(status!=='running'&&status!=='paused'&&status!=='scheduled')return;finish('cancelled','Sequência interrompida.')}
 const test=async()=>{if(status==='running'||status==='scheduled'){setMessage('Aguarde a sequência atual terminar.');return}const result=await pushSubscriptionService.sendTest();setMessage(result.message)}
 const savePreset=(name:string)=>{const clean=name.trim();if(!clean){setMessage('Informe um nome para o preset.');return}const preset:GeneratorPreset={id:crypto.randomUUID?.()||String(Date.now()),name:clean,createdAt:new Date().toISOString(),config:{...config}};setPresets(items=>[preset,...items]);setMessage('Preset salvo.')}
 const deletePreset=(id:string)=>setPresets(items=>items.filter(item=>item.id!==id))
 const duplicatePreset=(preset:GeneratorPreset)=>{const copy={...preset,id:crypto.randomUUID?.()||String(Date.now()),name:`${preset.name} — cópia`,createdAt:new Date().toISOString()};setPresets(items=>[copy,...items]);setMessage('Preset duplicado.')}
 return{config,setConfig,history,setHistory,presets,setPresets,status,sent,message,setMessage,begin,pause,resume,stop,test,savePreset,deletePreset,duplicatePreset}
}
