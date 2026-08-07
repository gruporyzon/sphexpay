import { MemoryRouter } from 'react-router-dom'
import { render,screen } from '@testing-library/react'
import { beforeEach,describe,expect,it,vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import Dashboard from '../pages/Dashboard'

const state=vi.hoisted(()=>({admin:{allowed:false,loading:false,error:''}}))
vi.mock('../hooks/useAuth',()=>({useAuth:()=>({user:{id:'user-1'}})}))
vi.mock('../hooks/useDashboardAdmin',()=>({useDashboardAdmin:()=>state.admin}))
vi.mock('../hooks/useLiveSales',()=>({useLiveSales:()=>({sales:[],previous:[],loading:false,error:'',realtime:'live',updatedAt:'',refresh:vi.fn()})}))
vi.mock('../hooks/useScenarioPlanner',()=>({useScenarioPlanner:()=>({scenario:{todayRevenueCents:0,todayApprovedSales:0,averageTicketCents:0,approvalRate:.9,refundRate:0,chargebackRate:0,dailyGrowthRate:0,weekdayFactors:[1,1,1,1,1,1,1],hourlyDistribution:Array(24).fill(1/24),seed:1,currency:'BRL'},save:vi.fn(),loading:false,error:''})}))
vi.mock('../services/dashboardService',()=>({dashboardService:{loadRates:vi.fn(async()=>[]),saveRates:vi.fn(async()=>undefined)}}))
vi.mock('../components/dashboard/OverviewHeroCarousel',()=>({OverviewHeroCarousel:()=>null}))
vi.mock('../components/dashboard/NextAwardCard',()=>({NextAwardCard:()=>null}))

const renderDashboard=()=>render(<MemoryRouter><Dashboard/></MemoryRouter>)
describe('autorização administrativa do Dashboard',()=>{
 beforeEach(()=>{state.admin={allowed:false,loading:false,error:''};Object.defineProperty(window,'innerWidth',{configurable:true,value:1024})})
 it('mostra o editor para administrador validado',()=>{state.admin={allowed:true,loading:false,error:''};renderDashboard();expect(screen.getByRole('button',{name:'Editar planejamento'})).toBeInTheDocument()})
 it('mostra o editor de layout somente para administrador validado',()=>{state.admin={allowed:true,loading:false,error:''};renderDashboard();expect(screen.getByRole('button',{name:'Editar layout'})).toBeInTheDocument()})
 it('oculta os editores para usuário comum',()=>{renderDashboard();expect(screen.queryByRole('button',{name:'Editar planejamento'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Editar layout'})).not.toBeInTheDocument()})
 it('mostra aviso quando a consulta administrativa falha',()=>{state.admin={allowed:false,loading:false,error:'Não foi possível validar o acesso administrativo.'};renderDashboard();expect(screen.getByText('Não foi possível validar o acesso administrativo.')).toBeInTheDocument()})
 it('mostra carregamento enquanto consulta o papel',()=>{state.admin={allowed:false,loading:true,error:''};renderDashboard();expect(screen.getByText('Validando acesso administrativo...')).toBeInTheDocument()})
 it('move uma única ação de layout para depois dos meios de pagamento no mobile e preserva o editor',async()=>{
  Object.defineProperty(window,'innerWidth',{configurable:true,value:390});state.admin={allowed:true,loading:false,error:''};const user=userEvent.setup(),view=renderDashboard()
  const action=screen.getByRole('button',{name:'Editar layout'}),payment=view.container.querySelector('.dashboard-payment-section'),mobileAction=view.container.querySelector('.dashboard-layout-mobile-action')
  expect(screen.getAllByRole('button',{name:'Editar layout'})).toHaveLength(1)
  expect(view.container.querySelector('.dashboard-filter-bar')).not.toContainElement(action)
  expect(mobileAction).toContainElement(action)
  expect(payment?.nextElementSibling).toBe(mobileAction)
  await user.click(action);expect(screen.getByLabelText('Ferramentas do editor')).toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:'Cancelar'}));expect(screen.queryByLabelText('Ferramentas do editor')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:'Editar layout'}));expect(screen.getByLabelText('Ferramentas do editor')).toBeInTheDocument()
 })
})
