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
  expect(screen.getByRole('heading',{name:/Pagamentos em movimento.*Resultados sob controle/i})).toBeInTheDocument()
  expect(view.container.querySelector('#plataforma')).toBeInTheDocument()
  expect(view.container.querySelector('#recursos')).toBeInTheDocument()
  expect(view.container.querySelector('#seguranca')).toBeInTheDocument()
  expect(view.container.querySelector('#premiacoes')).toBeInTheDocument()
  expect(view.container.querySelector('#campeonato')).toBeInTheDocument()
  expect(view.container.querySelector('#notificacoes')).toBeInTheDocument()
  expect(view.container.querySelector('#fluxo')).toBeInTheDocument()
  expect(view.container.querySelector('#ajuda')).toBeInTheDocument()
  expect(screen.getByText('Sphex 5M+')).toBeInTheDocument()
  expect(view.container.querySelector('.public-phone')).toBeInTheDocument()
  expect(view.container.querySelectorAll('.phone-float')).toHaveLength(4)
  expect(view.container.querySelector('.phone-payment-chip')).toHaveTextContent(/Pix.*Cartão/)
  expect(screen.getByText('Venda aprovada com sucesso')).toBeInTheDocument()
  expect(screen.getByRole('heading',{name:'Cada venda movimenta toda a operação.'})).toBeInTheDocument()
  expect(screen.getByRole('heading',{name:'Criado para sua operação avançar.'})).toBeInTheDocument()
  expect(screen.getByRole('heading',{name:'Uma plataforma, várias perspectivas.'})).toBeInTheDocument()
 })
 it('oferece trilho de recursos com controles, teclado e módulos reais',()=>{
  const {container}=renderLanding(),rail=screen.getByLabelText('Recursos da plataforma') as HTMLElement
  const scrollBy=vi.fn();Object.defineProperty(rail,'scrollBy',{configurable:true,value:scrollBy})
  expect(container.querySelectorAll('.resource-rail article')).toHaveLength(8)
  fireEvent.click(screen.getByRole('button',{name:'Ver próximos recursos'}))
  fireEvent.keyDown(rail,{key:'ArrowLeft'})
  expect(scrollBy).toHaveBeenNthCalledWith(1,{left:340,behavior:'smooth'})
  expect(scrollBy).toHaveBeenNthCalledWith(2,{left:-340,behavior:'smooth'})
 })
 it.each([768,834,1024,1280,1440,1920])('mantém a composição premium funcional no viewport de %i px',width=>{
  Object.defineProperty(window,'innerWidth',{configurable:true,value:width})
  const {container}=renderLanding(),hero=container.querySelector('.landing-hero') as HTMLElement
  expect(hero).toBeInTheDocument()
  expect(container.querySelector('.public-phone')).toBeInTheDocument()
  expect(container.querySelectorAll('.phone-float')).toHaveLength(4)
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
 it('troca a prova visual por tabs reais, usa mapa geográfico e aceita navegação por setas',async()=>{
  const user=userEvent.setup();const view=renderLanding()
  await user.click(screen.getByRole('tab',{name:'Vendas ao Vivo'}))
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Atividade da operação')
  expect((await screen.findAllByRole('img',{name:/Mapa mundial do módulo Vendas ao Vivo/i},{timeout:10000})).length).toBeGreaterThan(0)
  await user.keyboard('{ArrowRight}')
  expect(screen.getByRole('tab',{name:'Financeiro'})).toHaveAttribute('aria-selected','true')
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Saldo disponível')
  expect(view.container).not.toHaveTextContent(/prévia estática|não inicia consultas|contexto protegido/i)
 })
 it('apresenta gráfico contextual e feed de Vendas ao Vivo sem esqueletos',async()=>{
  const {container}=renderLanding()
  expect(screen.getAllByRole('img',{name:/Gráfico ilustrativo de resultado/i}).length).toBeGreaterThanOrEqual(1)
  expect(screen.getByRole('img',{name:/Gráfico ilustrativo de performance/i})).toBeInTheDocument()
  expect(screen.getByRole('heading',{name:/Veja sua operação ganhar alcance/i})).toBeInTheDocument()
  expect(screen.getAllByText('Eventos recentes').length).toBeGreaterThan(0)
  expect((await screen.findAllByRole('img',{name:/Mapa mundial do módulo Vendas ao Vivo/i},{timeout:10000})).length).toBeGreaterThan(0)
  expect(container.querySelector('.public-map-countries')).toHaveAttribute('d',expect.stringMatching(/^M/))
  expect(container.querySelector('.live-public-visual')).not.toBeInTheDocument()
 })
 it.each([320,360,375,390,393,412,414,430])('mantém hero e mockup sem overflow no viewport mobile de %i px',width=>{
  Object.defineProperty(window,'innerWidth',{configurable:true,value:width})
  const {container}=renderLanding(),hero=container.querySelector('.landing-hero') as HTMLElement,mockup=container.querySelector('.landing-hero-visual') as HTMLElement
  expect(hero).toBeInTheDocument();expect(mockup).toBeInTheDocument()
  expect(hero.scrollWidth).toBeLessThanOrEqual(hero.clientWidth)
  expect(mockup.scrollWidth).toBeLessThanOrEqual(mockup.clientWidth)
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
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
