import { useCallback,useEffect,useRef,useState } from 'react'
import { supabase } from '../lib/supabase'
import { notificationRoutes,notificationTitles } from '../lib/notificationCatalog'
import { generatorBody,intervalMilliseconds,loadGeneratorData,saveGeneratorData,validateGenerator,variedValue,type GeneratorConfig,type GeneratorHistory,type GeneratorPreset,type GeneratorStatus } from '../lib/notificationGenerator'

export function useNotificationGenerator(){
 const initial=useRef(loadGeneratorData())
 const [config,setConfig]=useState<GeneratorConfig>(initial.current.config),[history,setHistory]=useState<GeneratorHistory[]>(initial.current.history),[presets,setPresets]=useState<GeneratorPreset[]>(initial.current.presets)
 const [status,setStatus]=useState<GeneratorStatus>('completed'),[sent,setSent]=useState(0),[message,setMessage]=useState('')
 const timer=useRef<number|undefined>(undefined),scheduled=useRef<number|undefined>(undefined),runId=useRef(''),count=useRef(0),previousValue=useRef<number|undefined>(undefined),activeConfig=useRef(config)
 useEffect(()=>{saveGeneratorData(config,history,presets)},[config,history,presets])
 const clearTimers=useCallback(()=>{if(timer.current)window.clearTimeout(timer.current);if(scheduled.current)window.clearTimeout(scheduled.current);timer.current=undefined;scheduled.current=undefined},[])
 useEffect(()=>clearTimers,[clearTimers])
 const patchHistory=useCallback((id:string,values:Partial<GeneratorHistory>)=>setHistory(items=>items.map(item=>item.id===id?{...item,...values}:item)),[])
 const deliver=useCallback(async(current:GeneratorConfig,index:number)=>{
  const type=current.rotateTypes?current.types[index%current.types.length]:current.types[0],value=variedValue(current,previousValue.current),currency=current.rotateCurrencies?(['BRL','USD','EUR'] as const)[index%3]:current.currency
  previousValue.current=value
  const payload={eventId:`generator-${runId.current}-${index}`,type,commission:value,currency,createdAt:new Date().toISOString(),route:notificationRoutes[type],title:current.rotateTypes?notificationTitles[type]:current.title,body:generatorBody(current,value,currency)}
  if(!supabase)return false
  const {error}=await supabase.functions.invoke('send-push',{body:payload})
  return !error
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
 const begin=useCallback((next=config)=>{
  const error=validateGenerator(next);if(error){setMessage(error);return false}
  clearTimers();activeConfig.current={...next};count.current=0;setSent(0);previousValue.current=undefined;runId.current=crypto.randomUUID?.()||String(Date.now())
  const item:GeneratorHistory={id:runId.current,createdAt:new Date().toISOString(),title:next.title,value:next.value,currency:next.currency,type:next.types[0],destination:next.destination,requested:next.continuous?0:next.quantity,sent:0,intervalMs:intervalMilliseconds(next),status:next.mode==='scheduled'?'scheduled':'running',config:{...next}}
  setHistory(items=>[item,...items].slice(0,100));setStatus(item.status);setMessage(item.status==='scheduled'?'Agendamento criado.':'Sequência iniciada.')
  if(next.mode==='scheduled'){const delay=new Date(next.startAt).getTime()-Date.now();scheduled.current=window.setTimeout(()=>{setStatus('running');void tick()},delay)}else void tick()
  return true
 },[clearTimers,config,tick])
 const pause=()=>{if(status!=='running')return;clearTimers();setStatus('paused');patchHistory(runId.current,{status:'paused'});setMessage('Sequência pausada.')}
 const resume=()=>{if(status!=='paused')return;setStatus('running');patchHistory(runId.current,{status:'running'});setMessage('Sequência retomada.');void tick()}
 const stop=()=>{if(status!=='running'&&status!=='paused'&&status!=='scheduled')return;finish('cancelled','Sequência interrompida.')}
 const test=async()=>{const testConfig={...config,quantity:1,mode:'single' as const,destination:'device' as const};activeConfig.current=testConfig;runId.current=`test-${Date.now()}`;previousValue.current=undefined;const ok=await deliver(testConfig,0);setMessage(ok?'Notificação enviada ao dispositivo.':'Não foi possível enviar a notificação ao dispositivo.')}
 const savePreset=(name:string)=>{const clean=name.trim();if(!clean){setMessage('Informe um nome para o preset.');return}const preset:GeneratorPreset={id:crypto.randomUUID?.()||String(Date.now()),name:clean,createdAt:new Date().toISOString(),config:{...config}};setPresets(items=>[preset,...items]);setMessage('Preset salvo.')}
 const deletePreset=(id:string)=>setPresets(items=>items.filter(item=>item.id!==id))
 const duplicatePreset=(preset:GeneratorPreset)=>{const copy={...preset,id:crypto.randomUUID?.()||String(Date.now()),name:`${preset.name} — cópia`,createdAt:new Date().toISOString()};setPresets(items=>[copy,...items]);setMessage('Preset duplicado.')}
 return{config,setConfig,history,setHistory,presets,setPresets,status,sent,message,setMessage,begin,pause,resume,stop,test,savePreset,deletePreset,duplicatePreset}
}
