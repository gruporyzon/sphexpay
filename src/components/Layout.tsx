import { useEffect,useRef,useState } from 'react'
import { NavLink,Outlet,useLocation,useNavigate } from 'react-router-dom'
import { LogOut,Menu,PanelLeftClose,PanelLeftOpen,X } from 'lucide-react'
import { cn } from '../lib/utils'
import { NotificationBell } from './notifications/NotificationBell'
import { SearchInput } from './common/SearchInput'
import { ProfileMenu } from './profile/ProfileMenu'
import { SphexPayLogo } from './branding/SphexPayLogo'
import { useAuth } from '../hooks/useAuth'
import { useNotificationAudio } from '../hooks/useNotificationAudio'
import {competitionNavigation,navigationGroups,navigationItemForPath} from '../config/navigation'
import {MobileAppDock} from './mobile-navigation/MobileAppDock'

export function Layout(){
 useNotificationAudio()
 const [collapsed,setCollapsed]=useState(false),[mobile,setMobile]=useState(false)
 const menuButton=useRef<HTMLButtonElement>(null),closeButton=useRef<HTMLButtonElement>(null),wasMobile=useRef(false)
 const {signOut,user}=useAuth(),navigate=useNavigate(),loc=useLocation()
 const CompetitionIcon=competitionNavigation.icon
 const title=loc.pathname.startsWith('/app/configuracoes')?'Configurações':loc.pathname.startsWith(competitionNavigation.path)?competitionNavigation.label:navigationItemForPath(loc.pathname)?.label||'SphexPay',name=user?.user_metadata?.full_name||user?.email?.split('@')[0]||'Conta SphexPay'
 const logout=async(destination:'home'|'login'='home')=>{try{await signOut()}finally{navigate(destination==='login'?'/entrar':'/',{replace:true})}}
 useEffect(()=>{setMobile(false)},[loc.pathname])
 useEffect(()=>{const keydown=(event:KeyboardEvent)=>{if(event.key==='Escape')setMobile(false)};addEventListener('keydown',keydown);return()=>removeEventListener('keydown',keydown)},[])
 useEffect(()=>{
  if(!mobile){if(wasMobile.current)menuButton.current?.focus();wasMobile.current=false;return}
  const previousOverflow=document.body.style.overflow
  document.body.style.overflow='hidden'
  wasMobile.current=true
  closeButton.current?.focus()
  return()=>{document.body.style.overflow=previousOverflow}
 },[mobile])
 return <div className={cn('min-h-screen app-shell internal-app-shell',collapsed?'sidebar-collapsed':'sidebar-expanded')}>
  <aside id="app-navigation" aria-label="Menu principal" role={mobile?'dialog':undefined} aria-modal={mobile||undefined} className={cn('app-sidebar internal-sidebar fixed inset-y-0 left-0 z-50',collapsed?'w-[84px]':'w-[268px]',mobile&&'mobile-open')}>
   <div className="sidebar-brand"><SphexPayLogo showName={!collapsed||mobile} priority adaptiveTheme/><button className="btn btn-ghost icon-btn sidebar-collapse-toggle" onClick={()=>setCollapsed(value=>!value)} aria-label={collapsed?'Expandir menu lateral':'Recolher menu lateral'} aria-expanded={!collapsed} aria-controls="app-navigation">{collapsed?<PanelLeftOpen/>:<PanelLeftClose/>}</button><button ref={closeButton} onClick={()=>setMobile(false)} className="sidebar-mobile-close mobile-sidebar-close" aria-label="Fechar menu"><X/></button></div>
   <div className="competition-sidebar-slot"><NavLink to={competitionNavigation.path} aria-label={competitionNavigation.label} title={collapsed?competitionNavigation.label:undefined} onClick={()=>setMobile(false)} className={({isActive})=>cn('competition-sidebar-item',isActive&&'active')}><CompetitionIcon/><span>{competitionNavigation.label}<small>iPhone 17 Pro Max</small></span></NavLink></div>
   <nav className="sidebar-navigation scrollbar">{navigationGroups.map(group=><section className="sidebar-group" key={group.label}><span className="sidebar-group-label">{group.label}</span>{group.items.map(item=><NavLink key={item.path} to={item.path} end={item.exact} aria-label={item.label} title={collapsed?item.label:undefined} onClick={()=>setMobile(false)} className={({isActive})=>cn('sidebar-link',isActive&&'active')}><item.icon/><span>{item.label}</span></NavLink>)}</section>)}</nav>
   <footer className="sidebar-footer"><button className="btn btn-ghost sidebar-logout" onClick={()=>void logout()} aria-label="Sair da conta"><LogOut/><span>Sair</span></button></footer>
  </aside>
  {mobile&&<button className="app-menu-backdrop" aria-label="Fechar menu" onClick={()=>setMobile(false)}/>}<div className="app-viewport internal-main">
   <header className="app-header internal-topbar"><button ref={menuButton} className="btn btn-ghost icon-btn mobile-menu-toggle" aria-label={mobile?'Fechar menu':'Abrir menu'} aria-expanded={mobile} aria-controls="app-navigation" onClick={()=>setMobile(value=>!value)}><Menu/></button><SphexPayLogo className="header-brand" adaptiveTheme/><div className="internal-topbar-context"><span>SPHEX WORKSPACE</span><strong>{title}</strong></div><div className="mobile-page-title">{title}</div><SearchInput/><div className="header-actions"><NotificationBell/><ProfileMenu name={name} email={user?.email} onSignOut={logout}/></div></header>
   <main className="app-main internal-page-content"><Outlet/></main><MobileAppDock/>
  </div>
 </div>
}
