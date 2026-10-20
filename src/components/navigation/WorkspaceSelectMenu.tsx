import {useCallback,useEffect,useId,useLayoutEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {useLocation} from 'react-router-dom'
import {Check} from 'lucide-react'
import {useAppLocale} from '../../i18n/localeStore'
import {useSelectionMotion} from './useSelectionMotion'

type Option={value:string;label:string;disabled:boolean;index:number;group:string}
type Menu={select:HTMLSelectElement;options:Option[];active:number;label:string;attributes:Record<string,string|null>}
const managedAttributes=['aria-expanded','aria-controls','aria-activedescendant']
const isEligible=(select:HTMLSelectElement)=>document.documentElement.dataset.topSurface==='app'&&!select.disabled&&!select.multiple&&select.size<=1&&!!select.closest('.internal-app-shell,.modal-surface,.pv2-wizard,.pv2-dialog,.affiliate-drawer,.withdrawal-modal-backdrop')&&!select.closest('.studio-canvas,.checkout-public,.checkout-experience,.co,[data-native-picker]')
const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase()
const selectLabel=(select:HTMLSelectElement)=>{
 const explicit=select.getAttribute('aria-label')
 if(explicit)return explicit
 const labelled=select.getAttribute('aria-labelledby')?.split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ').trim()
 if(labelled)return labelled
 return Array.from(select.labels||[]).map(label=>{const clone=label.cloneNode(true) as HTMLElement;clone.querySelectorAll('select,input,button').forEach(element=>element.remove());return clone.textContent?.trim()||''}).join(' ')
}
const closeAdvancedFilters=(outside?:Element|null)=>{for(const details of document.querySelectorAll<HTMLDetailsElement>('.internal-app-shell .reference-custom-period[open]'))if(!outside||!details.contains(outside))details.open=false}

/** Keeps the existing select, form values and React change handlers as the source of truth. */
export function WorkspaceSelectMenu(){
 useSelectionMotion()
 const {pathname}=useLocation(),locale=useAppLocale(state=>state.locale),id=useId()
 const [menu,setMenu]=useState<Menu|null>(null),current=useRef<Menu|null>(null),panel=useRef<HTMLDivElement>(null)
 const [position,setPosition]=useState({left:0,top:0,width:220,maxHeight:280,above:false,ready:false})
 const search=useRef({text:'',at:0})
 const close=useCallback(()=>{
  const previous=current.current
  if(previous)for(const attribute of managedAttributes){const value=previous.attributes[attribute];if(value===null)previous.select.removeAttribute(attribute);else previous.select.setAttribute(attribute,value)}
  current.current=null;setMenu(null)
 },[])
 const activate=useCallback((next:Menu)=>{
  current.current=next;setMenu(next)
  next.select.setAttribute('aria-expanded','true');next.select.setAttribute('aria-controls',id)
  if(next.active>=0)next.select.setAttribute('aria-activedescendant',`${id}-${next.active}`)
 },[id])
 const open=useCallback((select:HTMLSelectElement)=>{
  close()
  const options=Array.from(select.options).map((option,index)=>({value:option.value,label:option.label||option.text,disabled:option.disabled||(option.parentElement instanceof HTMLOptGroupElement&&option.parentElement.disabled),index,group:option.parentElement instanceof HTMLOptGroupElement?option.parentElement.label:''}))
  const selected=options.findIndex(option=>option.index===select.selectedIndex&&!option.disabled)
  const active=selected>=0?selected:options.findIndex(option=>!option.disabled)
  if(active<0)return
  setPosition(value=>({...value,ready:false}));search.current={text:'',at:0}
  select.focus({preventScroll:true})
  activate({select,options,active,label:selectLabel(select),attributes:Object.fromEntries(managedAttributes.map(attribute=>[attribute,select.getAttribute(attribute)]))})
 },[activate,close])
 const commit=useCallback((index:number)=>{
  const state=current.current,option=state?.options[index]
  if(!state||!option||option.disabled||!state.select.isConnected||state.select.disabled){close();return}
  const select=state.select,changed=select.value!==option.value
  // Dispatch the same native change React already handles; do not duplicate filter logic.
  select.value=option.value
  close()
  if(changed){select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}))}
  if(select.isConnected)select.focus({preventScroll:true})
 },[close])
 useEffect(()=>{
  const pointer=(event:PointerEvent)=>{
   const target=event.target instanceof Element?event.target:null
   if(panel.current?.contains(target))return
   closeAdvancedFilters(target)
   const label=target?.closest('label')
   const select=target?.closest('select')||(!target?.closest('button,a,input,textarea')?label?.control:null)
   if(select instanceof HTMLSelectElement&&isEligible(select)&&event.button===0){event.preventDefault();if(current.current?.select===select)close();else open(select)}else close()
  }
  const click=(event:MouseEvent)=>{
   const target=event.target instanceof Element?event.target:null
   const control=target?.closest('label')?.control
   // Label activation forwards a second native click unless its default is cancelled.
   if(control instanceof HTMLSelectElement&&isEligible(control)&&target!==control&&!target?.closest('button,a,input,textarea'))event.preventDefault()
  }
  const keydown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&!current.current){const open=document.querySelector<HTMLDetailsElement>('.internal-app-shell .reference-custom-period[open]');if(open){event.preventDefault();open.open=false;open.querySelector<HTMLElement>('summary')?.focus()}}
   const select=event.target
   if(!(select instanceof HTMLSelectElement)||!isEligible(select))return
   if(event.key==='Tab'){close();return}
   if(event.key==='Escape'){if(current.current){event.preventDefault();event.stopPropagation();close()}return}
   const state=current.current
   if(!state||state.select!==select){if(['ArrowDown','ArrowUp','Enter',' '].includes(event.key)){event.preventDefault();open(select)}return}
   if(['Enter',' '].includes(event.key)){event.preventDefault();commit(state.active);return}
   const enabled=state.options.filter(option=>!option.disabled).map(option=>option.index)
   if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
    event.preventDefault()
    const index=enabled.indexOf(state.active)
    const next=event.key==='Home'?enabled[0]:event.key==='End'?enabled.at(-1)!:enabled[(index+(event.key==='ArrowDown'?1:-1)+enabled.length)%enabled.length]
    activate({...state,active:next});return
   }
   if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
    event.preventDefault()
    const at=Date.now(),text=at-search.current.at<650?search.current.text+event.key:event.key
    search.current={text,at}
    const match=state.options.find(option=>!option.disabled&&normalize(option.label).startsWith(normalize(text)))
    if(match)activate({...state,active:match.index})
   }
  }
  const focus=(event:FocusEvent)=>{if(current.current&&event.target!==current.current.select&&!panel.current?.contains(event.target as Node))close()}
  document.addEventListener('pointerdown',pointer,true);document.addEventListener('click',click,true);document.addEventListener('keydown',keydown,true);document.addEventListener('focusin',focus)
  return()=>{document.removeEventListener('pointerdown',pointer,true);document.removeEventListener('click',click,true);document.removeEventListener('keydown',keydown,true);document.removeEventListener('focusin',focus);close()}
 },[activate,close,commit,open])
 useEffect(()=>{close()},[pathname,locale,close])
 const anchorSelect=menu?.select
 useLayoutEffect(()=>{
  if(!anchorSelect)return
  const select=anchorSelect
  let frame=0
  const place=()=>{
   if(!select.isConnected||select.disabled){close();return}
   const box=select.getBoundingClientRect(),viewport=window.visualViewport
   const leftEdge=viewport?.offsetLeft||0,topEdge=viewport?.offsetTop||0,width=viewport?.width||innerWidth,height=viewport?.height||innerHeight
   if(box.bottom<topEdge||box.top>topEdge+height){close();return}
   const anchor=select.closest<HTMLElement>('.internal-filter-select,.subscriptions-select,.vitrine-search')||select,anchorBox=anchor.getBoundingClientRect()
   const below=topEdge+height-anchorBox.bottom-14,above=anchorBox.top-topEdge-14,up=below<180&&above>below
   const maxHeight=Math.max(60,Math.min(280,(up?above:below)-8)),panelWidth=Math.min(Math.max(anchorBox.width,220),Math.min(420,width-28))
   const natural=panel.current?.scrollHeight||280,actualHeight=Math.min(natural,maxHeight)
   setPosition({left:Math.max(leftEdge+14,Math.min(anchorBox.left,leftEdge+width-panelWidth-14)),top:up?anchorBox.top-8-actualHeight:anchorBox.bottom+8,width:panelWidth,maxHeight,above:up,ready:true})
  }
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(place)}
  place()
  const resize=new ResizeObserver(schedule);resize.observe(select)
  window.addEventListener('resize',schedule);document.addEventListener('scroll',schedule,true);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule)
  return()=>{cancelAnimationFrame(frame);resize.disconnect();window.removeEventListener('resize',schedule);document.removeEventListener('scroll',schedule,true);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule)}
 },[anchorSelect,close])
 useLayoutEffect(()=>{panel.current?.querySelector<HTMLElement>(`[data-highlighted=true]`)?.scrollIntoView?.({block:'nearest'})},[menu?.active])
 if(!menu)return null
 return createPortal(<div ref={panel} id={id} role="listbox" aria-label={menu.label} className="workspace-select-menu" data-above={position.above} style={{left:position.left,top:position.top,width:position.width,maxHeight:position.maxHeight,visibility:position.ready?'visible':'hidden'}} onPointerDown={event=>event.preventDefault()}>
  {menu.options.map((option,index)=><div key={option.index}>
   {option.group&&option.group!==menu.options[index-1]?.group&&<div className="workspace-select-group" role="presentation">{option.group}</div>}
   <div role="option" id={`${id}-${option.index}`} aria-selected={menu.select.selectedIndex===option.index} aria-disabled={option.disabled||undefined} data-highlighted={menu.active===option.index} onPointerMove={()=>{if(!option.disabled&&current.current?.active!==option.index)activate({...menu,active:option.index})}} onClick={()=>commit(option.index)}><span>{option.label}</span><Check aria-hidden="true"/></div>
  </div>)}
 </div>,document.body)
}
