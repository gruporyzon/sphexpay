import {act,render,screen,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {MemoryRouter,Route,Routes} from 'react-router-dom'
import {beforeEach,describe,expect,it,vi} from 'vitest'
import {Layout} from '../components/Layout'
import {useDemoStore} from '../store/useDemoStore'

vi.mock('../hooks/useAuth',()=>({useAuth:()=>({user:{email:'player@sphexpay.com',user_metadata:{full_name:'Ronald'}},signOut:vi.fn()})}))
vi.mock('../hooks/useNotificationAudio',()=>({useNotificationAudio:()=>undefined}))
vi.mock('../components/notifications/NotificationBell',()=>({NotificationBell:()=> <button>Notificações</button>}))
vi.mock('../components/profile/ProfileMenu',()=>({ProfileMenu:()=> <button>Abrir menu do perfil</button>}))
vi.mock('../components/branding/SphexPayLogo',()=>({SphexPayLogo:()=> <span>SphexPay</span>}))
const renderLayout=()=>render(<MemoryRouter initialEntries={['/app']}><Routes><Route path="/app" element={<Layout/>}><Route index element={<p>Dashboard atual</p>}/><Route path="produtos" element={<p>Produtos atuais</p>}/></Route></Routes></MemoryRouter>)

describe('cabeçalho único da área autenticada',()=>{
 beforeEach(()=>act(()=>useDemoStore.getState().reset()))
 it('concentra navegação e controles no topo, sem dock ou sidebar',()=>{
  const view=renderLayout(),header=screen.getByRole('banner')
  expect(within(header).getByRole('button',{name:'Notificações'})).toBeVisible()
  expect(within(header).getByRole('button',{name:'Abrir menu do perfil'})).toBeVisible()
  expect(screen.getAllByRole('navigation')).toHaveLength(1)
  expect(view.container.querySelector('.mobile-app-dock')).not.toBeInTheDocument()
  expect(view.container.querySelector('.internal-sidebar')).not.toBeInTheDocument()
  expect(screen.getByRole('link',{name:'Ir para o conteúdo'})).toHaveAttribute('href','#workspace-content')
 })
 it('alterna os dois temas pelo cabeçalho e preserva a preferência',async()=>{
  renderLayout();const user=userEvent.setup(),initial=useDemoStore.getState().theme
  await user.click(screen.getByRole('button',{name:initial==='dark'?'Ativar modo claro':'Ativar modo escuro'}))
  expect(useDemoStore.getState().theme).toBe(initial==='dark'?'light':'dark')
  expect(screen.getByRole('button',{name:initial==='dark'?'Ativar modo escuro':'Ativar modo claro'})).toBeVisible()
 })
 it('abre ajuda acessível e devolve o foco ao fechar com Escape',async()=>{
  renderLayout();const user=userEvent.setup(),trigger=screen.getByRole('button',{name:'Abrir ajuda'})
  await user.click(trigger);const panel=screen.getByRole('dialog',{name:'Ajuda SphexPay'})
  expect(within(panel).getByRole('link',{name:'Conectar meus pagamentos'})).toHaveAttribute('href','/app/financeiro')
  expect(within(panel).getByRole('button',{name:'Fechar ajuda'})).toHaveFocus()
  await user.keyboard('{Escape}');expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(trigger).toHaveFocus()
 })
 it('preserva a busca rápida de módulos pelo atalho de teclado',async()=>{
  renderLayout();const user=userEvent.setup();await user.keyboard('{Control>}k{/Control}');expect(screen.getByRole('dialog',{name:'Ajuda SphexPay'})).toBeVisible()
  const input=screen.getByRole('searchbox',{name:'Buscar módulos'});await user.click(input);await user.type(input,'produtos');await user.click(screen.getByRole('button',{name:'Abrir Produtos'}));expect(screen.getByText('Produtos atuais')).toBeVisible();expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
 })
 it('fecha ajuda após navegar para um módulo',async()=>{
  renderLayout();const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'Abrir ajuda'}))
  await user.click(screen.getByRole('link',{name:'Gerenciar produtos e checkouts'}))
  expect(screen.getByText('Produtos atuais')).toBeVisible();expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
 })
})
