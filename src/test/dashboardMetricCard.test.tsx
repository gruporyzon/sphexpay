import { render,screen } from '@testing-library/react'
import { CircleDollarSign } from 'lucide-react'
import { describe,expect,it } from 'vitest'
import { PremiumStatCard } from '../components/dashboard/PremiumStatCard'

describe('PremiumStatCard',()=>{
 it('mantém topo, valor completo e descrição em blocos consecutivos',()=>{
  const {container}=render(<PremiumStatCard stat={{label:'Faturamento dos últimos 7 dias',value:999999900,format:'money',delta:57.2,icon:CircleDollarSign,featured:true}} index={0} refreshing={false} format={()=> 'R$ 9.999.999,00'}/>)
  const card=container.querySelector('.metric-card')
  const top=container.querySelector('.metric-card-top')
  const copy=container.querySelector('.metric-copy')

  expect(card).not.toBeNull()
  expect(top?.nextElementSibling).toBe(copy)
  expect(screen.getByText('R$ 9.999.999,00')).toBeVisible()
  expect(screen.getByText('57.2%')).toBeVisible()
  expect(screen.getByText('Faturamento dos últimos 7 dias')).toBeVisible()
 })
})
