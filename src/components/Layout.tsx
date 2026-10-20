import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Settings, Sun, X } from 'lucide-react'
import { cn } from '../lib/utils'
import { NotificationBell } from './notifications/NotificationBell'
import { SearchInput } from './common/SearchInput'
import { ProfileMenu } from './profile/ProfileMenu'
import { SphexPayLogo } from './branding/SphexPayLogo'
import { useAuth } from '../hooks/useAuth'
import { useNotificationAudio } from '../hooks/useNotificationAudio'
import { competitionNavigation, navigationGroups, navigationItemForPath } from '../config/navigation'
import { MobileAppDock } from './mobile-navigation/MobileAppDock'
import { useDemoStore } from '../store/useDemoStore'

export function Layout({ navigationRoot = '/app' }: { navigationRoot?: string }) {
  useNotificationAudio()
  const [collapsed, setCollapsed] = useState(false), [mobile, setMobile] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null), closeButton = useRef<HTMLButtonElement>(null), drawer = useRef<HTMLElement>(null), wasMobile = useRef(false)
  const { signOut, user } = useAuth(), navigate = useNavigate(), loc = useLocation()
  const theme = useDemoStore(state => state.theme), setTheme = useDemoStore(state => state.setTheme)
  const currentPath = loc.pathname.replace(navigationRoot, '/app')
  const pathFor = (path: string) => path.replace(/^\/app/, navigationRoot)
  const CompetitionIcon = competitionNavigation.icon
  const title = currentPath.startsWith('/app/configuracoes') ? 'Configurações' : currentPath.startsWith(competitionNavigation.path) ? competitionNavigation.label : navigationItemForPath(currentPath)?.label || 'SphexPay'
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Conta SphexPay'
  const logout = async (destination: 'home' | 'login' = 'home') => { try { await signOut() } finally { navigate(destination === 'login' ? '/entrar' : '/', { replace: true }) } }
  useEffect(() => { setMobile(false) }, [loc.pathname])
  useEffect(() => {
    const media = matchMedia('(min-width: 768px)')
    const resize = () => { if (media.matches) setMobile(false) }
    media.addEventListener?.('change', resize)
    return () => media.removeEventListener?.('change', resize)
  }, [])
  useEffect(() => {
    if (!mobile) { if (wasMobile.current) menuButton.current?.focus(); wasMobile.current = false; return }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    wasMobile.current = true
    closeButton.current?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMobile(false) }
      if (event.key !== 'Tab' || !drawer.current) return
      const items = [...drawer.current.querySelectorAll<HTMLElement>('button, a[href]')].filter(element => !element.hasAttribute('disabled') && element.getClientRects().length > 0)
      const first = items[0], last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    addEventListener('keydown', keyboard)
    return () => { document.body.style.overflow = previousOverflow; removeEventListener('keydown', keyboard) }
  }, [mobile])
  return <div className={cn('min-h-screen app-shell internal-app-shell workspace-refresh', collapsed ? 'sidebar-collapsed' : 'sidebar-expanded')}>
    <a className="workspace-skip" href="#workspace-content">Ir para o conteúdo</a>
    <aside ref={drawer} id="app-navigation" aria-label="Menu principal" role={mobile ? 'dialog' : undefined} aria-modal={mobile || undefined} className={cn('app-sidebar internal-sidebar fixed inset-y-0 left-0 z-50', collapsed ? 'w-[84px]' : 'w-[268px]', mobile && 'mobile-open')}>
      <div className="sidebar-brand"><SphexPayLogo showName={!collapsed || mobile} priority adaptiveTheme wordmarkText="SphexPay" /><button className="btn btn-ghost icon-btn sidebar-collapse-toggle" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} aria-expanded={!collapsed} aria-controls="app-navigation">{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</button><button ref={closeButton} onClick={() => setMobile(false)} className="sidebar-mobile-close mobile-sidebar-close" aria-label="Fechar menu"><X /></button></div>
      <div className="workspace-account"><span className="workspace-account-mark">S</span><span><strong>Seu workspace</strong><small>SphexPay</small></span><ChevronRight /></div>
      <nav className="sidebar-navigation scrollbar" aria-label="Módulos">{navigationGroups.map(group => <section className="sidebar-group" key={group.label}><span className="sidebar-group-label">{group.label}</span>{group.items.map(item => <NavLink key={item.path} to={pathFor(item.path)} end={item.exact} aria-label={item.label} title={collapsed ? item.label : undefined} onClick={() => setMobile(false)} className={({ isActive }) => cn('sidebar-link', isActive && 'active')}><item.icon /><span>{item.label}</span></NavLink>)}</section>)}</nav>
      <div className="competition-sidebar-slot"><NavLink to={pathFor(competitionNavigation.path)} aria-label={competitionNavigation.label} title={collapsed ? competitionNavigation.label : undefined} onClick={() => setMobile(false)} className={({ isActive }) => cn('competition-sidebar-item', isActive && 'active')}><CompetitionIcon /><span>{competitionNavigation.label}<small>Conheça os desafios</small></span><ChevronRight className="workspace-competition-arrow" /></NavLink></div>
      <footer className="sidebar-footer"><NavLink to={pathFor('/app/configuracoes')} className="sidebar-link" aria-label="Configurações" title={collapsed ? 'Configurações' : undefined}><Settings /><span>Configurações</span></NavLink><button className="btn btn-ghost sidebar-logout" onClick={() => void logout()} aria-label="Sair da conta" title={collapsed ? 'Sair da conta' : undefined}><LogOut /><span>Sair da conta</span></button></footer>
    </aside>
    {mobile && <button className="app-menu-backdrop" aria-label="Fechar menu" onClick={() => setMobile(false)} />}
    <div className="app-viewport internal-main" inert={mobile || undefined}>
      <header className="app-header internal-topbar"><button ref={menuButton} className="btn btn-ghost icon-btn mobile-menu-toggle" aria-label={mobile ? 'Fechar menu' : 'Abrir menu'} aria-expanded={mobile} aria-controls="app-navigation" onClick={() => setMobile(value => !value)}><Menu /></button><SphexPayLogo className="header-brand" adaptiveTheme /><div className="internal-topbar-context"><span>Workspace</span><ChevronRight /><strong>{title}</strong></div><div className="mobile-page-title">{title}</div><SearchInput navigationRoot={navigationRoot} /><div className="header-actions"><button type="button" className="btn btn-ghost icon-btn workspace-theme-toggle" aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun /> : <Moon />}</button><NotificationBell /><ProfileMenu name={name} email={user?.email} onSignOut={logout} /></div></header>
      <main id="workspace-content" className="app-main internal-page-content" tabIndex={-1}><Outlet /></main><MobileAppDock navigationRoot={navigationRoot} />
    </div>
  </div>
}
