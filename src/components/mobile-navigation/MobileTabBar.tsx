import { useCallback,useEffect,useState } from 'react'
import { Link,useLocation } from 'react-router-dom'
import { Grid2X2,House,Landmark,Package,ShoppingBag,type LucideIcon } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { remainingTabBarNavigation } from '../../config/navigation'
import { useActiveSeller } from '../../hooks/useActiveSeller'
import { memberCanOpen } from '../../lib/teamAccess'
import { tapFeedback } from '../../lib/tapFeedback'
import { HIDDEN,useMobileViewport } from './MobileFloatingNav'
import { MobileMoreSheet } from './MobileMoreSheet'
import './mobile-navigation.css'
import './mobile-tab-bar.css'

// Barra de abas fixa no rodapé do celular, no estilo dos apps de delivery: ícone sobre o nome, aba ativa
// em destaque, ponto de aviso e toque com vibração e clique. As quatro primeiras abas navegam direto; "Mais"
// abre a folha com os demais módulos. No Social o menu flutuante do Social assume o lugar da barra.
type Tab={id:string;label:string;icon:LucideIcon;to:string;exact?:boolean}
const TABS:Tab[]=[
 {id:'home',label:'Início',icon:House,to:'/app',exact:true},
 {id:'sales',label:'Vendas',icon:ShoppingBag,to:'/app/vendas'},
 {id:'finance',label:'Financeiro',icon:Landmark,to:'/app/financeiro'},
 {id:'products',label:'Produtos',icon:Package,to:'/app/produtos'},
]

const isActive=(tab:Tab,path:string)=>tab.exact?path===tab.to:path===tab.to||path.startsWith(`${tab.to}/`)

export function MobileTabBar({navigationRoot='/app'}:{navigationRoot?:string}){
 const mobile=useMobileViewport()
 return mobile?<TabBar navigationRoot={navigationRoot}/>:null
}

function TabBar({navigationRoot}:{navigationRoot:string}){
 const {t}=useTranslation(),{pathname}=useLocation(),role=useActiveSeller().workspace?.role
 const [more,setMore]=useState(false),[unread,setUnread]=useState(0)
 const path=pathname.startsWith(navigationRoot)?`/app${pathname.slice(navigationRoot.length)}`:pathname
 const inSocial=path==='/app/social'||path.startsWith('/app/social/')
 const close=useCallback(()=>setMore(false),[])
 useEffect(()=>setMore(false),[pathname])
 useEffect(()=>{const update=(event:Event)=>setUnread(Number((event as CustomEvent<number>).detail)||0);window.addEventListener('social:unread',update);return()=>window.removeEventListener('social:unread',update)},[])
 // Com o teclado aberto a barra sai da frente para não cobrir os campos.
 useEffect(()=>{const viewport=window.visualViewport;if(!viewport)return;const update=()=>{document.documentElement.toggleAttribute('data-mobile-keyboard',window.innerHeight-viewport.height>150)};viewport.addEventListener('resize',update);update();return()=>{viewport.removeEventListener('resize',update);document.documentElement.removeAttribute('data-mobile-keyboard')}},[])
 if(inSocial||HIDDEN.test(path))return null
 const tabs=TABS.filter(tab=>memberCanOpen(role,tab.to))
 const activeIndex=tabs.findIndex(tab=>isActive(tab,path))
 // "Mais" fica em destaque quando a folha está aberta ou quando a tela atual é de um módulo que está nela.
 const moreActive=more||activeIndex<0
 const target=(to:string)=>to.replace(/^\/app/,navigationRoot)
 const toggleMore=()=>{tapFeedback();if(more){if(history.state?.mobileMore)history.back();else setMore(false)}else setMore(true)}
 return <>
  <nav className="mobile-tab-bar" aria-label={t('Navegação principal')} style={{'--tab-count':tabs.length+1} as React.CSSProperties}>
   {tabs.map((tab,index)=>{
    const active=index===activeIndex&&!more,label=t(tab.label)
    return <Link key={tab.id} to={target(tab.to)} className={`mobile-tab${active?' is-active':''}`} aria-label={label} aria-current={active?'page':undefined} onClick={tapFeedback}>
     <span className="mobile-tab-icon"><tab.icon aria-hidden="true"/></span><span>{label}</span>
    </Link>
   })}
   <button type="button" className={`mobile-tab${moreActive?' is-active':''}`} aria-label={t('Mais módulos')} aria-haspopup="dialog" aria-expanded={more} aria-current={activeIndex<0&&!more?'page':undefined} onClick={toggleMore}>
    <span className="mobile-tab-icon"><Grid2X2 aria-hidden="true"/>{unread>0&&<b className="mobile-tab-dot" aria-hidden="true"/>}</span><span>{t('Mais')}</span>
   </button>
  </nav>
  <MobileMoreSheet open={more} onClose={close} navigationRoot={navigationRoot} items={remainingTabBarNavigation}/>
 </>
}
