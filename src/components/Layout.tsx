import {T} from '../i18n'
import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
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
import { WorkspaceSelectMenu } from './navigation/WorkspaceSelectMenu'
import { KycCompletionPrompt } from '../features/kyc/KycCompletionPrompt'

export function Layout({ navigationRoot = '/app' }: { navigationRoot?: string }) {
  useNotificationAudio()
  const { signOut, user } = useAuth(), navigate = useNavigate()
  const preference=useDemoStore(state=>state.themePreference),setTheme=useDemoStore(state=>state.setTheme)
  useEffect(()=>{if(preference!=='system')return;const media=matchMedia('(prefers-color-scheme: dark)'),sync=()=>setTheme('system');media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync)},[preference,setTheme])
  const opacity = useDemoStore(state => state.preferences.mobileNavigation.opacity)
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Conta SphexPay'
  const logout = async (destination: 'home' | 'login' = 'home') => { try { await signOut() } finally { navigate(destination === 'login' ? '/entrar' : '/', { replace: true }) } }
  return <div className="app-shell internal-app-shell workspace-reference">
    <LocaleDocument/><WorkspaceSelectMenu/><KycCompletionPrompt/><a className="reference-skip" href="#workspace-content"><T>Ir para o conteúdo</T></a>
    <header className="reference-topbar" style={{'--header-opacity':.82+Math.max(0,Math.min(100,opacity))*.0016} as React.CSSProperties}>
      <div className="reference-brand-row"><SphexPayLogo showName priority adaptiveTheme wordmarkText="SphexPay"/><div className="reference-header-actions"><LanguagePicker/><NotificationBell/><ProfileMenu name={name} email={user?.email} onSignOut={logout}/></div></div>
    </header>
    <WorkspaceTopNavigation navigationRoot={navigationRoot}/>
    <main id="workspace-content" className="internal-page-content reference-page" tabIndex={-1}><Outlet/></main><WorkspaceHelp/>
  </div>
}
