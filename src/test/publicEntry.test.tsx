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
  expect(screen.getByRole('heading',{level:1,name:/Você sempre no topo.*Sem limites/i})).toBeInTheDocument()
  for(const id of ['experiencia','solucoes','vendas-ao-vivo','integracoes','ajuda','premiacoes'])expect(view.container.querySelector(`#${id}`)).toBeInTheDocument()
  for(const id of ['recursos','seguranca','campeonato'])expect(view.container.querySelector(`#${id}`)).not.toBeInTheDocument()
  expect(screen.queryByText('SEGURANÇA DESDE O ACESSO')).not.toBeInTheDocument()
  expect(screen.getByText('Sphex 5M+')).toBeInTheDocument()
  expect(screen.getByRole('region',{name:'Prévia demonstrativa do dashboard SphexPay'})).toBeInTheDocument()
  expect(screen.getByRole('heading',{name:'Vendas multiplicadas.'})).toBeInTheDocument()
  expect(screen.getByRole('heading',{name:'Veja com seus olhos.'})).toBeInTheDocument()
  expect(screen.queryByRole('heading',{name:'Criado para sua operação avançar.'})).not.toBeInTheDocument()
 })
 it('oferece tabs acessíveis para os recursos de checkout',()=>{
  renderLanding()
  const tabs=screen.getByRole('tablist',{name:'Recursos do checkout'})
  expect(within(tabs).getAllByRole('tab')).toHaveLength(4)
  expect(screen.getByRole('tab',{name:'Order Bump'})).toHaveAttribute('aria-selected','true')
  fireEvent.click(screen.getByRole('tab',{name:'Recorrência'}))
  expect(screen.getByRole('tab',{name:'Recorrência'})).toHaveAttribute('aria-selected','true')
  expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Recorrência')
  fireEvent.keyDown(tabs,{key:'ArrowRight'})
  expect(screen.getByRole('tab',{name:'Checkout Global'})).toHaveAttribute('aria-selected','true')
 })
 it.each([768,834,1024,1280,1440,1920])('mantém a composição premium funcional no viewport de %i px',width=>{
  Object.defineProperty(window,'innerWidth',{configurable:true,value:width})
  const {container}=renderLanding(),hero=container.querySelector('.landing-hero') as HTMLElement
  expect(hero).toBeInTheDocument()
  expect(container.querySelector('.ref-dashboard-window')).toBeInTheDocument()
  expect(hero.scrollWidth).toBeLessThanOrEqual(hero.clientWidth)
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
 it('mantém todos os destinos da navbar ativos e associados a seções reais',()=>{
  const {container}=renderLanding(),nav=screen.getByRole('navigation',{name:'Navegação principal'})
  for(const [label,id] of [['Plataforma','experiencia'],['Soluções','solucoes'],['Premiações','premiacoes'],['Dúvidas','ajuda']] as const){
   const link=within(nav).getByRole('link',{name:label})
   expect(link).toHaveAttribute('href',`#${id}`)
   expect(container.querySelector(`#${id}`)).toBeInTheDocument()
   fireEvent.click(link)
   expect(link).toHaveAttribute('aria-current','location')
  }
  for(const label of ['Recursos','Segurança','Campeonato'])expect(within(nav).queryByRole('link',{name:label})).not.toBeInTheDocument()
 })
 it('navega pelo showcase visual com tabs reais e setas do teclado',async()=>{
  HTMLElement.prototype.scrollTo??=function(){}
  const user=userEvent.setup();const view=renderLanding()
  const dots=screen.getByRole('tablist',{name:'Selecionar showcase'})
  expect(within(dots).getAllByRole('tab')).toHaveLength(6)
  expect(screen.getByRole('tab',{name:'Mostrar Checkout sem fricção.'})).toHaveAttribute('aria-selected','true')
  await user.click(screen.getByRole('tab',{name:'Mostrar Dashboard em contexto.'}))
  expect(screen.getByRole('tab',{name:'Mostrar Dashboard em contexto.'})).toHaveAttribute('aria-selected','true')
  fireEvent.keyDown(screen.getByRole('region',{name:'Showcase visual da plataforma SphexPay'}),{key:'ArrowRight'})
  expect(screen.getByRole('tab',{name:'Mostrar Vendas em movimento.'})).toHaveAttribute('aria-selected','true')
  expect(screen.getByLabelText('Progresso: 4 de 6')).toBeInTheDocument()
  expect(view.container).not.toHaveTextContent(/prévia estática|não inicia consultas|contexto protegido/i)
 })
 it('apresenta prévia do dashboard, gráfico ilustrativo e globo sem esqueletos',async()=>{
  const user=userEvent.setup();const {container}=renderLanding()
  const transactions=screen.getByRole('button',{name:'Transações'}),summary=screen.getByRole('button',{name:'Resumo'})
  expect(transactions).toHaveAttribute('aria-pressed','true');expect(screen.getByText('R$ 7.487.154,61')).toBeInTheDocument()
  await user.click(summary)
  expect(summary).toHaveAttribute('aria-pressed','true');expect(screen.getByText('R$ 6.139.466,78')).toBeInTheDocument()
  expect(screen.getAllByText('Saldo demonstrativo').length).toBeGreaterThan(0)
  expect(screen.getByRole('img',{name:/Gráfico ilustrativo de evolução de vendas/i})).toBeInTheDocument()
  expect(screen.getByRole('img',{name:/Globo interativo ilustrando conexões operacionais/i})).toBeInTheDocument()
  expect(container.querySelector('.live-public-visual')).not.toBeInTheDocument()
 })
 it.each([320,360,375,390,393,412,414,430])('mantém hero compacto e sem mockup no viewport mobile de %i px',width=>{
  Object.defineProperty(window,'innerWidth',{configurable:true,value:width})
  const {container}=renderLanding(),hero=container.querySelector('.landing-hero') as HTMLElement
  expect(hero).toBeInTheDocument();expect(container.querySelector('.landing-hero-visual')).not.toBeInTheDocument();expect(container.querySelector('.hero-browser')).not.toBeInTheDocument()
  expect(hero.scrollWidth).toBeLessThanOrEqual(hero.clientWidth)
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
 })
 it('expande FAQ com estado aria e conteúdo associado',async()=>{
  const user=userEvent.setup();renderLanding()
  const more=screen.getByRole('button',{name:'Exibir mais +2'});await user.click(more)
  expect(screen.getByRole('button',{name:'Exibir menos'})).toHaveAttribute('aria-expanded','true')
  const button=screen.getByRole('button',{name:/A plataforma é responsiva\?/})
  expect(button).toHaveAttribute('aria-expanded','false');await user.click(button)
  expect(button).toHaveAttribute('aria-expanded','true')
  expect(screen.getByText(/diferentes tamanhos de tela/)).toBeVisible()
 })
 it('não publica taxas, estatísticas ou promessas comerciais não confirmadas',()=>{
  const {container}=renderLanding(),text=container.textContent??''
  expect(text).not.toMatch(/98%|98,7%|3,49%|0,99%|saques 24\/7|melhor taxa do mercado|zero chargeback/i)
  expect(text).toMatch(/dependem de integrações oficiais/i)
  expect(container.innerHTML).not.toMatch(/kingpay/i)
 })
})
