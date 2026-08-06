import { useEffect,useRef,useState } from 'react'

export type DashboardDemoEvent={id:number;title:string;detail:string;amount?:number;status:'approved'|'processing'|'completed'}

const eventSequence:Omit<DashboardDemoEvent,'id'>[]=[
 {title:'Pagamento recebido',detail:'Pix · confirmado agora',amount:284.9,status:'approved'},
 {title:'Venda aprovada',detail:'Cartão · confirmação registrada',amount:179,status:'approved'},
 {title:'Status atualizado',detail:'Boleto · processamento concluído',amount:96.5,status:'completed'},
 {title:'Operação concluída',detail:'Pix · evento processado',amount:420,status:'completed'},
 {title:'Notificação registrada',detail:'Operação · acompanhamento ativo',status:'processing'},
 {title:'Transação processada',detail:'Cartão · status aprovado',amount:238.4,status:'approved'},
]

const initialEvents:DashboardDemoEvent[]=[
 {...eventSequence[0]!,id:3},
 {...eventSequence[1]!,id:2},
 {...eventSequence[2]!,id:1},
]

const metricSteps=[
 {revenue:24860.4,net:21418.2,sales:72,approval:94.7},
 {revenue:25145.3,net:21663.1,sales:73,approval:94.8},
 {revenue:25324.3,net:21817.05,sales:74,approval:94.9},
 {revenue:25744.3,net:22178.25,sales:75,approval:95.0},
 {revenue:25982.7,net:22383.27,sales:76,approval:95.1},
]

function reducedMotion(){return typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches}

export function useAnimatedDashboardValue(target:number,duration=900){
 const [value,setValue]=useState(target),current=useRef(target)
 useEffect(()=>{
  if(reducedMotion()){current.current=target;return}
  const from=current.current,start=performance.now()
  let frame=0
  const tick=(now:number)=>{
   const progress=Math.min((now-start)/duration,1),eased=1-Math.pow(1-progress,3)
   const next=from+(target-from)*eased
   current.current=next;setValue(next)
   if(progress<1)frame=requestAnimationFrame(tick)
  }
  frame=requestAnimationFrame(tick)
  return()=>cancelAnimationFrame(frame)
 },[duration,target])
 return value
}

export function useDashboardDemo(active=true){
 const [step,setStep]=useState(0),[events,setEvents]=useState(initialEvents),nextId=useRef(4)
 useEffect(()=>{
  if(!active||reducedMotion())return
  let sequenceIndex=3,exitTimer=0
  const timer=window.setInterval(()=>{
   setStep(value=>(value+1)%metricSteps.length)
   const source=eventSequence[sequenceIndex%eventSequence.length]??eventSequence[0]!
   const event={...source,id:nextId.current++}
   setEvents(items=>[event,...items].slice(0,4))
   window.clearTimeout(exitTimer)
   exitTimer=window.setTimeout(()=>setEvents(items=>items.slice(0,3)),650)
   sequenceIndex++
  },3800)
  return()=>{window.clearInterval(timer);window.clearTimeout(exitTimer)}
 },[active])
 return {metrics:metricSteps[step]??metricSteps[0]!,events,revision:step}
}
