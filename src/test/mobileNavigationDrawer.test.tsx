import {fireEvent,render,screen,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {MemoryRouter,Route,Routes} from 'react-router-dom'
import {describe,expect,it,vi} from 'vitest'
import {WorkspaceTopNavigation} from '../components/navigation/WorkspaceTopNavigation'
import {navigationItems,competitionNavigation} from '../config/navigation'

function Navigation(){return <><WorkspaceTopNavigation/><Routes><Route path="*" element={<p>Conteúdo do módulo</p>}/></Routes></>}
function renderNavigation(path='/app'){return render(<MemoryRouter initialEntries={[path]}><Navigation/></MemoryRouter>)}

describe('navegação superior responsiva',()=>{
 it('oferece todos os módulos e destaca somente a subrota atual',()=>{
  renderNavigation('/app/produtos/checkout')
  const nav=screen.getByRole('navigation',{name:'Navegação principal'})
  for(const item of [...navigationItems,competitionNavigation])expect(within(nav).getByRole('link',{name:item.id==='dashboard'?'Visão geral':item.label})).toHaveAttribute('href',item.path)
  expect(within(nav).getByRole('link',{name:'Checkouts'})).toHaveAttribute('aria-current','page')
  expect(within(nav).getByRole('link',{name:'Produtos'})).not.toHaveAttribute('aria-current')
  expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
 })
 it('navega e atualiza o item ativo sem um segundo menu',async()=>{
  const user=userEvent.setup();renderNavigation()
  await user.click(screen.getByRole('link',{name:'Financeiro'}))
  expect(screen.getByRole('link',{name:'Financeiro'})).toHaveAttribute('aria-current','page')
  expect(screen.getByRole('link',{name:'Visão geral'})).not.toHaveAttribute('aria-current')
  expect(screen.getAllByRole('navigation')).toHaveLength(1)
 })
 it('permite percorrer os módulos pelo teclado',async()=>{
  const user=userEvent.setup();renderNavigation()
  const first=screen.getByRole('link',{name:'Início'});first.focus()
  await user.keyboard('{ArrowRight}');expect(screen.getByRole('link',{name:'Visão geral'})).toHaveFocus()
  await user.keyboard('{End}');expect(screen.getByRole('link',{name:'Configurações'})).toHaveFocus()
  await user.keyboard('{Home}');expect(first).toHaveFocus()
  await user.keyboard('{ArrowLeft}');expect(screen.getByRole('link',{name:'Configurações'})).toHaveFocus()
 })
 it('rola o menu com a roda e libera a página ao chegar ao limite',()=>{
  renderNavigation();const nav=screen.getByRole('navigation',{name:'Navegação principal'})
  Object.defineProperties(nav,{scrollWidth:{value:1200},clientWidth:{value:393}})
  const wheel=new WheelEvent('wheel',{deltaY:120,bubbles:true,cancelable:true});fireEvent(nav,wheel)
  expect(wheel.defaultPrevented).toBe(true);expect(nav.scrollLeft).toBe(120)
  nav.scrollLeft=807;const end=new WheelEvent('wheel',{deltaY:120,bubbles:true,cancelable:true});fireEvent(nav,end)
  expect(end.defaultPrevented).toBe(false)
 })
 it('respeita movimento reduzido ao revelar a rota ativa',()=>{
  vi.mocked(window.matchMedia).mockReturnValueOnce({matches:true} as MediaQueryList)
  const scroll=vi.fn();Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:scroll})
  renderNavigation('/app/financeiro');expect(scroll).toHaveBeenCalledWith({block:'nearest',inline:'nearest',behavior:'instant'})
  Reflect.deleteProperty(HTMLElement.prototype,'scrollIntoView')
 })
})
