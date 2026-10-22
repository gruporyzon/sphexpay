import { render,screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach,describe,expect,it } from 'vitest'
import { WorkspaceSidebar } from '../components/navigation/WorkspaceSidebar'

const at=(path:string)=>render(<MemoryRouter initialEntries={[path]}><WorkspaceSidebar/></MemoryRouter>)
afterEach(()=>localStorage.clear())

describe('menu lateral do computador',()=>{
 it('agrupa as áreas e marca só o item da aba atual',()=>{
  at('/app/vendas?aba=encomendas')
  expect(screen.getByRole('link',{name:'Encomendas'})).toHaveAttribute('aria-current','page')
  expect(screen.getByRole('link',{name:'Transações'})).not.toHaveAttribute('aria-current')
  expect(screen.getByRole('button',{name:'Financeiro'})).toBeInTheDocument()
  expect(screen.getByRole('link',{name:'Fretes'})).toHaveAttribute('href','/app/produtos/fretes')
 })
 it('recolhe grupo, recolhe o menu e lembra a preferência',async()=>{
  const user=userEvent.setup(),{unmount}=at('/app')
  await user.click(screen.getByRole('button',{name:'Relatórios'}))
  expect(screen.queryByRole('link',{name:'Carrinhos abandonados'})).not.toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:'Recolher menu'}))
  expect(JSON.parse(localStorage.getItem('sphex-sidebar')||'{}')).toEqual({pinned:false,closed:['reports']})
  unmount();at('/app')
  expect(screen.getByRole('button',{name:'Fixar menu aberto'})).toHaveAttribute('aria-pressed','false')
 })
 it('mantém aberto o grupo da página atual mesmo se recolhido antes',()=>{
  localStorage.setItem('sphex-sidebar',JSON.stringify({pinned:true,closed:['reports']}))
  at('/app/relatorios/afiliados')
  expect(screen.getByRole('link',{name:'Afiliados',current:'page'})).toBeInTheDocument()
 })
})
