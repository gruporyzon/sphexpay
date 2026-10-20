import {useEffect} from 'react'

const groups = [
 '.reference-navigation', '.reference-segments', '.workspace-segments', '.module-tabs',
 '.financial-module-tabs', '.reports-module-tabs', '.subscriptions-tabs', '.report-tabs',
 '.integration-tabs', '.notification-filters', '.kyc-tabs', '.push-tabs', '.pv2-tabs',
 '.vitrine-filters', '.social-tabs',
].join(',')
const activeSelector = ':scope > :is(button,a)[aria-pressed="true"],:scope > :is(button,a)[aria-selected="true"],:scope > :is(button,a)[aria-current="page"],:scope > :is(button,a).active'

/** A CSS pseudo-element supplies the moving pill without adding React-owned children. */
export function useSelectionMotion(){
 useEffect(()=>{
  const tracked=new Map<HTMLElement,HTMLElement|null>()
  let frame=0,disposed=false
  const resize=new ResizeObserver(()=>schedule())
  const measure=()=>{
   frame=0
   if(disposed)return
   const present=new Set(document.querySelectorAll<HTMLElement>(`.internal-app-shell :is(${groups})`))
   for(const [group,active] of tracked){if(!present.has(group)){resize.unobserve(group);if(active)resize.unobserve(active);tracked.delete(group)}}
   for(const group of present){
    if(!tracked.has(group)){tracked.set(group,null);resize.observe(group)}
    const active=group.querySelector<HTMLElement>(activeSelector)
    if(tracked.get(group)!==active){const previous=tracked.get(group);if(previous)resize.unobserve(previous);tracked.set(group,active);if(active)resize.observe(active)}
    group.dataset.selectionMotion='measuring'
    if(!active||!active.getBoundingClientRect().width){delete group.dataset.selectionMotion;continue}
    const box=group.getBoundingClientRect(),item=active.getBoundingClientRect()
    group.style.setProperty('--selection-x',`${item.left-box.left+group.scrollLeft-group.clientLeft}px`)
    group.style.setProperty('--selection-y',`${item.top-box.top+group.scrollTop-group.clientTop}px`)
    group.style.setProperty('--selection-width',`${item.width}px`)
    group.style.setProperty('--selection-height',`${item.height}px`)
    group.dataset.selectionMotion='ready'
   }
  }
  function schedule(){if(!frame&&!disposed)frame=requestAnimationFrame(measure)}
  const observer=new MutationObserver(schedule)
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-current','aria-pressed','aria-selected']})
  document.fonts?.ready.then(schedule)
  schedule()
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();for(const group of tracked.keys()){delete group.dataset.selectionMotion;for(const key of ['x','y','width','height'])group.style.removeProperty(`--selection-${key}`)}}
 },[])
}
