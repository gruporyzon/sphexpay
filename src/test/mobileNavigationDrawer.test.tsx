import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render,screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter,Route,Routes } from 'react-router-dom'
import { describe,expect,it,vi } from 'vitest'
import { Layout } from '../components/Layout'

vi.mock('../hooks/useAuth',()=>({useAuth:()=>({user:{email:'player@sphexpay.com',user_metadata:{}},signOut:vi.fn()})}))
vi.mock('../hooks/useNotificationAudio',()=>({useNotificationAudio:()=>undefined}))
vi.mock('../components/notifications/NotificationBell',()=>({NotificationBell:()=>null}))
vi.mock('../components/common/SearchInput',()=>({SearchInput:()=>null}))
vi.mock('../components/profile/AvatarUploader',()=>({AvatarUploader:()=>null}))
vi.mock('../components/branding/SphexPayLogo',()=>({SphexPayLogo:()=> <span>SphexPay</span>}))
vi.mock('../components/ui',()=>({Dropdown:()=>null}))

const renderLayout=()=>render(<MemoryRouter initialEntries={['/app']}><Routes><Route path="/app" element={<Layout/>}><Route index element={<p>Dashboard atual</p>}/><Route path="transacoes" element={<p>Transações atuais</p>}/></Route></Routes></MemoryRouter>)

describe('drawer autenticado mobile',()=>{
 it('usa uma única posição, abre acima do backdrop e restaura scroll e foco ao fechar',async()=>{
  const user=userEvent.setup()
  document.body.style.overflow='auto'
  const view=renderLayout()
  const trigger=view.container.querySelector<HTMLButtonElement>('.mobile-menu-toggle')!
  const drawer=view.container.querySelector<HTMLElement>('#app-navigation')!

  expect(trigger).toHaveAttribute('aria-expanded','false')
  await user.click(trigger)
  expect(drawer).toHaveClass('mobile-open')
  expect(drawer).toHaveAttribute('role','dialog')
  expect(drawer).toHaveAttribute('aria-modal','true')
  expect(view.container.querySelector('.app-menu-backdrop')).toBeInTheDocument()
  expect(document.body.style.overflow).toBe('hidden')
  expect(view.container.querySelector('.mobile-sidebar-close')).toHaveFocus()

  await user.keyboard('{Escape}')
  expect(drawer).not.toHaveClass('mobile-open')
  expect(view.container.querySelector('.app-menu-backdrop')).not.toBeInTheDocument()
  expect(document.body.style.overflow).toBe('auto')
  expect(trigger).toHaveFocus()
 })

 it('fecha pelo backdrop, por navegação e permanece estável em dez ciclos',async()=>{
  const user=userEvent.setup()
  const view=renderLayout()
  const trigger=view.container.querySelector<HTMLButtonElement>('.mobile-menu-toggle')!
  const drawer=view.container.querySelector<HTMLElement>('#app-navigation')!

  await user.click(trigger)
  await user.click(view.container.querySelector<HTMLButtonElement>('.app-menu-backdrop')!)
  expect(drawer).not.toHaveClass('mobile-open')

  await user.click(trigger)
  await user.click(screen.getByRole('link',{name:'Transações'}))
  expect(screen.getByText('Transações atuais')).toBeVisible()
  expect(drawer).not.toHaveClass('mobile-open')

  for(let cycle=0;cycle<10;cycle+=1){await user.click(trigger);expect(drawer).toHaveClass('mobile-open');await user.keyboard('{Escape}');expect(drawer).not.toHaveClass('mobile-open')}
 })

 it('mantém o CSS mobile como única autoridade de deslocamento e stacking',()=>{
  const layout=readFileSync(resolve(process.cwd(),'src/components/Layout.tsx'),'utf8')
  const css=readFileSync(resolve(process.cwd(),'src/index.css'),'utf8')
  expect(layout).not.toContain('max-lg:-translate-x-full')
  expect(css).toMatch(/\.internal-sidebar\{[\s\S]*?z-index:80!important;[\s\S]*?width:min\(88vw,320px\)!important;[\s\S]*?transform:translate3d\(-105%,0,0\);[\s\S]*?transition:transform 200ms ease/)
  expect(css).toContain('.internal-sidebar.mobile-open{transform:translate3d(0,0,0)}')
  expect(css).toMatch(/\.app-menu-backdrop\{position:fixed;z-index:75;/)
 })
})
