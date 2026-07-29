import { MemoryRouter } from 'react-router-dom'
import { fireEvent,render,screen,within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach,describe,expect,it,vi } from 'vitest'
import LandingPage from '../pages/public/LandingPage'

const auth=vi.hoisted(()=>({user:null as null|{user_metadata?:{onboarding_complete?:boolean}}}))
vi.mock('../hooks/useAuth',()=>({useAuth:()=>({user:auth.user,loading:false,configured:true})}))

const renderLanding=()=>render(<MemoryRouter><LandingPage/></MemoryRouter>)

describe('entrada pública SphexPay',()=>{
 beforeEach(()=>{auth.user=null;Object.defineProperty(window,'innerWidth',{configurable:true,value:1440})})
 it('renderiza a narrativa pública completa com apenas um título principal',()=>{
  const view=renderLanding()
  expect(screen.getAllByRole('heading',{level:1})).toHaveLength(1)
  expect(screen.getByRole('heading',{name:/Venda, receba e escale/i})).toBeInTheDocument()
  expect(view.container.querySelector('#plataforma')).toBeInTheDocument()
  expect(view.container.querySelector('#recursos')).toBeInTheDocument()
  expect(view.container.querySelector('#seguranca')).toBeInTheDocument()
  expect(view.container.querySelector('#premiacoes')).toBeInTheDocument()
  expect(view.container.querySelector('#campeonato')).toBeInTheDocument()
  expect(view.container.querySelector('#ajuda')).toBeInTheDocument()
  expect(screen.getByText('Sphex 5M+')).toBeInTheDocument()
 })
 it('conecta login, cadastro e CTA ao fluxo real e adapta a sessão existente',()=>{
  const view=renderLanding()
  expect(screen.getAllByRole('link',{name:'Entrar'})[0]).toHaveAttribute('href','/entrar')
  expect(screen.getAllByRole('link',{name:/Criar minha conta|Criar conta/})[0]).toHaveAttribute('href','/criar-conta')
  view.unmount();auth.user={user_metadata:{onboarding_complete:true}};renderLanding()
  expect(screen.getAllByRole('link',{name:/Acessar (meu )?painel/})[0]).toHaveAttribute('href','/app')
 })
 it('abre e fecha o drawer mobile, bloqueia o fundo e devolve o foco',async()=>{
  Object.defineProperty(window,'innerWidth',{configurable:true,value:390});const user=userEvent.setup();renderLanding()
  const trigger=screen.getByRole('button',{name:'Abrir menu'});await user.click(trigger)
  expect(screen.getByRole('button',{name:'Fechar menu'})).toHaveAttribute('aria-expanded','true')
  expect(document.body.style.overflow).toBe('hidden')
  await user.keyboard('{Escape}')
  expect(screen.getByRole('button',{name:'Abrir menu'})).toHaveFocus()
  expect(document.body.style.overflow).toBe('')
 })
 it('troca a prova visual por tabs reais e mantém o conteúdo sem dados financeiros',async()=>{
  const user=userEvent.setup();const view=renderLanding()
  await user.click(screen.getByRole('tab',{name:'Vendas ao vivo'}))
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Atividade global')
  expect(view.container.querySelector('.product-preview')).toHaveTextContent('Prévia sem dados financeiros')
 })
 it('expande FAQ com estado aria e conteúdo associado',async()=>{
  const user=userEvent.setup();renderLanding();const button=screen.getByRole('button',{name:'Como recuperar minha senha?'})
  expect(button).toHaveAttribute('aria-expanded','false');await user.click(button)
  expect(button).toHaveAttribute('aria-expanded','true')
  expect(screen.getByText(/Esqueci minha senha/)).toBeVisible()
 })
 it('apresenta a competição confirmada no código como provisória',()=>{
  renderLanding();const section=screen.getByRole('heading',{name:'Rumo ao iPhone 17 Pro Max'}).closest('section')!
  expect(within(section).getByText(/01\/09\/2026 a 01\/10\/2026/)).toBeInTheDocument()
  expect(within(section).getByText(/R\$ 30\.000,00 em vendas elegíveis/)).toBeInTheDocument()
  expect(within(section).getByText(/regulamento está marcado como provisório/i)).toBeInTheDocument()
 })
 it('não publica taxas, estatísticas ou promessas comerciais não confirmadas',()=>{
  const {container}=renderLanding(),text=container.textContent??''
  expect(text).not.toMatch(/98%|98,7%|3,49%|0,99%|saques 24\/7|melhor taxa do mercado|zero chargeback/i)
  expect(text).toMatch(/dependem de integrações oficiais/i)
  expect(container.innerHTML).not.toMatch(/kingpay/i)
  fireEvent.click(screen.getByRole('link',{name:/Conhecer campeonato/}))
 })
})
