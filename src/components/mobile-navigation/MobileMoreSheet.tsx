import {translate as uiText} from '../../i18n'
import {useAppLocale} from '../../i18n/localeStore'
import {T} from '../../i18n'
import {useCallback,useEffect,useRef,useState} from 'react'
import {Settings,X} from 'lucide-react'
import {useNavigate} from 'react-router-dom'
import {remainingMobileNavigation} from '../../config/navigation'

const EXIT_DURATION=380

export function MobileMoreSheet({open,onClose,navigationRoot='/app'}:{open:boolean;onClose:()=>void;navigationRoot?:string}){useAppLocale(state=>state.locale);
 const navigate=useNavigate(),sheet=useRef<HTMLElement>(null),startY=useRef(0),[drag,setDrag]=useState(0),[present,setPresent]=useState(open),[closing,setClosing]=useState(false)
 const close=useCallback(()=>history.state?.mobileMore?history.back():onClose(),[onClose])

 useEffect(()=>{
  if(open){setPresent(true);setClosing(false);return}
  if(!present)return
  setClosing(true)
  const timer=window.setTimeout(()=>{setPresent(false);setClosing(false);setDrag(0)},EXIT_DURATION)
  return()=>window.clearTimeout(timer)
 },[open,present])
 useEffect(()=>{
  if(!present)return
  const previous=document.body.style.overflow
  document.body.style.overflow='hidden'
  return()=>{document.body.style.overflow=previous}
 },[present])
 useEffect(()=>{
  if(!open)return
  history.pushState({...history.state,mobileMore:true},'')
  const pop=()=>onClose()
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();close();return}
   if(event.key!=='Tab'||!sheet.current)return
   const focusable=[...sheet.current.querySelectorAll<HTMLElement>('button,[href],[tabindex]:not([tabindex="-1"])')].filter(element=>!element.hasAttribute('disabled'))
   if(!focusable.length){event.preventDefault();sheet.current.focus();return}
   const first=focusable[0],last=focusable.at(-1)!
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }
  addEventListener('popstate',pop,{once:true})
  addEventListener('keydown',key)
  const previousFocus=document.activeElement as HTMLElement|null
  requestAnimationFrame(()=>sheet.current?.focus())
  return()=>{removeEventListener('popstate',pop);removeEventListener('keydown',key);previousFocus?.focus()}
 },[close,onClose,open])

 if(!present)return null
 const go=(path:string)=>{if(history.state?.mobileMore)history.replaceState({...history.state,mobileMore:false},'');onClose();navigate(path.replace(/^\/app/,navigationRoot))}
 return <div className={`mobile-more-layer${closing?' is-closing':''}`}><button className="mobile-more-backdrop" aria-label={uiText("Fechar mais módulos")} onClick={close}/><section ref={sheet} className="mobile-more-sheet" role="dialog" aria-modal="true" aria-label={uiText("Mais módulos")} tabIndex={-1} style={{'--sheet-drag':`${drag}px`} as React.CSSProperties}><div className="mobile-more-handle" aria-hidden="true" onPointerDown={event=>{startY.current=event.clientY;setDrag(0);event.currentTarget.setPointerCapture(event.pointerId)}} onPointerMove={event=>{if(startY.current)setDrag(Math.max(0,event.clientY-startY.current))}} onPointerUp={()=>{if(drag>84)close();else setDrag(0);startY.current=0}}/><header><button className="workspace-more-close" aria-label={uiText("Fechar módulos")} onClick={close}><X/></button><span><T>SPHEXPAY</T></span><h2><T>Mais módulos</T></h2><p><T>Acesse todas as áreas disponíveis da sua operação.</T></p></header><nav className="mobile-more-grid" aria-label={uiText("Outros módulos")}>{remainingMobileNavigation.map((item,index)=><button key={item.id} aria-label={item.label} style={{'--module-index':index} as React.CSSProperties} onClick={()=>go(item.path)}><item.icon/><span><T>{item.label}</T></span><small>{item.group}</small></button>)}</nav><button className="workspace-more-settings" onClick={()=>go('/app/configuracoes')}><Settings/><T>Configurações</T></button></section></div>
}
