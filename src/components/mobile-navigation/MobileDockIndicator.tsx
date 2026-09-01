import {useEffect,useRef,useState} from 'react'

const pathFor=(rawCenter:number,velocity=0)=>{
 const center=Math.max(50,Math.min(450,rawCenter))
 const stretch=Math.min(10,Math.abs(velocity)*1.6)
 const lean=Math.max(-6,Math.min(6,velocity))
 const left=center-52-stretch,right=center+52+stretch
 return `M ${left+28} 108 C ${left+9} 105 ${left+3} 95 ${left+13} 82 C ${left+20} 72 ${left+20} 56 ${left+31} 43 C ${left+41} 30 ${center-25+lean} 24 ${center+lean} 24 C ${center+25+lean} 24 ${right-41} 30 ${right-31} 43 C ${right-20} 56 ${right-20} 72 ${right-13} 82 C ${right-3} 95 ${right-9} 105 ${right-28} 108 Z`
}

export function MobileDockIndicator({index}:{index:number}){
 const target=50+index*100,[path,setPath]=useState(()=>pathFor(target)),position=useRef(target),velocity=useRef(0),frame=useRef(0)
 useEffect(()=>{cancelAnimationFrame(frame.current);let last=performance.now();const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduced){position.current=target;velocity.current=0;setPath(pathFor(target));return}const tick=(now:number)=>{const dt=Math.min(.032,(now-last)/1000);last=now;const force=(target-position.current)*360,damping=velocity.current*31;velocity.current+=(force-damping)*dt;position.current+=velocity.current*dt;setPath(pathFor(position.current,velocity.current/100));if(Math.abs(target-position.current)>.06||Math.abs(velocity.current)>.08)frame.current=requestAnimationFrame(tick);else{position.current=target;velocity.current=0;setPath(pathFor(target))}};frame.current=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame.current)},[target])
 return <svg className="mobile-dock-indicator" viewBox="0 0 500 110" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="mobile-dock-active-surface" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".98"/><stop offset="1" stopColor="currentColor" stopOpacity=".98"/></linearGradient></defs><path d={path}/></svg>
}
