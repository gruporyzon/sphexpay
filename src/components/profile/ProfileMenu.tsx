import { useEffect,useRef,useState } from 'react'
import { ArrowLeft,Check,ChevronRight,LayoutDashboard,LogOut,Palette,PenLine,RefreshCw,Settings,ShoppingBag } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ThemePreference } from '../../types'
import { useDemoStore } from '../../store/useDemoStore'
import { ProfileAvatar } from './ProfileAvatar'

type Props={name:string;email?:string;onSignOut:(destination:'home'|'login')=>Promise<void>}
const appearances:readonly [ThemePreference,string][]=[['light','Modo claro'],['dark','Modo escuro'],['system','Seguir preferência do sistema']]

export function ProfileMenu({name,email,onSignOut}:Props){
 const [open,setOpen]=useState(false),[appearanceOpen,setAppearanceOpen]=useState(false),[mobileView,setMobileView]=useState(false),[submenuSide,setSubmenuSide]=useState<'left'|'right'>('left')
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),firstItem=useRef<HTMLButtonElement>(null),appearanceItem=useRef<HTMLButtonElement>(null)
 const navigate=useNavigate(),themePreference=useDemoStore(state=>state.themePreference),setTheme=useDemoStore(state=>state.setTheme)
 const close=(restore=false)=>{setOpen(false);setAppearanceOpen(false);setMobileView(false);if(restore)requestAnimationFrame(()=>trigger.current?.focus())}
 const go=(path:string)=>{close();navigate(path)}
 const chooseTheme=(preference:ThemePreference)=>{setTheme(preference);if(window.innerWidth<=767){setMobileView(false)}else setAppearanceOpen(false);requestAnimationFrame(()=>appearanceItem.current?.focus())}
 const openAppearance=()=>{if(window.innerWidth<=767){setMobileView(true);return}const rect=appearanceItem.current?.getBoundingClientRect();setSubmenuSide(rect&&rect.left>=300?'left':'right');setAppearanceOpen(true)}
 useEffect(()=>{if(themePreference!=='system')return;const media=window.matchMedia('(prefers-color-scheme: dark)'),sync=()=>setTheme('system');media.addEventListener?.('change',sync);return()=>media.removeEventListener?.('change',sync)},[setTheme,themePreference])
 useEffect(()=>{if(!open)return;const pointer=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))close()};const keyboard=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();if(mobileView){setMobileView(false);requestAnimationFrame(()=>appearanceItem.current?.focus())}else close(true)}};addEventListener('pointerdown',pointer);addEventListener('keydown',keyboard);requestAnimationFrame(()=>firstItem.current?.focus());return()=>{removeEventListener('pointerdown',pointer);removeEventListener('keydown',keyboard)}},[open,mobileView])
 return <div className="profile-menu-root" ref={root}>
  <button ref={trigger} type="button" className="profile-menu-trigger" aria-label="Abrir menu do perfil" aria-haspopup="menu" aria-expanded={open} onClick={()=>{setOpen(value=>!value);setAppearanceOpen(false);setMobileView(false)}}><ProfileAvatar/><span><b>{name}</b><small>Player</small></span><ChevronRight className={open?'open':''}/></button>
  {open&&<div className="profile-menu" role="menu" aria-label="Menu do perfil">
   {mobileView?<AppearancePanel mobile active={themePreference} onBack={()=>{setMobileView(false);requestAnimationFrame(()=>appearanceItem.current?.focus())}} onSelect={chooseTheme}/>:<>
    <header className="profile-menu-head"><span><b>{name}</b>{email&&<small>{email}</small>}</span><button ref={firstItem} type="button" aria-label="Editar perfil" title="Editar perfil" onClick={()=>go('/app/configuracoes?secao=Perfil')}><PenLine/></button></header>
    <section className="profile-menu-section" aria-label="Conta de produtor"><button type="button" role="menuitem" onClick={()=>go('/app')}><LayoutDashboard/><span>Dashboard de produtor</span></button><button type="button" role="menuitem" onClick={()=>go('/app/configuracoes')}><Settings/><span>Configurações</span></button><button ref={appearanceItem} type="button" role="menuitem" aria-haspopup="menu" aria-expanded={appearanceOpen} className={appearanceOpen?'active':''} onMouseEnter={openAppearance} onClick={openAppearance}><Palette/><span>Aparência</span><ChevronRight className="profile-menu-chevron"/></button></section>
    <section className="profile-menu-section" aria-label="Acessos"><button type="button" role="menuitem" onClick={()=>go('/app/vendas')}><ShoppingBag/><span>Acessar minhas compras</span></button><button type="button" role="menuitem" onClick={()=>{close();void onSignOut('login')}}><RefreshCw/><span>Acessar outra conta</span></button></section>
    <section className="profile-menu-section profile-menu-footer"><button type="button" role="menuitem" onClick={()=>{close();void onSignOut('home')}}><LogOut/><span>Sair da conta</span></button></section>
    {appearanceOpen&&<div className={`profile-appearance-submenu submenu-${submenuSide}`} onMouseLeave={()=>setAppearanceOpen(false)}><AppearancePanel active={themePreference} onSelect={chooseTheme}/></div>}
   </>}
  </div>}
 </div>
}

function AppearancePanel({active,onSelect,mobile=false,onBack}:{active:ThemePreference;onSelect:(value:ThemePreference)=>void;mobile?:boolean;onBack?:()=>void}){return <section className={`profile-appearance-panel ${mobile?'mobile':''}`} role="menu" aria-label="Aparência">{mobile&&<header><button type="button" aria-label="Voltar ao menu do perfil" onClick={onBack}><ArrowLeft/></button><b>Aparência</b></header>}{!mobile&&<h3>Aparência</h3>}{appearances.map(([value,label])=><button type="button" role="menuitemradio" aria-checked={active===value} className={active===value?'selected':''} onClick={()=>onSelect(value)} key={value}><span>{label}</span>{active===value&&<Check/>}</button>)}</section>}
