import { useEffect } from 'react'

const motionSelector='[data-motion]'
const progressSelector='[data-scroll-progress]'
const clamp=(value:number,min=0,max=1)=>Math.min(max,Math.max(min,value))

export function useLandingMotion(){
 useEffect(()=>{
  const root=document.querySelector<HTMLElement>('.landing-redesign')
  if(!root)return
  const motionQuery=window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const desktopQuery=window.matchMedia?.('(min-width: 901px) and (hover: hover)')
  const reduced=motionQuery?.matches??false
  const motionElements=new Set<HTMLElement>()
  const progressElements=new Set<HTMLElement>()
  const hero=root.querySelector<HTMLElement>('.landing-hero')
  let frame=0
  let revealFrame=0
  let pointerX=0
  let pointerY=0

  const reveal=(element:HTMLElement)=>{element.dataset.motionState='visible'}
  const observer=reduced||typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{
   entries.forEach(entry=>{
    if(!entry.isIntersecting)return
    reveal(entry.target as HTMLElement)
    observer?.unobserve(entry.target)
   })
  },{threshold:.12,rootMargin:'0px 0px -8% 0px'})

  const register=(scope:ParentNode)=>{
   const elements=[...(scope instanceof HTMLElement&&scope.matches(motionSelector)?[scope]:[]),...scope.querySelectorAll<HTMLElement>(motionSelector)]
   elements.forEach(element=>{
    if(motionElements.has(element))return
    motionElements.add(element)
    if(reduced||!observer)reveal(element)
    else{element.dataset.motionState='pending';observer.observe(element)}
   })
   const progress=[...(scope instanceof HTMLElement&&scope.matches(progressSelector)?[scope]:[]),...scope.querySelectorAll<HTMLElement>(progressSelector)]
   progress.forEach(element=>progressElements.add(element))
  }

  const updateMotion=()=>{
   frame=0
   const viewport=Math.max(window.innerHeight,1)
   progressElements.forEach(element=>{
    const rect=element.getBoundingClientRect()
    const progress=clamp((viewport-rect.top)/(viewport+rect.height))
    element.style.setProperty('--scroll-progress',progress.toFixed(4))
    element.style.setProperty('--scroll-shift',((progress-.5)*2).toFixed(4))
    element.style.setProperty('--hero-scroll-y',`${((progress-.5)*-14).toFixed(2)}px`)
    if(element.classList.contains('editorial-flow'))element.dataset.activeStep=String(Math.max(1,Math.min(6,Math.ceil(progress*6))))
   })
   hero?.style.setProperty('--hero-pointer-x',`${(pointerX*5).toFixed(2)}px`)
   hero?.style.setProperty('--hero-pointer-y',`${(pointerY*3).toFixed(2)}px`)
   hero?.style.setProperty('--hero-glow-x',`${(pointerX*-5).toFixed(2)}px`)
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(updateMotion)}
  const handlePointerMove=(event:PointerEvent)=>{
   if(!hero||!desktopQuery?.matches)return
   const rect=hero.getBoundingClientRect()
   pointerX=clamp((event.clientX-rect.left)/Math.max(rect.width,1))*2-1
   pointerY=clamp((event.clientY-rect.top)/Math.max(rect.height,1))*2-1
   schedule()
  }
  const resetPointer=()=>{pointerX=0;pointerY=0;schedule()}

  register(root)
  if(!reduced&&observer){
   const heroElements=root.querySelectorAll<HTMLElement>('.landing-hero [data-motion]')
   revealFrame=requestAnimationFrame(()=>{
    revealFrame=requestAnimationFrame(()=>heroElements.forEach(element=>{reveal(element);observer.unobserve(element)}))
   })
  }
  const mutation=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node instanceof HTMLElement)register(node)})))
  mutation.observe(root,{childList:true,subtree:true})
  if(!reduced){
   addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true})
   hero?.addEventListener('pointermove',handlePointerMove,{passive:true});hero?.addEventListener('pointerleave',resetPointer);schedule()
  }else progressElements.forEach(element=>{element.style.setProperty('--scroll-progress','1');element.style.setProperty('--scroll-shift','0')})

  return()=>{
   observer?.disconnect();mutation.disconnect();cancelAnimationFrame(frame);cancelAnimationFrame(revealFrame)
   removeEventListener('scroll',schedule);removeEventListener('resize',schedule)
   hero?.removeEventListener('pointermove',handlePointerMove);hero?.removeEventListener('pointerleave',resetPointer)
  }
 },[])
}
