import { useEffect } from 'react'

const selector='[data-motion]'

export function useLandingMotion(){
 useEffect(()=>{
  const root=document.querySelector<HTMLElement>('.landing-redesign')
  if(!root)return
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches
  const motionElements=new Set<HTMLElement>()
  const progressElements=new Set<HTMLElement>()
  let frame=0

  const reveal=(element:HTMLElement)=>element.dataset.motionState='visible'
  const observer=reduced?null:new IntersectionObserver(entries=>{
   entries.forEach(entry=>{
    if(!entry.isIntersecting)return
    reveal(entry.target as HTMLElement)
    observer?.unobserve(entry.target)
   })
  },{threshold:.12,rootMargin:'0px 0px -8% 0px'})

  const register=(scope:ParentNode)=>{
   const elements=[...(scope instanceof HTMLElement&&scope.matches(selector)?[scope]:[]),...scope.querySelectorAll<HTMLElement>(selector)]
   elements.forEach(element=>{
    if(motionElements.has(element))return
    motionElements.add(element)
    if(reduced)reveal(element);else observer?.observe(element)
   })
   const progress=[...(scope instanceof HTMLElement&&scope.matches('[data-scroll-progress]')?[scope]:[]),...scope.querySelectorAll<HTMLElement>('[data-scroll-progress]')]
   progress.forEach(element=>progressElements.add(element))
  }

  const updateProgress=()=>{
   frame=0
   const viewport=innerHeight
   progressElements.forEach(element=>{
    const rect=element.getBoundingClientRect()
    const range=viewport+rect.height
    const progress=Math.max(0,Math.min(1,(viewport-rect.top)/range))
    element.style.setProperty('--scroll-progress',progress.toFixed(4))
    element.style.setProperty('--scroll-shift',`${((progress-.5)*2).toFixed(4)}`)
    if(element.classList.contains('editorial-flow'))element.dataset.activeStep=String(Math.max(1,Math.min(6,Math.ceil(progress*6))))
   })
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(updateProgress)}

  register(root)
  root.querySelectorAll<HTMLElement>('.landing-hero [data-motion]').forEach(reveal)
  const mutation=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node instanceof HTMLElement)register(node)})))
  mutation.observe(root,{childList:true,subtree:true})
  if(!reduced){addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});schedule()}
  else progressElements.forEach(element=>{element.style.setProperty('--scroll-progress','1');element.style.setProperty('--scroll-shift','0')})

  return()=>{
   observer?.disconnect();mutation.disconnect();cancelAnimationFrame(frame)
   removeEventListener('scroll',schedule);removeEventListener('resize',schedule)
  }
 },[])
}
