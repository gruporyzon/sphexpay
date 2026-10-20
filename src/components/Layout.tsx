import { Outlet, useNavigate } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { NotificationBell } from './notifications/NotificationBell'
import { ProfileMenu } from './profile/ProfileMenu'
import { SphexPayLogo } from './branding/SphexPayLogo'
import { useAuth } from '../hooks/useAuth'
import { useNotificationAudio } from '../hooks/useNotificationAudio'
import { useDemoStore } from '../store/useDemoStore'
import { WorkspaceHelp } from './navigation/WorkspaceHelp'
import { WorkspaceTopNavigation } from './navigation/WorkspaceTopNavigation'

export function Layout({ navigationRoot = '/app' }: { navigationRoot?: string }) {
  useNotificationAudio()
  const { signOut, user } = useAuth(), navigate = useNavigate()
  const theme = useDemoStore(state => state.theme), setTheme = useDemoStore(state => state.setTheme)
  const opacity = useDemoStore(state => state.preferences.mobileNavigation.opacity)
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Conta SphexPay'
  const logout = async (destination: 'home' | 'login' = 'home') => { try { await signOut() } finally { navigate(destination === 'login' ? '/entrar' : '/', { replace: true }) } }
  return <div className="app-shell internal-app-shell workspace-reference">
    <a className="reference-skip" href="#workspace-content">Ir para o conteúdo</a>
    <header className="reference-topbar" style={{'--header-opacity':.82+Math.max(0,Math.min(100,opacity))*.0016} as React.CSSProperties}>
      <div className="reference-brand-row"><SphexPayLogo showName priority adaptiveTheme wordmarkText="SphexPay"/><div className="reference-header-actions"><button type="button" className="reference-appearance" aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Moon/> : <Sun/>}<span>{theme === 'dark' ? 'Black' : 'Claro'}</span></button><NotificationBell/><ProfileMenu name={name} email={user?.email} onSignOut={logout}/></div></div>
    </header>
    <WorkspaceTopNavigation navigationRoot={navigationRoot}/>
    <main id="workspace-content" className="internal-page-content reference-page" tabIndex={-1}><Outlet/></main><WorkspaceHelp/>
  </div>
}
