import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Showcase from '../pages/Showcase'
import { getProductShowcaseEligibility, type ShowcaseProduct } from '../features/showcase/showcaseEligibility'
const mocks = vi.hoisted(() => ({ list: vi.fn(), setPublished: vi.fn(), auth: {user:{id:'owner'},loading:false} }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase', () => ({ supabase:null }))
vi.mock('../features/showcase/showcaseService', () => ({ showcaseService: mocks, showcaseError: () => 'Não foi possível atualizar a vitrine.' }))
const product = (grossSalesCents:number, publishedAt:string|null=null):ShowcaseProduct => ({id:'product',name:'Meu curso',category:'Educação',imageUrl:null,grossSalesCents,publishedAt,status:getProductShowcaseEligibility(grossSalesCents,publishedAt).status})
const renderPage = () => render(<MemoryRouter><Showcase /></MemoryRouter>)
beforeEach(() => { vi.clearAllMocks(); mocks.auth={user:{id:'owner'},loading:false}; mocks.list.mockResolvedValue([]); mocks.setPublished.mockResolvedValue(undefined) })

describe('Vitrine por performance', () => {
 it('não contém cards fictícios e orienta no estado vazio', async () => {
  renderPage()
  expect(await screen.findByText('Sua vitrine ainda está vazia')).toBeVisible()
  expect(screen.queryAllByRole('article')).toHaveLength(0)
  expect(screen.getByRole('button',{name:/Ver meus produtos elegíveis/})).toBeEnabled()
 })
 it('mostra R$ 680 vendidos, R$ 320 restantes e bloqueia o botão', async () => {
  mocks.list.mockResolvedValue([product(68000)]); renderPage()
  const card = await screen.findByRole('article',{name:'Meu curso'})
  expect(within(card).getByText(/Faltam R\$\s320,00/)).toBeVisible()
  expect(within(card).getByRole('progressbar')).toHaveAttribute('value','68')
  expect(within(card).getByRole('button',{name:'Adicionar à vitrine'})).toBeDisabled()
 })
 it('publica somente após confirmação do servidor e permite remover', async () => {
  mocks.list.mockResolvedValue([product(100000)])
  const user=userEvent.setup(); renderPage()
  const add = await screen.findByRole('button',{name:'Adicionar à vitrine'})
  mocks.list.mockResolvedValue([product(100000,'2026-09-16')])
  await user.click(add)
  expect(mocks.setPublished).toHaveBeenCalledWith('product',true)
  expect(await screen.findByText('Meu curso foi adicionado à vitrine.')).toBeVisible()
  expect(screen.queryByText('Sua vitrine ainda está vazia')).not.toBeInTheDocument()
  mocks.list.mockResolvedValue([product(100000)])
  await user.click(screen.getAllByRole('button',{name:'Remover da vitrine'})[0])
  expect(mocks.setPublished).toHaveBeenLastCalledWith('product',false)
  expect(await screen.findByText('Sua vitrine ainda está vazia')).toBeVisible()
 })
 it('permite filtrar e limpar busca sem afetar a vitrine publicada', async () => {
  mocks.list.mockResolvedValue([product(68000)]);const user=userEvent.setup();renderPage()
  await screen.findByRole('article')
  await user.click(screen.getByRole('button',{name:/^Elegíveis/}))
  expect(screen.getByText('Nenhum produto neste filtro')).toBeVisible()
  await user.click(screen.getByRole('button',{name:'Ver todos os produtos'}))
  expect(screen.getByRole('article')).toBeVisible()
 })
 it('mostra erro e recuperação sem simular publicação bem-sucedida', async () => {
  mocks.list.mockRejectedValueOnce(new Error('offline'));renderPage()
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.queryByText('Sua vitrine ainda está vazia')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button',{name:'Tentar novamente'}))
  expect(await screen.findByText('Sua vitrine ainda está vazia')).toBeVisible()
 })
 it('não publica na UI quando o servidor recusa a meta', async () => {
  mocks.list.mockResolvedValue([product(100000)]);mocks.setPublished.mockRejectedValue(new Error('SHOWCASE_SALES_REQUIRED'));renderPage()
  await userEvent.click(await screen.findByRole('button',{name:'Adicionar à vitrine'}))
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.queryByText('Meu curso foi adicionado à vitrine.')).not.toBeInTheDocument()
 })
 it('descarta resposta da conta anterior ao trocar o player', async () => {
  let finish!:(rows:ShowcaseProduct[])=>void
  mocks.list.mockReturnValueOnce(new Promise<ShowcaseProduct[]>(resolve=>{finish=resolve}))
  const view=renderPage(); mocks.auth={user:{id:'other'},loading:false}
  view.rerender(<MemoryRouter><Showcase /></MemoryRouter>)
  await screen.findByText('Sua vitrine ainda está vazia')
  await act(async()=>{finish([product(100000)])})
  expect(screen.queryAllByRole('article')).toHaveLength(0)
 })
 it('limita o progresso e usa centavos inteiros no limiar', () => {
  expect(getProductShowcaseEligibility(99999)).toMatchObject({eligible:false,remainingCents:1})
  expect(getProductShowcaseEligibility(100000)).toMatchObject({status:'eligible',remainingCents:0,progress:100})
  expect(getProductShowcaseEligibility(200000,'date')).toMatchObject({status:'published',progress:100})
  expect(getProductShowcaseEligibility(NaN)).toMatchObject({status:'locked',progress:0})
 })
})
