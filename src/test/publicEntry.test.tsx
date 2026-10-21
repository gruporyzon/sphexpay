import { MemoryRouter } from 'react-router-dom'
import { fireEvent,render,screen,within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach,describe,expect,it,vi } from 'vitest'
import LandingPage from '../pages/public/LandingPage'

const auth=vi.hoisted(()=>({user:null as null|{user_metadata?:{onboarding_complete?:boolean}}}))
vi.mock('../hooks/useAuth',()=>({useAuth:()=>({user:auth.user,loading:false,configured:true})}))

const renderLanding=()=>render(<MemoryRouter><LandingPage/></MemoryRouter>)

describe('entrada pública SphexPay (gateway)',()=>{
 beforeEach(()=>{auth.user=null;document.body.style.overflow='';HTMLElement.prototype.scrollTo??=function(){}})

 it('renderiza a narrativa pública com um único título principal e seções reais',()=>{
  const {container}=renderLanding()
  expect(screen.getAllByRole('heading',{level:1})).toHaveLength(1)
  expect(screen.getByRole('heading',{level:1})).toHaveTextContent(/Um único ecossistema de pagamentos/)
  for(const id of ['produtos','solucoes','integracoes','experiencia','premiacoes','taxas','contact','ajuda'])expect(container.querySelector(`#${id}`)).toBeInTheDocument()
  expect(screen.getByRole('heading',{name:'Seu próximo nível começa na SphexPay'})).toBeInTheDocument()
  expect(document.title).toBe('SphexPay — Um novo nível para o seu negócio')
 })

 it('não repete ids na página',()=>{
  const {container}=renderLanding()
  const ids=[...container.querySelectorAll('[id]')].map(element=>element.id)
  expect(ids.filter((id,index)=>ids.indexOf(id)!==index)).toEqual([])
 })

 it('liga a navegação principal a seções existentes',()=>{
  const {container}=renderLanding(),nav=screen.getByRole('navigation',{name:'Navegação principal'})
  for(const [label,id] of [['Início','home'],['Acessar produtos','produtos'],['Taxas','taxas'],['Fale com a Sphex','contact']] as const){
   expect(within(nav).getByRole('link',{name:label})).toHaveAttribute('href',`#${id}`)
   expect(container.querySelector(`#${id}`)).toBeInTheDocument()
  }
 })

 it('conecta login, cadastro e CTAs ao fluxo real e adapta a sessão existente',()=>{
  const view=renderLanding()
  expect(screen.getAllByRole('link',{name:'Login'})[0]).toHaveAttribute('href','/entrar')
  expect(screen.getAllByRole('link',{name:'Criar conta'})[0]).toHaveAttribute('href','/criar-conta')
  expect(screen.getAllByRole('link',{name:'Quero conhecer a SphexPay'})[0]).toHaveAttribute('href','/criar-conta')
  view.unmount();auth.user={user_metadata:{onboarding_complete:true}};const second=renderLanding()
  expect(screen.getAllByRole('link',{name:'Meu painel'})[0]).toHaveAttribute('href','/app')
  second.unmount();auth.user={user_metadata:{onboarding_complete:false}};renderLanding()
  expect(screen.getAllByRole('link',{name:'Meu painel'})[0]).toHaveAttribute('href','/onboarding')
 })

 it('abre o menu mobile como diálogo, bloqueia o fundo e fecha com Esc devolvendo o foco',async()=>{
  const user=userEvent.setup();const {container}=renderLanding()
  const trigger=container.querySelector('.gw-menu-trigger') as HTMLButtonElement
  expect(trigger).toHaveAttribute('aria-label','Abrir menu de navegação')
  await user.click(trigger)
  expect(trigger).toHaveAttribute('aria-expanded','true')
  expect(screen.getByRole('dialog',{name:'Menu de navegação',hidden:true}).closest('[hidden]')).toBeNull()
  expect(document.body.style.overflow).toBe('hidden')
  await user.keyboard('{Escape}')
  expect(trigger).toHaveAttribute('aria-expanded','false')
  expect(document.body.style.overflow).toBe('')
  expect(trigger).toHaveFocus()
 })

 it('troca a jornada de venda por abas acessíveis e setas do teclado',async()=>{
  const user=userEvent.setup();renderLanding()
  const tabs=screen.getByRole('tablist',{name:'Explorar jornada de venda'})
  expect(within(tabs).getByRole('tab',{name:'Jornada de compra'})).toHaveAttribute('aria-selected','true')
  expect(screen.getByRole('tabpanel')).toHaveTextContent('PIX gerado e não pago')
  await user.click(within(tabs).getByRole('tab',{name:'Funil e checkout'}))
  expect(within(tabs).getByRole('tab',{name:'Funil e checkout'})).toHaveAttribute('aria-selected','true')
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Checkout personalizável')
  fireEvent.keyDown(within(tabs).getByRole('tab',{name:'Funil e checkout'}),{key:'ArrowLeft'})
  expect(within(tabs).getByRole('tab',{name:'Jornada de compra'})).toHaveAttribute('aria-selected','true')
  expect(within(tabs).getByRole('tab',{name:'Jornada de compra'})).toHaveFocus()
 })

 it('apresenta as cinco premiações oficiais com seleção acessível',async()=>{
  const user=userEvent.setup();renderLanding()
  const group=screen.getByRole('group',{name:'Selecionar premiação'})
  expect(within(group).getAllByRole('button')).toHaveLength(5)
  expect(within(group).getByRole('button',{name:'Premiação 10K'})).toHaveAttribute('aria-pressed','true')
  await user.click(within(group).getByRole('button',{name:'Premiação 1M'}))
  expect(within(group).getByRole('button',{name:'Premiação 1M'})).toHaveAttribute('aria-pressed','true')
  expect(screen.getByRole('img',{name:'Placa oficial Sphex 5M+'})).toBeInTheDocument()
 })

 it('pausa e retoma o carrossel de negócios',async()=>{
  const user=userEvent.setup();renderLanding()
  await user.click(screen.getByRole('button',{name:'Pausar carrossel'}))
  expect(screen.getByRole('button',{name:'Reproduzir carrossel'})).toHaveAttribute('aria-pressed','true')
 })

 it('expande a área de dúvidas e o FAQ com estado aria',async()=>{
  const user=userEvent.setup();renderLanding()
  const toggle=screen.getByRole('button',{name:'Dúvidas sobre a SphexPay'})
  expect(toggle).toHaveAttribute('aria-expanded','false')
  await user.click(toggle);expect(toggle).toHaveAttribute('aria-expanded','true')
  await user.click(screen.getByRole('button',{name:'Exibir mais +2'}))
  const question=screen.getByRole('button',{name:/A plataforma é responsiva\?/})
  await user.click(question)
  expect(question).toHaveAttribute('aria-expanded','true')
  expect(screen.getByText(/diferentes tamanhos de tela/)).toBeInTheDocument()
 })

 it('não publica taxas, estatísticas ou promessas comerciais não confirmadas',()=>{
  const {container}=renderLanding(),text=container.textContent??''
  expect(text).not.toMatch(/98%|98,7%|3,49%|0,99%|saques 24\/7|melhor taxa do mercado|zero chargeback|taxa zero/i)
  expect(container.innerHTML).not.toMatch(/kingpay/i)
 })
})
