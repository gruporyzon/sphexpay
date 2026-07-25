import { useEffect,useRef,useState } from 'react'

export function AnimatedMetric({value,format}:{value:number;format:(value:number)=>string}){
 const previous=useRef(value),[display,setDisplay]=useState(value)
 useEffect(()=>{
  const from=previous.current,to=value,start=performance.now(),duration=560
  let frame=0
  const tick=(now:number)=>{const progress=Math.min(1,(now-start)/duration),eased=1-Math.pow(1-progress,3);setDisplay(from+(to-from)*eased);if(progress<1)frame=requestAnimationFrame(tick);else previous.current=to}
  frame=requestAnimationFrame(tick)
  return()=>cancelAnimationFrame(frame)
 },[value])
 return <>{format(display)}</>
}
