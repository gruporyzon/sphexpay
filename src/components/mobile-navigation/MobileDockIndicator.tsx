import {useEffect,useRef,useState} from 'react'

const pathFor=(rawCenter:number,velocity=0)=>{const center=Math.max(50,Math.min(450,rawCenter)),stretch=Math.min(8,Math.abs(velocity)*1.4),left=center-32-stretch,right=center+32+stretch,lean=Math.max(-7,Math.min(7,velocity));return `M 8 60 H ${left-8} C ${left-2} 60 ${left+3} 57 ${left+8} 48 C ${left+16} 32 ${center-22+lean} 19 ${center+lean} 19 C ${center+22+lean} 19 ${right-16} 32 ${right-8} 48 C ${right-3} 57 ${right+2} 60 ${right+8} 60 H 492`}

export function MobileDockIndicator({index}:{index:number}){
 const target=50+index*100,[path,setPath]=useState(()=>pathFor(target)),position=useRef(target),velocity=useRef(0),frame=useRef(0)
 useEffect(()=>{cancelAnimationFrame(frame.current);let last=performance.now();const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduced){position.current=target;velocity.current=0;setPath(pathFor(target));return}const tick=(now:number)=>{const dt=Math.min(.032,(now-last)/1000);last=now;const force=(target-position.current)*360,damping=velocity.current*31;velocity.current+=(force-damping)*dt;position.current+=velocity.current*dt;setPath(pathFor(position.current,velocity.current/100));if(Math.abs(target-position.current)>.06||Math.abs(velocity.current)>.08)frame.current=requestAnimationFrame(tick);else{position.current=target;velocity.current=0;setPath(pathFor(target))}};frame.current=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame.current)},[target])
 return <svg className="mobile-dock-indicator" viewBox="0 0 500 78" preserveAspectRatio="none" aria-hidden="true"><path d={path}/></svg>
}
