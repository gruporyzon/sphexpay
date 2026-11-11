import {act,fireEvent,render,screen,within} from '@testing-library/react'
import {MemoryRouter,Route,Routes,useLocation} from 'react-router-dom'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {MobileFloatingNav} from '../components/mobile-navigation/MobileFloatingNav'
import {MobileTabBar} from '../components/mobile-navigation/MobileTabBar'
import {useTabBarPreferences} from '../store/useTabBarPreferences'

// O CSS não é aplicado no jsdom: a busca é pelos atributos, como no teste do menu flutuante.
function Where(){return <output>{useLocation().pathname}</output>}
const mount=(path:string)=>render(<MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={<><MobileTabBar/><MobileFloatingNav mainShortcuts={false}/><Where/></>}/></Routes></MemoryRouter>)
const mobile=(matches:boolean)=>vi.mocked(window.matchMedia).mockImplementation(query=>({matches,media:query,onchange:null,addListener:vi.fn(),removeListener:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn(),dispatchEvent:vi.fn()}))
const bar=()=>document.querySelector<HTMLElement>('nav.mobile-tab-bar')
const tab=(label:string)=>bar()!.querySelector<HTMLElement>(`[aria-label="${label}"]`)!
const labels=()=>[...bar()!.querySelectorAll('a,button')].map(element=>element.getAttribute('aria-label'))

describe('barra de abas do celular',()=>{
 beforeEach(()=>mobile(true))
 afterEach(()=>{mobile(false);Reflect.deleteProperty(navigator,'vibrate');vi.useRealTimers()})

 it('mostra Início, Vendas, Financeiro, Produtos e a foto (Mais), com a aba da tela atual em destaque',()=>{
  mount('/app/financeiro')
  expect(bar()).toHaveAttribute('aria-label','Navegação principal')
  expect(labels()).toEqual(['Início','Vendas','Financeiro','Produtos','Mais módulos'])
  expect(tab('Financeiro')).toHaveAttribute('aria-current','page')
  expect(tab('Início')).not.toHaveAttribute('aria-current')
  expect(tab('Mais módulos')).not.toHaveAttribute('aria-current')
 })
 it('marca Início só na raiz do painel e Vendas também em telas filhas',()=>{
  const view=mount('/app')
  expect(tab('Início')).toHaveAttribute('aria-current','page')
  view.unmount()
  mount('/app/vendas/tx_1')
  expect(tab('Vendas')).toHaveAttribute('aria-current','page')
  expect(tab('Início')).not.toHaveAttribute('aria-current')
 })
 it('destaca Mais quando a tela atual é de um módulo que está na folha',()=>{
  mount('/app/relatorios')
  expect(tab('Mais módulos')).toHaveAttribute('aria-current','page')
  expect(bar()!.querySelector('[aria-current="page"]')).toBe(tab('Mais módulos'))
 })
 it('navega ao tocar numa aba',()=>{
  mount('/app')
  fireEvent.click(tab('Produtos'))
  expect(screen.getByRole('status')).toHaveTextContent('/app/produtos')
  expect(tab('Produtos')).toHaveAttribute('aria-current','page')
 })
 it('vibra ao tocar nas abas e em Mais',()=>{
  const vibrate=vi.fn()
  Object.defineProperty(navigator,'vibrate',{value:vibrate,configurable:true})
  mount('/app')
  fireEvent.click(tab('Vendas'))
  expect(vibrate).toHaveBeenCalledWith(10)
  fireEvent.click(tab('Mais módulos'))
  expect(vibrate).toHaveBeenCalledTimes(2)
 })
 it('abre a folha Mais com os demais módulos, sem repetir as quatro abas',()=>{
  mount('/app')
  fireEvent.click(tab('Mais módulos'))
  expect(tab('Mais módulos')).toHaveAttribute('aria-expanded','true')
  const sheet=screen.getByRole('dialog',{name:'Mais módulos',hidden:true})
  expect(within(sheet).getByRole('button',{name:'Relatórios',hidden:true})).toBeInTheDocument()
  expect(within(sheet).getByRole('button',{name:'Social',hidden:true})).toBeInTheDocument()
  expect(within(sheet).queryByRole('button',{name:'Vendas',hidden:true})).toBeNull()
  expect(within(sheet).queryByRole('button',{name:'Financeiro',hidden:true})).toBeNull()
 })
 it('mostra o contador de avisos na foto do perfil quando há novidades no Social',()=>{
  mount('/app')
  expect(bar()!.querySelector('.mobile-tab-badge')).toBeNull()
  act(()=>{window.dispatchEvent(new CustomEvent('social:unread',{detail:2}))})
  expect(bar()!.querySelector('.mobile-tab-badge')).toHaveTextContent('2')
 })
 it('não vibra quando a vibração está desligada nas Configurações',()=>{
  const vibrate=vi.fn()
  Object.defineProperty(navigator,'vibrate',{value:vibrate,configurable:true})
  useTabBarPreferences.getState().setHaptics(false)
  mount('/app')
  fireEvent.click(tab('Vendas'))
  expect(vibrate).not.toHaveBeenCalled()
  useTabBarPreferences.getState().setHaptics(true)
 })
 it('não aparece fora do celular, no Social nem nas telas de edição em tela cheia',()=>{
  mobile(false);const view=mount('/app')
  expect(bar()).toBeNull()
  view.unmount();mobile(true)
  mount('/app/produtos/p1/checkout/c1/builder')
  expect(bar()).toBeNull()
 })
 it('cede o lugar ao menu flutuante do Social',()=>{
  vi.useFakeTimers()
  mount('/app/social')
  act(()=>{vi.advanceTimersByTime(1000)})
  expect(bar()).toBeNull()
  expect(document.querySelector('nav.floating-nav')).toHaveAttribute('aria-label','Navegação do Social')
 })
 it('o menu flutuante não repete os atalhos do painel quando a barra de abas está ativa',()=>{
  mount('/app')
  expect(document.querySelector('nav.floating-nav')).toBeNull()
 })
})
