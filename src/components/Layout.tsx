import {T} from '../i18n'
import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { LanguagePicker } from './navigation/LanguagePicker'
import { LocaleDocument } from '../i18n'
import { NotificationBell } from './notifications/NotificationBell'
import { ProfileMenu } from './profile/ProfileMenu'
import { SphexPayLogo } from './branding/SphexPayLogo'
import { useAuth } from '../hooks/useAuth'
import { useNotificationAudio } from '../hooks/useNotificationAudio'
import { useDemoStore } from '../store/useDemoStore'
import { WorkspaceHelp } from './navigation/WorkspaceHelp'
import { WorkspaceTopNavigation } from './navigation/WorkspaceTopNavigation'
import { WorkspaceSidebar } from './navigation/WorkspaceSidebar'
import { WorkspaceSelectMenu } from './navigation/WorkspaceSelectMenu'
import { KycCompletionPrompt } from '../features/kyc/KycCompletionPrompt'
import { referralService } from '../services/referralService'

export function Layout({ navigationRoot = '/app' }: { navigationRoot?: string }) {
  useNotificationAudio()
  const { signOut, user } = useAuth(), navigate = useNavigate()
  const preference=useDemoStore(state=>state.themePreference),setTheme=useDemoStore(state=>state.setTheme)
  useEffect(()=>{if(preference!=='system')return;const media=matchMedia('(prefers-color-scheme: dark)'),sync=()=>setTheme('system');media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync)},[preference,setTheme])
  // Conta nova criada por link de indicação: vincula uma vez a quem indicou.
  useEffect(()=>{if(user?.id)void referralService.claimPending()},[user?.id])
  // Menu lateral só em telas largas; abaixo disso a navegação fica na barra superior.
  const [wide,setWide]=useState(()=>typeof matchMedia==='function'&&matchMedia('(min-width:1100px)').matches)
  useEffect(()=>{if(typeof matchMedia!=='function')return;const media=matchMedia('(min-width:1100px)'),sync=()=>setWide(media.matches);sync();media.addEventListener?.('change',sync);return()=>media.removeEventListener?.('change',sync)},[])
  const opacity = useDemoStore(state => state.preferences.mobileNavigation.opacity)
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Conta SphexPay'
  const logout = async (destination: 'home' | 'login' = 'home') => { try { await signOut() } finally { navigate(destination === 'login' ? '/entrar' : '/', { replace: true }) } }
  return <div className={`app-shell internal-app-shell workspace-reference${wide?' has-sidebar':''}`}>
    <LocaleDocument/><WorkspaceSelectMenu/><KycCompletionPrompt/><a className="reference-skip" href="#workspace-content"><T>Ir para o conteúdo</T></a>
    <header className="reference-topbar" style={{'--header-opacity':.82+Math.max(0,Math.min(100,opacity))*.0016} as React.CSSProperties}>
      <div className="reference-brand-row"><SphexPayLogo showName priority adaptiveTheme wordmarkText="SphexPay"/><div className="reference-header-actions"><LanguagePicker/><NotificationBell/><ProfileMenu name={name} email={user?.email} onSignOut={logout}/></div></div>
    </header>
    <WorkspaceTopNavigation navigationRoot={navigationRoot}/>
    <div className="workspace-body">{wide&&<WorkspaceSidebar navigationRoot={navigationRoot}/>}<main id="workspace-content" className="internal-page-content reference-page" tabIndex={-1}><Outlet/></main></div><WorkspaceHelp/>
  </div>
}
