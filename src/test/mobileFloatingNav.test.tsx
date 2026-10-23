import {act,fireEvent,render,screen} from '@testing-library/react'
import {Link,MemoryRouter,Route,Routes,useLocation} from 'react-router-dom'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {MobileFloatingNav} from '../components/mobile-navigation/MobileFloatingNav'

// O CSS esconde o menu fora da largura do celular; no jsdom ele fica sem nome acessível, então a busca
// é pelos atributos.
function Where(){return <><output>{useLocation().pathname}</output><Link to="/app/social">Abrir Social</Link></>}
const mount=(entries:string[])=>render(<MemoryRouter initialEntries={entries} initialIndex={entries.length-1}><Routes><Route path="*" element={<><MobileFloatingNav/><Where/></>}/></Routes></MemoryRouter>)
const mobile=(matches:boolean)=>vi.mocked(window.matchMedia).mockImplementation(query=>({matches,media:query,onchange:null,addListener:vi.fn(),removeListener:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn(),dispatchEvent:vi.fn()}))
const nav=()=>document.querySelector<HTMLElement>('nav.floating-nav')
const item=(label:string)=>nav()!.querySelector<HTMLElement>(`[aria-label="${label}"]`)!
const labels=()=>[...nav()!.querySelectorAll('a,button')].map(element=>element.getAttribute('aria-label'))

describe('menu flutuante do celular',()=>{
 beforeEach(()=>mobile(true))
 afterEach(()=>{mobile(false);vi.useRealTimers()})
 it('mostra só os três atalhos, com o Dashboard no centro',()=>{
  mount(['/app'])
  expect(nav()).toHaveAttribute('aria-label','Atalhos do painel')
  expect(labels()).toEqual(['Vendas ao Vivo','Dashboard','Financeiro'])
  expect(item('Dashboard')).toHaveAttribute('aria-current','page')
 })
 it('não aparece fora do celular',()=>{
  mobile(false);mount(['/app'])
  expect(nav()).toBeNull()
 })
 it('vira a navegação do Social, publica, mostra avisos e volta para a tela anterior ao sair',()=>{
  vi.useFakeTimers()
  mount(['/app/financeiro','/app/social'])
  act(()=>{vi.advanceTimersByTime(1000)})
  expect(nav()).toHaveAttribute('aria-label','Navegação do Social')
  expect(labels()).toEqual(['Sair do modo social','Feed','Explorar','Publicar','Notificações','Mensagens'])
  expect(item('Feed')).toHaveAttribute('aria-current','page')
  const compose=vi.fn();window.addEventListener('social:compose',compose)
  fireEvent.click(item('Publicar'));expect(compose).toHaveBeenCalledOnce()
  window.removeEventListener('social:compose',compose)
  act(()=>{window.dispatchEvent(new CustomEvent('social:unread',{detail:3}))})
  expect(item('Notificações')).toHaveTextContent('3')
  fireEvent.click(item('Sair do modo social'))
  act(()=>{vi.advanceTimersByTime(1000)})
  expect(screen.getByRole('status')).toHaveTextContent('/app')
  expect(nav()).toHaveAttribute('aria-label','Atalhos do painel')
 })
 it('ao sair do Social volta para a tela em que estava antes',()=>{
  vi.useFakeTimers()
  mount(['/app/financeiro'])
  fireEvent.click(screen.getByRole('link',{name:'Abrir Social'}))
  act(()=>{vi.advanceTimersByTime(1000)})
  expect(nav()).toHaveAttribute('aria-label','Navegação do Social')
  fireEvent.click(item('Sair do modo social'))
  act(()=>{vi.advanceTimersByTime(1000)})
  expect(screen.getByRole('status')).toHaveTextContent('/app/financeiro')
  expect(item('Financeiro')).toHaveAttribute('aria-current','page')
 })
 it('some nas telas de edição em tela cheia',()=>{
  mount(['/app/produtos/p1/checkout/c1/builder'])
  expect(nav()).toBeNull()
 })
})
