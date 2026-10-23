import { useEffect,useLayoutEffect,useRef,useState } from 'react'
import { Link,useLocation } from 'react-router-dom'
import { ArrowLeft,Bell,Compass,House,Landmark,LayoutDashboard,MessageCircle,PenLine,RadioTower,type LucideIcon } from 'lucide-react'
import { useTranslation } from '../../i18n'
import './floating-nav.css'

// Menu flutuante do celular: três atalhos (Vendas ao Vivo, Dashboard no centro e Financeiro). Dentro do
// Social ele se transforma na navegação do Social, com a opção de sair; ao sair, volta ao padrão.
type Item={id:string;label:string;icon:LucideIcon;to?:string;exact?:boolean;action?:'compose';tone?:'exit'|'primary'}
const MAIN:Item[]=[
 {id:'live',label:'Vendas ao Vivo',icon:RadioTower,to:'/app/vendas-ao-vivo'},
 {id:'dashboard',label:'Dashboard',icon:LayoutDashboard,to:'/app',exact:true},
 {id:'finance',label:'Financeiro',icon:Landmark,to:'/app/financeiro'},
]
const SOCIAL:Item[]=[
 {id:'exit',label:'Sair do modo social',icon:ArrowLeft,tone:'exit'},
 {id:'feed',label:'Feed',icon:House,to:'/app/social',exact:true},
 {id:'explore',label:'Explorar',icon:Compass,to:'/app/social/explore'},
 {id:'compose',label:'Publicar',icon:PenLine,action:'compose',tone:'primary'},
 {id:'notifications',label:'Notificações',icon:Bell,to:'/app/social/notifications'},
 {id:'messages',label:'Mensagens',icon:MessageCircle,to:'/app/social/messages'},
]
export const MOBILE_NAV_QUERY='(max-width:767px)'
const SWAP_MS=230
// Telas de edição em tela cheia já têm barras próprias no rodapé.
const HIDDEN=/\/checkout\/[^/]+\/(builder|preview)$/

const isActive=(item:Item,path:string)=>!!item.to&&(item.exact?path===item.to:path===item.to||path.startsWith(`${item.to}/`))

function useMobileViewport(){
 const [mobile,setMobile]=useState(()=>typeof matchMedia==='function'&&matchMedia(MOBILE_NAV_QUERY).matches)
 useEffect(()=>{if(typeof matchMedia!=='function')return;const media=matchMedia(MOBILE_NAV_QUERY),sync=()=>setMobile(media.matches);sync();media.addEventListener?.('change',sync);return()=>media.removeEventListener?.('change',sync)},[])
 return mobile
}

export function MobileFloatingNav({navigationRoot='/app'}:{navigationRoot?:string}){
 const mobile=useMobileViewport()
 return mobile?<FloatingNav navigationRoot={navigationRoot}/>:null
}

function FloatingNav({navigationRoot}:{navigationRoot:string}){
 const {t}=useTranslation(),{pathname}=useLocation()
 const path=pathname.startsWith(navigationRoot)?`/app${pathname.slice(navigationRoot.length)}`:pathname
 const mode=path==='/app/social'||path.startsWith('/app/social/')?'social':'main'
 // A troca de modo acontece em duas etapas: os ícones saem, o menu muda de tamanho e os novos entram.
 const [shown,setShown]=useState(mode),[phase,setPhase]=useState<'idle'|'out'|'in'>('idle')
 useEffect(()=>{
  if(mode===shown)return
  setPhase('out')
  const swap=window.setTimeout(()=>{setShown(mode);setPhase('in')},SWAP_MS),settle=window.setTimeout(()=>setPhase('idle'),SWAP_MS+620)
  return()=>{clearTimeout(swap);clearTimeout(settle)}
 },[mode,shown])
 // Ao sair do Social, volta para onde a pessoa estava antes de entrar.
 const lastMain=useRef('/app')
 useEffect(()=>{if(mode==='main')lastMain.current=path},[mode,path])
 const [unread,setUnread]=useState(0)
 useEffect(()=>{const update=(event:Event)=>setUnread(Number((event as CustomEvent<number>).detail)||0);window.addEventListener('social:unread',update);return()=>window.removeEventListener('social:unread',update)},[])
 const items=shown==='social'?SOCIAL:MAIN
 const activeIndex=items.findIndex(item=>isActive(item,path))
 const bar=useRef<HTMLDivElement>(null),[pill,setPill]=useState<{x:number;w:number}|null>(null)
 useLayoutEffect(()=>{
  const place=()=>{const button=bar.current?.querySelectorAll<HTMLElement>('[data-nav-item]')[activeIndex];setPill(button?{x:button.offsetLeft,w:button.offsetWidth}:null)}
  place()
  if(typeof ResizeObserver!=='function'||!bar.current)return
  const observer=new ResizeObserver(place);observer.observe(bar.current);return()=>observer.disconnect()
 },[activeIndex,shown,phase])
 if(HIDDEN.test(path))return null
 const target=(to:string)=>to.replace(/^\/app/,navigationRoot)
 return <nav className={`floating-nav is-${shown} phase-${phase}`} aria-label={t(shown==='social'?'Navegação do Social':'Atalhos do painel')} style={{'--nav-count':items.length} as React.CSSProperties}>
  <div className="floating-nav-bar" ref={bar}>
   <span className="floating-nav-pill" aria-hidden="true" data-visible={pill?'true':'false'} style={pill?{transform:`translateX(${pill.x}px)`,width:pill.w}:undefined}/>
   {items.map((item,index)=>{
    const active=index===activeIndex,label=t(item.label),style={'--i':index} as React.CSSProperties
    const content=<><item.icon aria-hidden="true"/>{item.id==='notifications'&&unread>0&&<b className="floating-nav-badge">{unread>99?'99+':unread}</b>}</>
    const className=`floating-nav-item${active?' is-active':''}${item.tone?` is-${item.tone}`:''}`
    if(item.action==='compose')return <button key={`${shown}-${item.id}`} data-nav-item type="button" className={className} style={style} aria-label={label} title={label} onClick={()=>window.dispatchEvent(new Event('social:compose'))}>{content}</button>
    const to=item.tone==='exit'?target(lastMain.current):target(item.to!)
    return <Link key={`${shown}-${item.id}`} data-nav-item to={to} className={className} style={style} aria-label={label} title={label} aria-current={active?'page':undefined}>{content}</Link>
   })}
  </div>
 </nav>
}
