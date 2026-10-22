import { render,screen,waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach,describe,expect,it,vi } from 'vitest'
import { CheckoutExperience } from '../features/products/CheckoutExperience'
import { defaultCheckoutDesign,defaultSettings,templateLayout } from '../features/products/checkoutService'
import { shippingProblem,emptyShippingAddress } from '../features/products/checkoutShipping'
import { ShippingRatesPage } from '../features/shipping/ShippingRatesPage'
import { ShipmentsSection } from '../features/shipping/ShipmentsSection'
import { shippingService } from '../services/shippingService'

afterEach(()=>vi.restoreAllMocks())
const product={id:'product',name:'Camiseta',description:'Algodão',imageUrl:null,warrantyDays:null,producerDisplayName:'Loja'}
const rates=[{id:'r1',name:'Padrão',carrier:'Correios',priceCents:2000,deliveryDaysMin:3,deliveryDaysMax:7},{id:'r2',name:'Expressa',carrier:null,priceCents:4500,deliveryDaysMin:1,deliveryDaysMax:2}]

describe('produtos físicos: entrega',()=>{
 it('pede endereço, soma o frete escolhido e envia a entrega ao pagamento',async()=>{
  const pay=vi.fn().mockResolvedValue(undefined),user=userEvent.setup()
  render(<CheckoutExperience product={product} price={10000} currency="BRL" layout={templateLayout('minimal')} design={defaultCheckoutDesign} settings={defaultSettings} paymentAvailable onPay={pay} shippingRates={rates}/>)
  expect(screen.getAllByText('R$ 120,00').length).toBeGreaterThan(0)
  await user.type(screen.getByLabelText('Nome completo'),'Maria Silva');await user.type(screen.getByLabelText('E-mail'),'maria@example.com')
  await user.type(screen.getByLabelText('CEP'),'0131');await user.type(screen.getByLabelText('Rua'),'Av. Paulista');await user.type(screen.getByLabelText('Número'),'1000')
  await user.type(screen.getByLabelText('Bairro'),'Bela Vista');await user.type(screen.getByLabelText('Cidade'),'São Paulo');await user.selectOptions(screen.getByLabelText('Estado'),'SP')
  await user.click(screen.getByRole('button',{name:'Continuar para o pagamento'}))
  expect(screen.getByRole('alert')).toHaveTextContent('Informe um CEP válido.')
  await user.type(screen.getByLabelText('CEP'),'0100')
  await user.click(screen.getByRole('radio',{name:/Expressa/}))
  expect(screen.getAllByText('R$ 145,00').length).toBeGreaterThan(0)
  await user.click(screen.getByRole('button',{name:'Continuar para o pagamento'}));await user.click(screen.getByRole('button',{name:'Ir para o pagamento seguro'}))
  await waitFor(()=>expect(pay).toHaveBeenCalledWith({name:'Maria Silva',email:'maria@example.com',shipping:{rateId:'r2',address:{postalCode:'01310-100',street:'Av. Paulista',number:'1000',complement:'',district:'Bela Vista',city:'São Paulo',state:'SP'}}}))
 })
 it('valida entrega como o servidor',()=>{
  const address={...emptyShippingAddress,postalCode:'01310-100',street:'Rua A',number:'1',district:'Centro',city:'Recife',state:'PE'}
  expect(shippingProblem(address,'r1',rates)).toBe('')
  expect(shippingProblem(address,'x',rates)).toMatch(/opção de entrega/)
  expect(shippingProblem({...address,state:'XX'},'r1',rates)).toMatch(/estado/)
 })
 it('cadastra frete com preço em centavos e prazo',async()=>{
  vi.spyOn(shippingService,'rates').mockResolvedValue([])
  const save=vi.spyOn(shippingService,'saveRate').mockResolvedValue(undefined)
  const user=userEvent.setup()
  render(<ShippingRatesPage/>)
  await user.click(await screen.findByRole('button',{name:/Novo frete/}))
  await user.type(screen.getByLabelText('Nome do frete'),'Padrão');await user.type(screen.getByLabelText('Transportadora'),'Correios')
  await user.clear(screen.getByLabelText('Preço (R$)'));await user.type(screen.getByLabelText('Preço (R$)'),'19,90')
  await user.type(screen.getByLabelText('Prazo mínimo (dias úteis)'),'3');await user.type(screen.getByLabelText('Prazo máximo (dias úteis)'),'7')
  await user.click(screen.getByRole('button',{name:'Salvar frete'}))
  expect(save).toHaveBeenCalledWith({name:'Padrão',carrier:'Correios',priceCents:1990,minOrderCents:0,deliveryDaysMin:3,deliveryDaysMax:7,active:true},undefined)
 })
 it('atualiza status e rastreio da encomenda',async()=>{
  vi.spyOn(shippingService,'shipments').mockResolvedValue([{orderId:'o1',buyerName:'Ana',buyerEmail:'ana@exemplo.com',productName:'Camiseta',amountCents:12000,shippingCents:2000,currency:'BRL',orderStatus:'approved',address:{recipient:'Ana',postalCode:'01310-100',street:'Av. Paulista',number:'1000',complement:'',district:'Bela Vista',city:'São Paulo',state:'SP'},rateName:'Padrão',status:'pending',trackingCode:null,shippedAt:null,deliveredAt:null,createdAt:'2026-10-22T10:00:00Z'}])
  const update=vi.spyOn(shippingService,'updateShipment').mockResolvedValue(undefined)
  const user=userEvent.setup()
  render(<ShipmentsSection/>)
  expect(await screen.findByText(/Av\. Paulista, 1000/)).toBeInTheDocument()
  await user.selectOptions(screen.getByLabelText('Status do envio de Ana'),'shipped')
  await user.type(screen.getByPlaceholderText('Opcional'),'BR123456789BR')
  await user.click(screen.getByRole('button',{name:/Salvar/}))
  expect(update).toHaveBeenCalledWith('o1','shipped','BR123456789BR')
 })
})
