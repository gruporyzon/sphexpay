import { render,screen } from '@testing-library/react'
import { describe,expect,it,vi } from 'vitest'
import { DashboardScenarioEditor } from '../components/dashboard/DashboardScenarioEditor'
import { DemoModeBadge } from '../components/dashboard/DemoModeBadge'
import type { DashboardKpis } from '../types'

const kpis:DashboardKpis={revenue:100000,sales:250,ticket:400,goal:200000,progress:50,approval:96,pending:10000,profit:72000,growth:12}

describe('controles administrativos do dashboard',()=>{
 it('mantém a edição em ação contextual com tooltip, teclado e acesso mobile',()=>{
  const {container}=render(<DashboardScenarioEditor kpis={kpis} onSave={vi.fn()}/>)
  const button=screen.getByRole('button',{name:'Ajustar cenário demonstrativo'})
  expect(button).toHaveClass('dashboard-scenario-trigger')
  expect(button).toHaveAttribute('title','Ajustar cenário demonstrativo')
  expect(button).toHaveAttribute('data-mobile-action','true')
  expect(container.querySelector('.dashboard-scenario-action')).toBeInTheDocument()
 })

 it('identifica demonstração e produção sem misturar seus estados',()=>{
  const {rerender}=render(<DemoModeBadge mode="demo"/>)
  expect(screen.getByText('Dados de demonstração')).toBeInTheDocument()
  rerender(<DemoModeBadge mode="production"/>)
  expect(screen.getByText('Dados de produção')).toBeInTheDocument()
  expect(screen.queryByText('Dados de demonstração')).not.toBeInTheDocument()
 })
})
