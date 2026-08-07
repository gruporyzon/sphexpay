import { useEffect,useRef,useState } from 'react'
import { NavLink,Outlet,useLocation,useNavigate } from 'react-router-dom'
import { ArrowLeftRight,Bell,ChevronDown,ChevronsLeft,ChevronsRight,Crown,FileBarChart,Landmark,LayoutDashboard,Link2,LogOut,Menu,Moon,Package,PanelTop,PlugZap,RadioTower,RefreshCcw,Settings,ShoppingBag,Sparkles,Store,Sun,Trophy,Users,WalletCards,X,type LucideIcon } from 'lucide-react'
import { cn } from '../lib/utils'
import { useDemoStore } from '../store/useDemoStore'
import { NotificationBell } from './notifications/NotificationBell'
import { SearchInput } from './common/SearchInput'
import { AvatarUploader } from './profile/AvatarUploader'
import { SphexPayLogo } from './branding/SphexPayLogo'
import { useAuth } from '../hooks/useAuth'
import { useNotificationAudio } from '../hooks/useNotificationAudio'
import { Dropdown } from './ui'

type NavItem=readonly [label:string,path:string,icon:LucideIcon]
type NavGroup={label:string;items:readonly NavItem[]}
const groups:readonly NavGroup[]=[
 {label:'Visão geral',items:[['Dashboard','/app',LayoutDashboard],['Vendas ao Vivo','/app/vendas-ao-vivo',RadioTower]]},
 {label:'Operação',items:[['Vendas','/app/vendas',ShoppingBag],['Transações','/app/transacoes',ArrowLeftRight],['Produtos','/app/produtos',Package],['Vitrine','/app/vitrine',Store],['Assinaturas','/app/assinaturas',RefreshCcw],['Clientes','/app/clientes',Users]]},
 {label:'Pagamentos',items:[['Checkout','/app/checkout',PanelTop],['Links de pagamento','/app/links',Link2],['Financeiro','/app/financeiro',Landmark],['Saques','/app/saques',WalletCards],['Integrações','/app/integracoes',PlugZap]]},
 {label:'Crescimento',items:[['Premiações','/app/premiacoes',Trophy],['Inteligência artificial','/app/assistente',Sparkles],['Relatórios','/app/relatorios',FileBarChart],['Notificações','/app/notificacoes',Bell],['Configurações','/app/configuracoes',Settings]]},
] as const
const items=groups.flatMap(group=>group.items)

export function Layout(){
 useNotificationAudio()
 const [collapsed,setCollapsed]=useState(true),[mobile,setMobile]=useState(false),[profileOpen,setProfileOpen]=useState(false)
 const menuButton=useRef<HTMLButtonElement>(null),profile=useRef<HTMLDivElement>(null),wasMobile=useRef(false)
 const {theme,setTheme}=useDemoStore(),{signOut,user}=useAuth(),navigate=useNavigate(),loc=useLocation()
 const title=items.find(item=>item[1]===loc.pathname)?.[0]||'SphexPay',name=user?.user_metadata?.full_name||user?.email?.split('@')[0]||'Conta SphexPay'
 const logout=async()=>{try{await signOut()}finally{navigate('/',{replace:true})}}
 useEffect(()=>{setMobile(false);setProfileOpen(false)},[loc.pathname])
 useEffect(()=>{const keydown=(event:KeyboardEvent)=>{if(event.key==='Escape'){setMobile(false);setProfileOpen(false)}};const pointer=(event:MouseEvent)=>{if(!profile.current?.contains(event.target as Node))setProfileOpen(false)};addEventListener('keydown',keydown);addEventListener('mousedown',pointer);return()=>{removeEventListener('keydown',keydown);removeEventListener('mousedown',pointer)}},[])
 useEffect(()=>{document.body.style.overflow=mobile?'hidden':'';if(wasMobile.current&&!mobile)menuButton.current?.focus();wasMobile.current=mobile;return()=>{document.body.style.overflow=''}},[mobile])
 return <div className={cn('min-h-screen app-shell internal-app-shell',collapsed&&'sidebar-collapsed')}>
  <aside id="app-navigation" aria-label="Menu principal" className={cn('app-sidebar internal-sidebar fixed inset-y-0 left-0 z-50 max-lg:-translate-x-full',collapsed?'w-[84px]':'w-[268px]',mobile&&'mobile-open')}>
   <div className="sidebar-brand"><SphexPayLogo showName={!collapsed} priority/><button onClick={()=>setMobile(false)} className="sidebar-mobile-close lg:hidden" aria-label="Fechar menu"><X/></button></div>
   <div className="competition-sidebar-slot"><NavLink to="/app/competicao" title={collapsed?'Competição':undefined} onClick={()=>setMobile(false)} className={({isActive})=>cn('competition-sidebar-item',isActive&&'active')}><Crown/>{!collapsed&&<span>Competição<small>iPhone 17 Pro Max</small></span>}</NavLink></div>
   <nav className="sidebar-navigation scrollbar">{groups.map(group=><section className="sidebar-group" key={group.label}>{!collapsed&&<span className="sidebar-group-label">{group.label}</span>}{group.items.map(([label,path,Icon])=><NavLink key={path} to={path} aria-label={label} title={collapsed?label:undefined} onClick={()=>setMobile(false)} className={({isActive})=>cn('sidebar-link',isActive&&'active')}><Icon/><span>{label}</span></NavLink>)}</section>)}</nav>
   <footer className="sidebar-footer"><button className="btn btn-ghost" onClick={logout} aria-label="Sair da conta"><LogOut/>{!collapsed&&<span>Sair</span>}</button><button className="btn btn-ghost sidebar-collapse-toggle" onClick={()=>setCollapsed(value=>!value)} aria-label={collapsed?'Expandir menu lateral':'Recolher menu lateral'} aria-expanded={!collapsed} aria-controls="app-navigation">{collapsed?<ChevronsRight/>:<><ChevronsLeft/><span>Recolher</span></>}</button></footer>
  </aside>
  {mobile&&<button className="app-menu-backdrop" aria-label="Fechar menu" onClick={()=>setMobile(false)}/>}<div className="app-viewport internal-main">
   <header className="app-header internal-topbar"><button ref={menuButton} className="btn btn-ghost icon-btn lg:hidden" aria-label="Abrir menu" aria-expanded={mobile} aria-controls="app-navigation" onClick={()=>setMobile(true)}><Menu/></button><SphexPayLogo className="header-brand"/><div className="internal-topbar-context"><span>SPHEX WORKSPACE</span><strong>{title}</strong></div><div className="mobile-page-title">{title}</div><SearchInput/><div className="header-actions"><button className="btn btn-ghost icon-btn" onClick={()=>setTheme(theme==='light'?'dark':'light')} aria-label="Alternar tema">{theme==='light'?<Moon/>:<Sun/>}</button><NotificationBell/><div className="header-profile-wrap" ref={profile}><div className="header-profile"><AvatarUploader compact/><button className="header-profile-trigger" aria-label="Abrir menu do perfil" aria-haspopup="menu" aria-expanded={profileOpen} onClick={()=>setProfileOpen(open=>!open)}><span><b>{name}</b><small>Player</small></span><ChevronDown className={profileOpen?'rotated':''}/></button></div><Dropdown open={profileOpen}><div className="profile-dropdown-head"><b>{name}</b><span>{user?.email}</span></div><button role="menuitem" onClick={()=>void logout()}><LogOut/> Sair da conta</button></Dropdown></div></div></header>
   <main className="app-main internal-page-content"><Outlet/></main>
  </div>
 </div>
}
