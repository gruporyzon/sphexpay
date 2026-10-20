import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe,expect,it,vi,beforeEach } from 'vitest'
import {act,render,screen} from '@testing-library/react'
import {createElement} from 'react'
import userEvent from '@testing-library/user-event'
import {DashboardPeriodFilter,DashboardCurrencySelector} from '../components/dashboard/DashboardControls'
import {RealtimeStatus} from '../components/dashboard/RealtimeStatus'
import {useAppLocale} from '../i18n/localeStore'

const css=readFileSync(resolve(process.cwd(),'src/index.css'),'utf8')

describe('filtros do Dashboard no mobile',()=>{
 beforeEach(()=>act(()=>useAppLocale.getState().setLocale('pt-BR')))
 it('usa selects nativos compactos sem cortar texto',()=>{
  expect(css).toContain('height:50px;')
  expect(css).toContain('min-height:50px;')
  expect(css).toContain('line-height:1.3;')
  expect(css).toContain('font-size:16px;')
 })
 it('organiza período e moeda em duas colunas e recolhe para uma coluna em 320px',()=>{
  expect(css).toContain('grid-template-columns:minmax(112px,.8fr) minmax(0,1.2fr)')
  expect(css).toContain('@media(max-width:359px)')
  expect(css).toContain('.dashboard-page .dashboard-filter-bar{grid-template-columns:minmax(0,1fr);gap:12px}')
  expect(css).toContain('.dashboard-page .dashboard-realtime{grid-column:1/-1')
 })
 it('compacta labels, ícones, status e botão sem reduzir áreas de toque',async()=>{
  expect(css).toContain('grid-template-columns:20px minmax(0,1fr)')
  expect(css).toContain('width:20px;height:20px')
  expect(css).toContain('width:44px;height:44px')
  const refresh=vi.fn();render(createElement(RealtimeStatus,{status:'live',updatedAt:'',onRefresh:refresh,loading:false}));expect(screen.getByText('Atualização ao vivo')).toBeVisible();await userEvent.click(screen.getByRole('button',{name:'Atualizar vendas'}));expect(refresh).toHaveBeenCalledOnce()
 })
 it('mantém o texto em uma linha e reserva espaço para a seta',()=>{
  expect(css).toContain('padding:0 42px 0 14px;')
  expect(css).toContain('white-space:nowrap;')
  expect(css).toContain('text-overflow:ellipsis;')
  expect(css).toContain('-webkit-appearance:auto;')
 })
 it('mantém selects acessíveis e valores estáveis ao trocar o idioma',async()=>{
  const periodChange=vi.fn(),currencyChange=vi.fn()
  render(createElement('div',null,createElement(DashboardPeriodFilter,{period:{preset:'7d'},onChange:periodChange}),createElement(DashboardCurrencySelector,{currency:'BRL',onChange:currencyChange})))
  await userEvent.selectOptions(screen.getByRole('combobox',{name:'Período do gráfico'}),'90d');expect(periodChange).toHaveBeenCalledWith({preset:'90d'})
  await userEvent.selectOptions(screen.getByRole('combobox',{name:'Moeda de exibição'}),'USD');expect(currencyChange).toHaveBeenCalledWith('USD')
  act(()=>useAppLocale.getState().setLocale('en-US'));expect(screen.getByRole('combobox',{name:'Display currency'})).toHaveValue('BRL');expect(screen.getByRole('option',{name:/USD/})).toHaveValue('USD')
 })
 it('limita a alteração ao breakpoint mobile',()=>{
  const start=css.indexOf('/* Native dashboard selects'),end=css.indexOf('/* Mobile podium',start),block=css.slice(start,end)
  expect(block).toContain('@media(max-width:767px)')
  expect(block).toContain('.dashboard-page .dashboard-filter-bar')
  expect(block).not.toContain('@media(min-width')
 })
 it('preserva as regras compartilhadas e o desktop',()=>{
  expect(css).toContain('.dashboard-filter-bar{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;padding:16px}')
  expect(css).toContain('height:60px;')
  expect(css.indexOf('.dashboard-page .dashboard-filter-bar{display:grid;grid-template-columns:minmax(112px')).toBeGreaterThan(css.indexOf('@media(max-width:767px)'))
 })
})
