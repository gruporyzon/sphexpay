import { useCallback,useEffect,useRef,useState } from 'react'
import { Link,useLocation } from 'react-router-dom'
import { House,Landmark,Package,ShoppingBag,UserRound,type LucideIcon } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { remainingTabBarNavigation } from '../../config/navigation'
import { useActiveSeller } from '../../hooks/useActiveSeller'
import { useProfilePhoto } from '../../hooks/useProfilePhoto'
import { memberCanOpen } from '../../lib/teamAccess'
import { tapFeedback } from '../../lib/tapFeedback'
import { demoNotificationToApp,useOptionalDashboardData } from '../../providers/DashboardDataProvider'
import { useUserNotifications } from '../../services/userNotificationService'
import { useTabBarPreferences } from '../../store/useTabBarPreferences'
import { HIDDEN,useMobileViewport } from './MobileFloatingNav'
import { MobileMoreSheet } from './MobileMoreSheet'
import './mobile-navigation.css'
import './mobile-tab-bar.css'

// Barra do celular em cápsula de vidro flutuante, com cinco elementos só de ícone: quatro módulos e a foto
// do perfil, que abre "Mais módulos" e mostra o número de avisos não lidos. Uma pílula desliza até a aba
// ativa. Transparência, esconder ao rolar e vibração são ajustáveis em Configurações → Preferências.
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

// Some ao descer a tela e volta ao subir; vale para a janela e para áreas com rolagem própria.
function useHideOnScroll(enabled:boolean,pathname:string){
 const [hidden,setHidden]=useState(false),positions=useRef(new WeakMap<object,number>())
 useEffect(()=>{setHidden(false)},[pathname,enabled])
 useEffect(()=>{
  if(!enabled)return
  const onScroll=(event:Event)=>{
   const target=event.target,element=target instanceof Element?target:null,key=element??window
   const y=element?element.scrollTop:window.scrollY,last=positions.current.get(key)??y
   positions.current.set(key,y)
   if(y<40){setHidden(false);return}
   if(y-last>6)setHidden(true)
   else if(last-y>6)setHidden(false)
  }
  document.addEventListener('scroll',onScroll,{capture:true,passive:true})
  return()=>document.removeEventListener('scroll',onScroll,{capture:true})
 },[enabled])
 return hidden
}

function useUnreadCount(){
 const regular=useUserNotifications(state=>state.items),demo=useOptionalDashboardData()
 const [social,setSocial]=useState(0)
 useEffect(()=>{const update=(event:Event)=>setSocial(Number((event as CustomEvent<number>).detail)||0);window.addEventListener('social:unread',update);return()=>window.removeEventListener('social:unread',update)},[])
 const demoUnread=demo?.active?demo.notifications.map(demoNotificationToApp).filter(item=>!item.read).length:0
 return regular.filter(item=>!item.read&&!item.archived).length+demoUnread+social
}

function TabBar({navigationRoot}:{navigationRoot:string}){
 const {t}=useTranslation(),{pathname}=useLocation(),role=useActiveSeller().workspace?.role
 const {transparency,hideOnScroll}=useTabBarPreferences()
 const photo=useProfilePhoto().url,unread=useUnreadCount()
 const [more,setMore]=useState(false)
 const path=pathname.startsWith(navigationRoot)?`/app${pathname.slice(navigationRoot.length)}`:pathname
 const inSocial=path==='/app/social'||path.startsWith('/app/social/')
 const hidden=useHideOnScroll(hideOnScroll&&!more,pathname)
 const close=useCallback(()=>setMore(false),[])
 useEffect(()=>setMore(false),[pathname])
 // Com o teclado aberto a barra sai da frente para não cobrir os campos.
 useEffect(()=>{const viewport=window.visualViewport;if(!viewport)return;const update=()=>{document.documentElement.toggleAttribute('data-mobile-keyboard',window.innerHeight-viewport.height>150)};viewport.addEventListener('resize',update);update();return()=>{viewport.removeEventListener('resize',update);document.documentElement.removeAttribute('data-mobile-keyboard')}},[])
 if(inSocial||HIDDEN.test(path))return null
 const tabs=TABS.filter(tab=>memberCanOpen(role,tab.to))
 const routeIndex=tabs.findIndex(tab=>isActive(tab,path))
 // A foto fica em destaque quando "Mais" está aberto ou a tela atual é de um módulo que está lá.
 const activeIndex=more||routeIndex<0?tabs.length:routeIndex
 const target=(to:string)=>to.replace(/^\/app/,navigationRoot)
 const toggleMore=()=>{tapFeedback();if(more){if(history.state?.mobileMore)history.back();else setMore(false)}else setMore(true)}
 const badge=unread>99?'99+':String(unread)
 return <>
  <nav className={`mobile-tab-bar${hidden?' is-hidden':''}`} aria-label={t('Navegação principal')} style={{'--tab-count':tabs.length+1,'--tab-index':activeIndex,'--tb-alpha':(.94-transparency/100*.66).toFixed(3)} as React.CSSProperties}>
   <span className="mobile-tab-pill" aria-hidden="true"/>
   {tabs.map((tab,index)=>{
    const active=index===activeIndex,label=t(tab.label)
    return <Link key={tab.id} to={target(tab.to)} className={`mobile-tab${active?' is-active':''}`} aria-label={label} aria-current={active?'page':undefined} onClick={tapFeedback}>
     <tab.icon aria-hidden="true"/>
    </Link>
   })}
   <button type="button" className={`mobile-tab mobile-tab-profile${activeIndex===tabs.length?' is-active':''}`} aria-label={t('Mais módulos')} aria-haspopup="dialog" aria-expanded={more} aria-current={routeIndex<0&&!more?'page':undefined} onClick={toggleMore}>
    <span className="mobile-tab-avatar">{photo?<img src={photo} alt=""/>:<UserRound aria-hidden="true"/>}</span>
    {unread>0&&<b className="mobile-tab-badge" aria-label={t('{count} não lidas',{count:unread})}>{badge}</b>}
   </button>
  </nav>
  <MobileMoreSheet open={more} onClose={close} navigationRoot={navigationRoot} items={remainingTabBarNavigation}/>
 </>
}
