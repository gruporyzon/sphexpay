import { MemoryRouter,Route,Routes,useLocation } from 'react-router-dom'
import { render,screen,waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach,describe,expect,it,vi } from 'vitest'
import type { PaymentLink } from '../features/products/paymentLinksService'

const mocks=vi.hoisted(()=>({list:vi.fn(),rpc:vi.fn()}))
vi.mock('../features/products/paymentLinksService',async original=>({...await original<typeof import('../features/products/paymentLinksService')>(),listPaymentLinks:mocks.list}))
vi.mock('../lib/supabase',()=>({supabase:{rpc:mocks.rpc}}))

import { PaymentLinksPage } from '../features/products/PaymentLinks'
import ProductCheckoutRedirect from '../features/products/ProductCheckoutRedirect'

const Where=()=><output data-testid="where">{useLocation().pathname}{useLocation().search}</output>
const link=(overrides:Partial<PaymentLink>):PaymentLink=>({checkoutId:'11111111-1111-4111-8111-111111111111',checkoutName:'Checkout principal',status:'published',isPublished:true,productId:'22222222-2222-4222-8222-222222222222',productName:'Curso Pro',offerName:'Oferta à vista',priceCents:29700,currency:'BRL',billingType:'one_time',views:12,started:4,paidCount:2,paidCents:59400,...overrides})

describe('links de pagamento reais',()=>{
 beforeEach(()=>{mocks.list.mockReset();mocks.rpc.mockReset()})

 it('lista checkouts publicados com métricas reais e copia o endereço /pay',async()=>{
  mocks.list.mockResolvedValue([link({}),link({checkoutId:'33333333-3333-4333-8333-333333333333',status:'draft',isPublished:false,productName:'Mentoria',views:0,paidCount:0,paidCents:0})])
  const user=userEvent.setup(),writeText=vi.spyOn(navigator.clipboard,'writeText').mockResolvedValue(undefined);render(<MemoryRouter><PaymentLinksPage/></MemoryRouter>)
  expect(await screen.findByText('Curso Pro')).toBeInTheDocument()
  expect(screen.getByText('R$ 594,00')).toBeInTheDocument()
  expect(screen.getByText('Publique este checkout para ativar o link.')).toBeInTheDocument()
  expect(screen.getAllByRole('button',{name:/Copiar link de/})).toHaveLength(1)
  await user.click(screen.getByRole('button',{name:'Copiar link de Curso Pro'}))
  expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/pay/11111111-1111-4111-8111-111111111111`)
  expect(await screen.findByText('Copiado')).toBeInTheDocument()
 })

 it('mostra estado vazio e leva à criação de checkout',async()=>{
  mocks.list.mockResolvedValue([])
  const user=userEvent.setup();render(<MemoryRouter initialEntries={['/app/produtos/links']}><Routes><Route path="*" element={<><PaymentLinksPage/><Where/></>}/></Routes></MemoryRouter>)
  expect(await screen.findByText('Nenhum link ainda')).toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:/Criar checkout/}))
  expect(screen.getByTestId('where')).toHaveTextContent('/app/produtos/checkout')
 })

 it('abre o checkout padrão do produto preservando os parâmetros de campanha',async()=>{
  mocks.rpc.mockResolvedValue({data:'44444444-4444-4444-8444-444444444444',error:null})
  render(<MemoryRouter initialEntries={['/p/22222222-2222-4222-8222-222222222222?utm_source=instagram']}><Routes><Route path="/p/:productId" element={<ProductCheckoutRedirect/>}/><Route path="/pay/:id" element={<Where/>}/></Routes></MemoryRouter>)
  await waitFor(()=>expect(screen.getByTestId('where')).toHaveTextContent('/pay/44444444-4444-4444-8444-444444444444?utm_source=instagram'))
  expect(mocks.rpc).toHaveBeenCalledWith('get_product_checkout_link',{p_product_id:'22222222-2222-4222-8222-222222222222'})
 })

 it('avisa quando o produto não tem checkout publicado',async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:null})
  render(<MemoryRouter initialEntries={['/p/22222222-2222-4222-8222-222222222222']}><Routes><Route path="/p/:productId" element={<ProductCheckoutRedirect/>}/></Routes></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('não tem um checkout publicado')
 })
})
