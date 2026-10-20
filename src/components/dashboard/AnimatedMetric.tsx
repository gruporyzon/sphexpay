import { useEffect,useRef,useState } from 'react'

export function AnimatedMetric({value,format}:{value:number;format:(value:number)=>string}){
 const previous=useRef(value),[display,setDisplay]=useState(value)
 useEffect(()=>{
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||previous.current===value){previous.current=value;setDisplay(value);return}
  const from=previous.current,to=value,start=performance.now(),duration=380
  let frame=0
  const tick=(now:number)=>{const progress=Math.min(1,(now-start)/duration),eased=1-Math.pow(1-progress,3);previous.current=from+(to-from)*eased;setDisplay(previous.current);if(progress<1)frame=requestAnimationFrame(tick);else previous.current=to}
  frame=requestAnimationFrame(tick)
  return()=>cancelAnimationFrame(frame)
 },[value])
 return <>{format(display)}</>
}
