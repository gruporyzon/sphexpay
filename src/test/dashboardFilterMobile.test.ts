import {describe,expect,it,beforeEach,vi} from 'vitest'
import {act,render,screen,within} from '@testing-library/react'
import {createElement,useState} from 'react'
import userEvent from '@testing-library/user-event'
import {DashboardPeriodFilter,DashboardCurrencySelector} from '../components/dashboard/DashboardControls'
import {RealtimeStatus} from '../components/dashboard/RealtimeStatus'
import {useAppLocale} from '../i18n/localeStore'
import type {PeriodFilter} from '../types'
import type {Currency} from '../lib/dashboardFinance'

function Controls(){const [period,setPeriod]=useState<PeriodFilter>({preset:'7d'}),[currency,setCurrency]=useState<Currency>('BRL');return createElement('div',null,createElement(DashboardPeriodFilter,{period,onChange:setPeriod}),createElement(DashboardCurrencySelector,{currency,onChange:setCurrency}))}
beforeEach(()=>act(()=>useAppLocale.getState().setLocale('pt-BR')))
describe('filtros compartilhados com a Visão geral',()=>{
 it('troca períodos pelos botões e informa a seleção atual',async()=>{
  render(createElement(Controls));const user=userEvent.setup(),group=screen.getByRole('group',{name:'Período do gráfico'})
  expect(within(group).getByRole('button',{name:'7 dias'})).toHaveAttribute('aria-pressed','true')
  await user.click(within(group).getByRole('button',{name:'90 dias'}));expect(within(group).getByRole('button',{name:'90 dias'})).toHaveAttribute('aria-pressed','true')
  expect(within(group).getByRole('button',{name:'7 dias'})).toHaveAttribute('aria-pressed','false')
 })
 it('mantém os presets avançados e as datas inicial/final',async()=>{
  render(createElement(Controls));const user=userEvent.setup();await user.click(screen.getByLabelText('Mais filtros'))
  await user.selectOptions(screen.getByRole('combobox',{name:'Período do gráfico'}),'custom')
  expect(screen.getByLabelText('Data inicial do gráfico')).toBeVisible();expect(screen.getByLabelText('Data final do gráfico')).toBeVisible()
  expect(screen.getByLabelText('Mais filtros')).toHaveTextContent('Personalizado')
  await user.selectOptions(screen.getByRole('combobox',{name:'Período do gráfico'}),'today');expect(screen.getByLabelText('Mais filtros')).toHaveTextContent('Hoje')
 })
 it('troca moeda e mantém a escolha ao alterar o idioma',async()=>{
  render(createElement(Controls));const user=userEvent.setup(),group=screen.getByRole('group',{name:'Moeda de exibição'})
  await user.click(within(group).getByRole('button',{name:'US$ USD'}));act(()=>useAppLocale.getState().setLocale('en-US'))
  expect(screen.getByRole('group',{name:'Display currency'})).toBeVisible();expect(screen.getByRole('button',{name:'US$ USD'})).toHaveAttribute('aria-pressed','true')
 })
 it('preserva callbacks existentes e o modo de formulário',async()=>{
  const change=vi.fn();render(createElement(DashboardPeriodFilter,{period:{preset:'7d',from:'2026-10-01'},onChange:change,compact:false}))
  await userEvent.selectOptions(screen.getByRole('combobox'),'30d');expect(change).toHaveBeenCalledWith({preset:'30d',from:'2026-10-01'})
 })
 it('mantém a atualização em tempo real funcional',async()=>{
  const refresh=vi.fn();render(createElement(RealtimeStatus,{status:'live',updatedAt:'',onRefresh:refresh,loading:false}));await userEvent.click(screen.getByRole('button',{name:'Atualizar vendas'}));expect(refresh).toHaveBeenCalledOnce()
 })
})
