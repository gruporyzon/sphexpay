import {useEffect,useRef,useState} from 'react'

const VIEWBOX_WIDTH=500
const SLOT_WIDTH=VIEWBOX_WIDTH/5
const BASELINE=68
const ARC_TOP=8
const RESTING_HALF_WIDTH=49

const mobileDockCenter=(index:number)=>SLOT_WIDTH*index+SLOT_WIDTH/2

const indicatorPath=(center:number,velocity=0)=>{
 const speed=Math.min(11,Math.abs(velocity)*.018)
 const lean=Math.max(-5,Math.min(5,velocity*.008))
 const halfWidth=RESTING_HALF_WIDTH+speed
 const left=center-halfWidth
 const right=center+halfWidth
 const crownLeft=center-22-speed*.18+lean
 const crownRight=center+22+speed*.18+lean

 return [
  `M 1 ${BASELINE}`,
  `L ${left-7} ${BASELINE}`,
  `C ${left-1} ${BASELINE} ${left+1} ${BASELINE-2} ${left+4} ${BASELINE-8}`,
  `C ${left+10} ${BASELINE-20} ${left+9} 27 ${crownLeft} 15`,
  `C ${crownLeft+8} 10 ${center-10+lean} ${ARC_TOP} ${center+lean} ${ARC_TOP}`,
  `C ${center+10+lean} ${ARC_TOP} ${crownRight-8} 10 ${crownRight} 15`,
  `C ${right-9} 27 ${right-10} ${BASELINE-20} ${right-4} ${BASELINE-8}`,
  `C ${right-1} ${BASELINE-2} ${right+1} ${BASELINE} ${right+7} ${BASELINE}`,
  `L ${VIEWBOX_WIDTH-1} ${BASELINE}`,
 ].join(' ')
}

export function MobileDockIndicator({index}:{index:number}){
 const target=mobileDockCenter(index)
 const [path,setPath]=useState(()=>indicatorPath(target))
 const position=useRef(target),velocity=useRef(0),frame=useRef(0)

 useEffect(()=>{
  cancelAnimationFrame(frame.current)
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches
  if(reduced){position.current=target;velocity.current=0;setPath(indicatorPath(target));return}

  let last=performance.now()
  const tick=(now:number)=>{
   const dt=Math.min(.032,(now-last)/1000)
   last=now
   const force=(target-position.current)*285
   const damping=velocity.current*25
   velocity.current+=(force-damping)*dt
   position.current+=velocity.current*dt
   setPath(indicatorPath(position.current,velocity.current))

   if(Math.abs(target-position.current)>.04||Math.abs(velocity.current)>.06)frame.current=requestAnimationFrame(tick)
   else{position.current=target;velocity.current=0;setPath(indicatorPath(target))}
  }
  frame.current=requestAnimationFrame(tick)
  return()=>cancelAnimationFrame(frame.current)
 },[target])

 return <svg className="mobile-dock-indicator" viewBox="0 0 500 78" preserveAspectRatio="none" aria-hidden="true"><path d={path} fill="none" pathLength="500"/></svg>
}
