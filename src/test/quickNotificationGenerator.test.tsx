import {render,screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {beforeEach,describe,expect,it,vi} from 'vitest'
import {QuickNotificationGenerator,smartAmountCents} from '../components/settings/QuickNotificationGenerator'
import {pushSubscriptionService} from '../services/pushSubscriptionService'

const device={id:'d1',deviceId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Celular',platform:'mobile',browser:'Safari',operatingSystem:'iOS',type:'mobile',status:'Ativo',enabled:true,lastSeenAt:'',isCurrentDevice:true}
beforeEach(()=>{vi.restoreAllMocks()})

describe('valores automáticos',()=>{
 it('usa preços de checkout reais e faixas próprias para assinatura e saque',()=>{
  const first=()=>0,last=(max:number)=>max-1
  expect(smartAmountCents('sale_approved',first)).toBe(2690)
  expect(smartAmountCents('sale_approved',last)).toBe(99700)
  expect(smartAmountCents('subscription_renewed',first)).toBe(2990)
  expect(smartAmountCents('withdrawal_completed',first)).toBe(100000)
  for(let index=0;index<200;index++){const cents=smartAmountCents('pix_paid');expect(cents).toBeGreaterThanOrEqual(2690);expect(cents).toBeLessThanOrEqual(99700)}
 })
})

describe('gerador rápido',()=>{
 it('envia um aviso no padrão do gateway para os aparelhos conectados',async()=>{
  vi.spyOn(pushSubscriptionService,'devices').mockResolvedValue([device] as never)
  const send=vi.spyOn(pushSubscriptionService,'sendManual').mockResolvedValue({ok:true,eventId:'manual-test'})
  const user=userEvent.setup()
  render(<QuickNotificationGenerator/>)
  await screen.findByText(/1 aparelho conectado/)
  await user.click(screen.getByRole('radio',{name:'Pix pago'}))
  await user.click(screen.getByRole('button',{name:'Fixo'}))
  const input=screen.getByLabelText('Valor fixo');await user.clear(input);await user.type(input,'97,00')
  await user.click(screen.getByRole('button',{name:'1'}))
  await user.click(screen.getByRole('button',{name:/Enviar agora/}))
  await waitFor(()=>expect(send).toHaveBeenCalledTimes(1))
  expect(send).toHaveBeenCalledWith(expect.objectContaining({notificationType:'pix_paid',title:'Pix pago!',body:'Valor: R$ 97,00',deviceIds:[device.deviceId]}))
  expect(await screen.findByText(/1 aviso enviado/)).toBeInTheDocument()
 })
 it('sem aparelho conectado pede para ativar as notificações',async()=>{
  vi.spyOn(pushSubscriptionService,'devices').mockResolvedValue([])
  render(<QuickNotificationGenerator/>)
  expect(await screen.findByRole('button',{name:/Ativar notificações neste aparelho/})).toBeInTheDocument()
  expect(screen.queryByRole('button',{name:/Enviar sequência|Enviar agora/})).not.toBeInTheDocument()
 })
})
