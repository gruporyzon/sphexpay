import {useEffect,useId,useRef,useState} from 'react'
import {useLocation} from 'react-router-dom'
import {Check,ChevronDown} from 'lucide-react'
import {appLanguages,useAppLocale,type AppLocale} from '../../i18n/localeStore'
import {useTranslation} from '../../i18n'
import {useHeaderMenu} from '../../hooks/useHeaderMenu'

export function LanguagePicker(){
 const locale=useAppLocale(state=>state.locale),setLocale=useAppLocale(state=>state.setLocale),{t}=useTranslation()
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),id=useId(),{pathname}=useLocation()
 const selected=appLanguages.find(language=>language.locale===locale)!
 useHeaderMenu('language',open,()=>setOpen(false))
 useEffect(()=>setOpen(false),[pathname])
 useEffect(()=>{
  if(!open)return
  menu.current?.querySelector<HTMLButtonElement>('[aria-checked=true]')?.focus()
  const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)}
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);trigger.current?.focus()}}
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape)
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}
 },[open])
 // Safari (iPhone e Mac) não dá foco a botão no toque: o blur chega sem relatedTarget e fechava o
 // menu antes do clique valer. Clique fora já fecha pelo pointerdown; o blur só fecha via teclado.
 const choose=(next:AppLocale)=>{setLocale(next);setOpen(false);trigger.current?.focus()}
 return <div className="workspace-language" ref={root} onBlur={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget))setOpen(false)}}>
  <button ref={trigger} type="button" className="workspace-language-trigger" aria-label={`${t('Idioma do aplicativo')}: ${selected.name}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>setOpen(value=>!value)} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true)}}}><img src={selected.flag} alt="" width="24" height="18"/><span>{selected.code}</span><ChevronDown aria-hidden="true"/></button>
  {open&&<div ref={menu} id={id} role="menu" aria-label={t('Idioma do aplicativo')} className="workspace-language-menu" onKeyDown={event=>{
   if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return
   event.preventDefault();const items=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=menuitemradio]')],index=items.indexOf(document.activeElement as HTMLButtonElement),next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus()
  }}>{appLanguages.map(language=><button key={language.locale} type="button" role="menuitemradio" aria-label={language.name} aria-checked={locale===language.locale} onClick={()=>choose(language.locale)}><img src={language.flag} alt="" width="24" height="18"/><span>{language.locale==='pt-BR'?<>Português<small>(Brasil)</small></>:language.name}</span><Check aria-hidden="true" className={locale===language.locale?'selected':''}/></button>)}</div>}
 </div>
}
