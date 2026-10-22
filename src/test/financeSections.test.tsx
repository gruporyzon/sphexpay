import { render,screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach,describe,expect,it,vi } from 'vitest'
import { FeesSection } from '../features/finance/FeesSection'
import { CustomChargesSection } from '../features/finance/CustomChargesSection'
import { stripeConnectService } from '../services/stripeConnectService'
import { customChargeService } from '../services/customChargeService'
import { monthlyRecurringCents } from '../features/subscriptions/subscriptionService'

afterEach(()=>vi.restoreAllMocks())
const finance={mode:'live' as const,connected:true,payoutsEnabled:true,balance:{available:[],pending:[]},schedule:{interval:'daily' as const,delayDays:2,weeklyAnchor:null,monthlyAnchor:null},payouts:[],platformFeeBps:250,methods:{card:true,pix:true,boleto:false}}
describe('Financeiro: taxas e cobranças',()=>{
 it('mostra a taxa real da plataforma e os métodos ativos',async()=>{
  vi.spyOn(stripeConnectService,'finance').mockResolvedValue(finance)
  render(<FeesSection/>)
  expect(await screen.findByText('2,5%')).toBeInTheDocument()
  expect(screen.getByText('R$ 2,50')).toBeInTheDocument()
  expect(screen.getAllByText('Ativo')).toHaveLength(2)
  expect(screen.getByText('Inativo')).toBeInTheDocument()
 })
 it('envia a cobrança com o valor em centavos e os métodos escolhidos',async()=>{
  vi.spyOn(customChargeService,'list').mockResolvedValue([])
  const create=vi.spyOn(stripeConnectService,'createCharge').mockResolvedValue({id:'c1',customerName:'Ana',customerEmail:'ana@exemplo.com',description:'Mentoria',amountCents:123456,currency:'BRL',methods:['pix'],status:'open',dueDate:'2026-10-25',hostedUrl:'https://invoice.stripe.com/i/1',createdAt:'2026-10-22T00:00:00Z',paidAt:null,mode:'live'})
  const user=userEvent.setup()
  render(<CustomChargesSection/>)
  await screen.findByText('Nenhuma cobrança ainda')
  await user.type(screen.getByLabelText('Nome do cliente'),'Ana')
  await user.type(screen.getByLabelText('E-mail do cliente'),'ana@exemplo.com')
  await user.type(screen.getByLabelText('Descrição'),'Mentoria')
  await user.type(screen.getByLabelText('Valor (R$)'),'1.234,56')
  await user.click(screen.getByLabelText('Boleto'));await user.click(screen.getByLabelText('Cartão'))
  await user.click(screen.getByRole('button',{name:/Enviar cobrança/}))
  expect(create).toHaveBeenCalledWith(expect.objectContaining({amountCents:123456,methods:['pix'],customerEmail:'ana@exemplo.com',dueDays:3}))
  expect(await screen.findByText('Cobrança enviada')).toBeInTheDocument()
 })
 it('calcula a receita recorrente mensal por intervalo',()=>{
  const base={id:'s',customerId:null,customerName:'A',customerEmail:null,productId:null,productName:'P',createdAt:'',currentPeriodEnd:null,cancelledAt:null,statusChangedAt:null,currency:'BRL'}
  expect(monthlyRecurringCents([{...base,status:'active',amountCents:12000,billingInterval:'year'},{...base,status:'past_due',amountCents:3000,billingInterval:'month'},{...base,status:'cancelled',amountCents:9999,billingInterval:'month'}])).toBe(4000)
 })
})
