import {act,render,screen,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {MemoryRouter,Route,Routes} from 'react-router-dom'
import {beforeEach,describe,expect,it,vi} from 'vitest'
import {Layout} from '../components/Layout'
import {NextAwardCard} from '../components/dashboard/NextAwardCard'
import {useDemoStore} from '../store/useDemoStore'

vi.mock('../hooks/useAuth',()=>({useAuth:()=>({user:{email:'player@sphexpay.com',user_metadata:{full_name:'Ronald'}},signOut:vi.fn()})}))
vi.mock('../hooks/useNotificationAudio',()=>({useNotificationAudio:()=>undefined}))
vi.mock('../components/notifications/NotificationBell',()=>({NotificationBell:()=> <button>Notificações</button>}))
vi.mock('../components/common/SearchInput',()=>({SearchInput:()=> <input aria-label="Busca global"/>}))
vi.mock('../components/profile/ProfileMenu',()=>({ProfileMenu:()=> <button>Abrir menu do perfil</button>}))
vi.mock('../components/branding/SphexPayLogo',()=>({SphexPayLogo:()=> <span>Sphex</span>}))

const renderLayout=()=>render(<MemoryRouter initialEntries={['/app']}><Routes><Route path="/app" element={<Layout/>}><Route index element={<p>Dashboard atual</p>}/></Route></Routes></MemoryRouter>)

describe('limpeza da navegação autenticada',()=>{
 beforeEach(()=>act(()=>useDemoStore.getState().reset()))

 it('mantém o toggle desktop dentro do header da sidebar e recolhe e expande',async()=>{
  const view=renderLayout(),sidebar=view.container.querySelector('#app-navigation')!,brand=sidebar.querySelector('.sidebar-brand')!,user=userEvent.setup()
  const collapse=within(brand as HTMLElement).getByRole('button',{name:'Recolher menu lateral'})
  expect(view.container.querySelector('.internal-topbar .sidebar-collapse-toggle')).not.toBeInTheDocument();await user.click(collapse);expect(view.container.querySelector('.internal-app-shell')).toHaveClass('sidebar-collapsed')
  const expand=within(brand as HTMLElement).getByRole('button',{name:'Expandir menu lateral'});expect(expand).toHaveAttribute('aria-expanded','false');await user.click(expand);expect(view.container.querySelector('.internal-app-shell')).toHaveClass('sidebar-expanded')
 })

 it('remove tema do header e Configurações da sidebar sem duplicar o controle mobile',()=>{
  const view=renderLayout(),sidebar=view.container.querySelector('#app-navigation')!
  expect(screen.queryByRole('button',{name:'Alternar tema'})).not.toBeInTheDocument();expect(within(sidebar as HTMLElement).queryByRole('link',{name:'Configurações'})).not.toBeInTheDocument();expect(view.container.querySelectorAll('.mobile-menu-toggle')).toHaveLength(1)
  const css=readFileSync(resolve(process.cwd(),'src/index.css'),'utf8');expect(css).toContain('@media(max-width:1023px){.internal-app-shell .internal-sidebar .sidebar-brand>.sidebar-collapse-toggle{display:none!important}}')
 })

 it('mantém a premiação e seus dados, alterando somente a composição responsiva',()=>{
  const first=useDemoStore.getState().achievements[0];render(<MemoryRouter><NextAwardCard currentRevenue={first.target/2}/></MemoryRouter>)
  expect(screen.getByText('SUA PRÓXIMA PREMIAÇÃO')).toBeVisible();expect(screen.getByRole('heading',{name:first.title})).toBeVisible();expect(screen.getByText('50.0%')).toBeVisible();expect(screen.getByLabelText('Ver premiações')).toHaveAttribute('href','/app/premiacoes')
  const css=readFileSync(resolve(process.cwd(),'src/index.css'),'utf8');expect(css).toContain('grid-template-columns:minmax(150px,.7fr) minmax(0,2.3fr) 40px');expect(css).toContain('@media(max-width:767px){.dashboard-page .next-award-card,.dashboard-page .next-award-complete{grid-template-columns:minmax(0,1fr)')
 })
})
