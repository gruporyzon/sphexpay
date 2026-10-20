import {translate as uiText} from '../../i18n'
import {T,useTranslation} from '../../i18n'
import { useEffect,useRef,useState } from 'react'
import { ChevronRight,LayoutDashboard,LogOut,PenLine,RefreshCw,Settings,ShoppingBag,SlidersHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useHeaderMenu } from '../../hooks/useHeaderMenu'

import { ProfileAvatar } from './ProfileAvatar'

type Props={name:string;email?:string;onSignOut:(destination:'home'|'login')=>Promise<void>}

export function ProfileMenu({name,email,onSignOut}:Props){
 const {t}=useTranslation()

 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),firstItem=useRef<HTMLButtonElement>(null),navigate=useNavigate()
 const close=(restore=false)=>{setOpen(false);if(restore)requestAnimationFrame(()=>trigger.current?.focus())}
 useHeaderMenu('profile',open,()=>setOpen(false))
 const go=(path:string)=>{close();navigate(path)}
 useEffect(()=>{if(!open)return;const pointer=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};const keyboard=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);trigger.current?.focus()}};addEventListener('pointerdown',pointer);addEventListener('keydown',keyboard);firstItem.current?.focus();return()=>{removeEventListener('pointerdown',pointer);removeEventListener('keydown',keyboard)}},[open])
 return <div className="profile-menu-root" ref={root}>
  <button ref={trigger} type="button" className="profile-menu-trigger" aria-label={t('Abrir menu do perfil')} aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(value=>!value)}><ProfileAvatar/><span><b>{name}</b><small><T>Player</T></small></span><ChevronRight className={open?'open':''}/></button>
  {open&&<div className="profile-menu" role="menu" aria-label={t('Menu do perfil')}>

    <header className="profile-menu-head"><span><b>{name}</b>{email&&<small>{email}</small>}</span><button ref={firstItem} type="button" aria-label={t('Editar perfil')} title={t('Editar perfil')} onClick={()=>go('/app/configuracoes?secao=Perfil')}><PenLine/></button></header>
    <section className="profile-menu-section" aria-label={uiText("Conta de produtor")}><button type="button" role="menuitem" onClick={()=>go('/app')}><LayoutDashboard/><span><T>Dashboard de produtor</T></span></button><button type="button" role="menuitem" onClick={()=>go('/app/configuracoes')}><Settings/><span><T>Configurações</T></span></button><button type="button" role="menuitem" onClick={()=>go('/app/configuracoes?secao=Preferências')}><SlidersHorizontal/><span><T>Preferências</T></span></button></section>
    <section className="profile-menu-section" aria-label={uiText("Acessos")}><button type="button" role="menuitem" onClick={()=>go('/app/vendas')}><ShoppingBag/><span><T>Acessar minhas compras</T></span></button><button type="button" role="menuitem" onClick={()=>{close();void onSignOut('login')}}><RefreshCw/><span><T>Acessar outra conta</T></span></button></section>
    <section className="profile-menu-section profile-menu-footer"><button type="button" role="menuitem" onClick={()=>{close();void onSignOut('home')}}><LogOut/><span><T>Sair da conta</T></span></button></section>

  </div>}
 </div>
}
