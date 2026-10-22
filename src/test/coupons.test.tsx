import { render,screen,waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach,describe,expect,it,vi } from 'vitest'
import { CheckoutExperience } from '../features/products/CheckoutExperience'
import { defaultCheckoutDesign,defaultSettings,templateLayout } from '../features/products/checkoutService'
import { CouponCenter } from '../features/products/CouponCenter'
import { couponCenterService } from '../services/couponCenterService'

afterEach(()=>vi.restoreAllMocks())
const product={id:'product',name:'Curso',description:'Aulas',imageUrl:null,warrantyDays:null,producerDisplayName:'Escola'}

describe('cupons',()=>{
 it('aplica o cupom pelo servidor, mostra o desconto e envia o código ao pagar',async()=>{
  const pay=vi.fn().mockResolvedValue(undefined),preview=vi.fn().mockRejectedValueOnce(new Error('Este cupom expirou.')).mockResolvedValueOnce({code:'BEMVINDO',discountCents:2000}),user=userEvent.setup()
  render(<CheckoutExperience product={product} price={10000} currency="BRL" layout={templateLayout('minimal')} design={defaultCheckoutDesign} settings={defaultSettings} paymentAvailable onPay={pay} couponsEnabled onPreviewCoupon={preview}/>)
  await user.type(screen.getByLabelText('Cupom de desconto'),'velho')
  await user.click(screen.getByRole('button',{name:'Aplicar'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Este cupom expirou.')
  await user.clear(screen.getByLabelText('Cupom de desconto'));await user.type(screen.getByLabelText('Cupom de desconto'),'bemvindo')
  await user.click(screen.getByRole('button',{name:'Aplicar'}))
  expect(preview).toHaveBeenLastCalledWith('BEMVINDO')
  expect(await screen.findByText(/aplicado/)).toBeInTheDocument()
  expect(screen.getAllByText('R$ 80,00').length).toBeGreaterThan(0)
  await user.type(screen.getByLabelText('Nome completo'),'Maria Silva');await user.type(screen.getByLabelText('E-mail'),'maria@example.com')
  await user.click(screen.getByRole('button',{name:'Continuar para o pagamento'}));await user.click(screen.getByRole('button',{name:'Ir para o pagamento seguro'}))
  await waitFor(()=>expect(pay).toHaveBeenCalledWith({coupon:{code:'BEMVINDO',discountCents:2000},name:'Maria Silva',email:'maria@example.com'}))
 })
 it('central lista os cupons com situação real e pausa',async()=>{
  vi.spyOn(couponCenterService,'list').mockResolvedValue([{id:'c1',code:'BEMVINDO',productId:'p1',productName:'Curso',discountType:'percentage',discountValue:2000,usesCount:3,totalLimit:3,startsAt:null,expiresAt:null,status:'active'},{id:'c2',code:'BLACK',productId:'p1',productName:'Curso',discountType:'fixed',discountValue:5000,usesCount:0,totalLimit:null,startsAt:null,expiresAt:null,status:'active'}])
  const set=vi.spyOn(couponCenterService,'setStatus').mockResolvedValue(undefined),user=userEvent.setup()
  render(<MemoryRouter><CouponCenter/></MemoryRouter>)
  expect(await screen.findByText('Esgotado')).toBeInTheDocument()
  expect(screen.getByText('20%')).toBeInTheDocument();expect(screen.getByText('R$ 50,00')).toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:'Pausar cupom BLACK'}))
  expect(set).toHaveBeenCalledWith('c2','paused')
  expect(screen.getByRole('link',{name:'Editar cupom BLACK'})).toHaveAttribute('href','/app/produtos/p1/coupons')
 })
})
