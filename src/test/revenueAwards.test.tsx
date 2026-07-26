import { fireEvent,render,screen } from '@testing-library/react'
import { describe,expect,it } from 'vitest'
import { AwardDisplay } from '../components/awards/AwardDisplay'
import { awardState,nextRevenueAward,revenueAwards } from '../config/revenueAwards'

describe('plaquinhas oficiais de faturamento',()=>{
 it.each([
  [0,'10k'],[9_999,'10k'],[10_000,'100k'],[99_999,'100k'],[100_000,'500k'],
  [499_999,'500k'],[500_000,'1m'],[999_999,'1m'],[1_000_000,'5m'],[4_999_999,'5m']
 ])('seleciona a próxima premiação para %s', (revenue,id)=>expect(nextRevenueAward(revenue)?.id).toBe(id))

 it('considera toda a coleção conquistada acima de cinco milhões',()=>expect(nextRevenueAward(5_000_000)).toBeUndefined())

 it('centraliza os caminhos oficiais das cinco imagens',()=>{
  expect(revenueAwards.map(item=>item.image)).toEqual([
   '/premiacoes/sphex-10k.png','/premiacoes/sphex-100k.png','/premiacoes/sphex-500k.png','/premiacoes/sphex-1m.png','/premiacoes/sphex-5m-plus.png'
  ])
 })

 it('calcula estados conquistada, próxima e bloqueada',()=>{
  expect(revenueAwards.map((_,index)=>awardState(120_000,index))).toEqual(['unlocked','unlocked','next','locked','locked'])
 })

 it('exibe fallback acessível quando a imagem estiver ausente',()=>{
  const award={...revenueAwards[0],title:revenueAwards[0].name,redeemed:false}
  render(<AwardDisplay achievement={award} unlocked={false} state="locked"/>)
  fireEvent.error(screen.getByAltText('Plaquinha oficial Sphex 10K'))
  expect(screen.getByRole('img',{name:'Imagem indisponível de Sphex 10K'})).toBeInTheDocument()
 })
})
