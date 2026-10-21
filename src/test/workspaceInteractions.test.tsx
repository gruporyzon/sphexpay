import {useState} from 'react'
import {MemoryRouter} from 'react-router-dom'
import {act,fireEvent,render,screen,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {beforeEach,describe,expect,it,vi} from 'vitest'
import {WorkspaceSelectMenu} from '../components/navigation/WorkspaceSelectMenu'
import {useAppLocale} from '../i18n/localeStore'

function Form(){
 const [value,setValue]=useState('all')
 return <div className="internal-app-shell"><form aria-label="Filtros"><label>Status<select name="status" value={value} onChange={event=>setValue(event.target.value)}><option value="all">Todos</option><optgroup label="Transações"><option value="paid">Aprovadas</option><option value="pending">Pendentes</option><option value="disabled" disabled>Bloqueadas</option></optgroup></select></label><output>{value}</output><button type="button">Fora</button></form></div>
}
const mount=()=>render(<MemoryRouter><WorkspaceSelectMenu/><Form/></MemoryRouter>)
beforeEach(()=>{document.documentElement.dataset.topSurface='app';act(()=>useAppLocale.getState().setLocale('pt-BR'))})

describe('seletores compartilhados do workspace',()=>{
 it('abre pelo rótulo e permite cancelar por um segundo clique sem afetar botões',async()=>{
  mount();const user=userEvent.setup(),label=screen.getByText('Status',{selector:'label'})
  await user.click(label);expect(screen.getByRole('listbox',{name:'Status'})).toBeVisible()
  await user.click(label);expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  const click=vi.fn((event:Event)=>expect(event.defaultPrevented).toBe(false))
  screen.getByRole('button',{name:'Fora'}).addEventListener('click',click)
  await user.click(screen.getByRole('button',{name:'Fora'}));expect(click).toHaveBeenCalledOnce()
 })
 it('mantém o estado React e o valor do formulário ao selecionar no menu',async()=>{
  mount();const user=userEvent.setup(),select=screen.getByRole('combobox',{name:'Status'})
  await user.click(select);const list=screen.getByRole('listbox',{name:'Status'})
  expect(select).toHaveAttribute('aria-expanded','true')
  await user.click(within(list).getByRole('option',{name:'Aprovadas'}))
  expect(select).toHaveValue('paid');expect(screen.getByRole('status')).toHaveTextContent('paid')
  expect(new FormData(screen.getByRole('form') as HTMLFormElement).get('status')).toBe('paid')
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();expect(select).toHaveFocus();expect(select).not.toHaveAttribute('aria-controls')
 })
 it('navega com setas, Home/End e confirma com Enter ignorando opções desabilitadas',async()=>{
  mount();const user=userEvent.setup(),select=screen.getByRole('combobox')
  select.focus();await user.keyboard('{ArrowDown}{End}{Enter}')
  expect(select).toHaveValue('pending')
  await user.keyboard('{ArrowDown}{Home}{ArrowDown}{Enter}');expect(select).toHaveValue('paid')
 })
 it('Escape cancela sem mudar valores e Tab fecha sem prender o foco',async()=>{
  mount();const user=userEvent.setup(),select=screen.getByRole('combobox')
  await user.click(select);await user.keyboard('{End}{Escape}');expect(select).toHaveValue('all');expect(select).toHaveFocus()
  await user.click(select);await user.tab();expect(screen.queryByRole('listbox')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Fora'})).toHaveFocus()
 })
 it('preserva grupos, busca por digitação e impede escolha desabilitada',async()=>{
  mount();const user=userEvent.setup(),select=screen.getByRole('combobox')
  await user.click(select);let list=screen.getByRole('listbox')
  expect(within(list).getByText('Transações')).toBeVisible()
  await user.click(within(list).getByRole('option',{name:'Bloqueadas'}));expect(select).toHaveValue('all')
  await user.click(select);list=screen.getByRole('listbox');await user.keyboard('pen{Enter}');expect(select).toHaveValue('pending')
 })
 it('fecha ao clicar fora ou trocar idioma sem mudar o formulário',async()=>{
  mount();const user=userEvent.setup(),select=screen.getByRole('combobox')
  await user.click(select);await user.click(screen.getByRole('button',{name:'Fora'}));expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  await user.click(select);act(()=>useAppLocale.getState().setLocale('en-US'));expect(screen.queryByRole('listbox')).not.toBeInTheDocument();expect(select).toHaveValue('all')
 })
 it('preserva select público, canvas de checkout e controles múltiplos',async()=>{
  render(<MemoryRouter><WorkspaceSelectMenu/><label>Público<select><option>Teste</option></select></label><div className="internal-app-shell"><div className="studio-canvas"><label>Canvas<select><option>Teste</option></select></label></div><label>Múltiplo<select multiple><option>Teste</option></select></label></div></MemoryRouter>)
  const user=userEvent.setup();for(const select of document.querySelectorAll('select')){await user.click(select);expect(document.querySelector('.workspace-select-menu')).toBeNull()}
 })
 it('conserva o evento nativo existente para consumidores que selecionam por API',async()=>{
  mount();const user=userEvent.setup();await user.selectOptions(screen.getByRole('combobox'),'paid');expect(screen.getByRole('status')).toHaveTextContent('paid')
 })
 it('não despacha outra alteração ao confirmar o valor já selecionado',async()=>{
  mount();const change=vi.fn(),select=screen.getByRole('combobox');select.addEventListener('change',change)
  const user=userEvent.setup();await user.click(select);await user.click(within(screen.getByRole('listbox')).getByRole('option',{name:'Todos'}));expect(change).not.toHaveBeenCalled()
 })
 it('revela opções por teclado rolando somente a lista, inclusive ao repetir Home',async()=>{
  mount();const user=userEvent.setup(),select=screen.getByRole('combobox')
  await user.click(select);const list=screen.getByRole('listbox'),options=within(list).getAllByRole('option')
  Object.defineProperty(list,'clientHeight',{value:100})
  options.forEach((option,index)=>{Object.defineProperty(option,'offsetTop',{value:6+index*90});Object.defineProperty(option,'offsetHeight',{value:40})})
  await user.keyboard('{End}');expect(list.scrollTop).toBe(132);expect(select).toHaveValue('all')
  expect(document.documentElement.scrollTop).toBe(0)
  await user.keyboard('{Home}');expect(list.scrollTop).toBe(0)
  list.scrollTop=80;await user.keyboard('{Home}');expect(list.scrollTop).toBe(0)
 })
 it('permite rolar com toque e passar o mouse sem reposicionar a lista',async()=>{
  mount();const user=userEvent.setup(),select=screen.getByRole('combobox')
  await user.click(select);const list=screen.getByRole('listbox'),option=within(list).getByRole('option',{name:'Pendentes'})
  list.scrollTop=55;const initial=select.getAttribute('aria-activedescendant')
  const touch=new Event('pointermove',{bubbles:true});Object.defineProperty(touch,'pointerType',{value:'touch'});fireEvent(option,touch)
  expect(select).toHaveAttribute('aria-activedescendant',initial);expect(list.scrollTop).toBe(55)
  await user.hover(option);expect(select).toHaveAttribute('aria-activedescendant',option.id);expect(list.scrollTop).toBe(55)
 })
})
