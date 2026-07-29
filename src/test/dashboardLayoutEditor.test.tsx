import { render,screen,within } from '@testing-library/react'
import type { ReactNode } from 'react'
import userEvent from '@testing-library/user-event'
import { describe,expect,it,vi } from 'vitest'
import { DashboardLayoutButton,DashboardLayoutEditor } from '../components/dashboard/DashboardLayoutEditor'
import { useDashboardLayout } from '../hooks/useDashboardLayout'
import { DASHBOARD_LAYOUT_STORAGE_KEY,DASHBOARD_WIDGET_IDS,DASHBOARD_WIDGET_LABELS,type DashboardWidgetId } from '../lib/dashboardLayout'

const widgets=Object.fromEntries(DASHBOARD_WIDGET_IDS.map(id=>[id,<div key={id}>{DASHBOARD_WIDGET_LABELS[id]}</div>])) as Record<DashboardWidgetId,ReactNode>
function Harness(){const editor=useDashboardLayout('editor-user');return <><DashboardLayoutButton editor={editor}/><DashboardLayoutEditor editor={editor} widgets={widgets}/></>}

describe('editor visual do Dashboard',()=>{
 it('entra, move por teclado, desfaz, refaz, visualiza, cancela e preserva o armazenamento',async()=>{
  const user=userEvent.setup(),view=render(<Harness/>)
  await user.click(screen.getByRole('button',{name:'Editar layout'}))
  await user.click(screen.getByRole('button',{name:'Computador'}))
  expect(screen.getByLabelText('Ferramentas do editor')).toBeInTheDocument()
  const fees=screen.getByRole('button',{name:'Mover Taxas para cima'})
  await user.click(fees)
  expect(view.container.querySelector('[data-widget-id="fees"]')).toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:'Desfazer'}))
  await user.click(screen.getByRole('button',{name:'Refazer'}))
  await user.click(screen.getByRole('button',{name:'Visualizar'}))
  expect(screen.queryByRole('button',{name:'Arrastar Taxas'})).not.toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:'Voltar ao editor'}))
  await user.click(screen.getByRole('button',{name:'Cancelar'}))
  expect(screen.queryByLabelText('Ferramentas do editor')).not.toBeInTheDocument()
  expect(localStorage.getItem(`${DASHBOARD_LAYOUT_STORAGE_KEY}:editor-user`)).toBeNull()
 })
 it('mantém desktop e celular independentes, redimensiona e salva sem recarregar',async()=>{
  const user=userEvent.setup(),view=render(<Harness/>);await user.click(screen.getByRole('button',{name:'Editar layout'}))
  await user.click(screen.getByRole('button',{name:'Celular'}))
  const chart=view.container.querySelector('[data-widget-id="revenue-chart"]') as HTMLElement
  await user.click(within(chart).getByRole('button',{name:'Mover Gráfico principal para cima'}))
  await user.click(within(chart).getByRole('button',{name:'Arrastar Gráfico principal'}))
  expect(screen.getByLabelText('Propriedades do bloco')).toBeInTheDocument()
  expect(screen.getByLabelText('Propriedades do bloco').querySelector('select')).toBeDisabled()
  await user.click(screen.getByRole('button',{name:'Computador'}))
  expect(view.container.querySelector('.dashboard-layout-grid')?.firstElementChild).toHaveAttribute('data-widget-id','gross-revenue')
  await user.click(screen.getByRole('button',{name:'Salvar'}))
  const stored=JSON.parse(localStorage.getItem(`${DASHBOARD_LAYOUT_STORAGE_KEY}:editor-user`)!)
  expect(stored.version).toBe(1)
  expect(stored.userId).toBe('editor-user')
  expect(stored.layouts.mobile.find((item:{widgetId:string})=>item.widgetId==='revenue-chart').order).toBe(7)
  expect(stored.layouts.desktop[0].widgetId).toBe('gross-revenue')
 })
 it('aplica preset de gráfico em destaque e restaura com confirmação',async()=>{
  const confirm=vi.spyOn(window,'confirm').mockReturnValue(true),user=userEvent.setup(),view=render(<Harness/>)
  await user.click(screen.getByRole('button',{name:'Editar layout'}))
  await user.click(screen.getByRole('button',{name:'Computador'}))
  await user.selectOptions(screen.getByLabelText('Preset de layout'),'chart-focus')
  expect(view.container.querySelector('.dashboard-layout-grid')?.firstElementChild).toHaveAttribute('data-widget-id','revenue-chart')
  await user.click(screen.getByRole('button',{name:'Restaurar padrão'}))
  expect(confirm).toHaveBeenCalledTimes(2)
  expect(view.container.querySelector('.dashboard-layout-grid')?.firstElementChild).toHaveAttribute('data-widget-id','gross-revenue')
  confirm.mockRestore()
 })
})
