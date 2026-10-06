import {webcrypto} from 'node:crypto'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {render,screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type {ReactNode} from 'react'
const sdk=vi.hoisted(()=>({state:null as any,confirm:vi.fn(),load:vi.fn(async()=>({}))}))
vi.mock('@stripe/stripe-js/pure',()=>({loadStripe:sdk.load}))
vi.mock('@stripe/react-stripe-js/checkout',()=>({CheckoutElementsProvider:({children}:{children:ReactNode})=>children,PaymentElement:()=> <div aria-label="Campos seguros da Stripe"/>,useCheckoutElements:()=>sdk.state}))
import {StripeInlinePayment,StripeCheckoutConfirmation,StripePaymentFields} from '../features/products/StripeInlinePayment'
import {clearInlineCheckoutAttempt,reserveInlineCheckout} from '../features/products/stripeCheckoutClient'
import {defaultCheckoutDesign,defaultSettings,templateLayout} from '../features/products/checkoutService'
import {CheckoutExperience} from '../features/products/CheckoutExperience'
const checkoutId='11111111-1111-4111-8111-111111111111',buyer={name:'Comprador Teste',email:'buyer@example.com'}
const session={sessionId:'cs_test_1234567890123456',clientSecret:'cs_test_1234567890123456_secret_fixture',accountId:'acct_123456789',publishableKey:'pk_test_fixture',amountCents:1990,currency:'BRL'}
const renderParts=({fields,action}:{fields:ReactNode;action:ReactNode})=><div>{fields}{action}</div>
beforeEach(()=>{vi.stubGlobal('crypto',webcrypto);sessionStorage.clear();clearInlineCheckoutAttempt(checkoutId,'test');sdk.state={type:'success',checkout:{canConfirm:true,confirm:sdk.confirm}};sdk.confirm.mockReset();sdk.load.mockClear()})
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()})
describe('Pagamento seguro incorporado',()=>{
 it('reserva com valor definido pelo servidor e reutiliza tentativa ao recarregar, sem dados de cartão',async()=>{
  const fetch=vi.fn<typeof globalThis.fetch>(async()=>new Response(JSON.stringify(session),{status:200}));vi.stubGlobal('fetch',fetch)
  await reserveInlineCheckout(checkoutId,buyer,'test');await reserveInlineCheckout(checkoutId,buyer,'test')
  const first=JSON.parse(String(fetch.mock.calls[0][1]?.body)),second=JSON.parse(String(fetch.mock.calls[1][1]?.body))
  expect(first).toMatchObject({checkoutId,buyer,uiMode:'elements'});expect(first.requestKey).toBe(second.requestKey)
  expect(first).not.toHaveProperty('amount');expect(first).not.toHaveProperty('card')
  expect(sessionStorage.getItem(`stripe-elements-attempt:test:${checkoutId}`)).not.toContain(buyer.email)
 })
 it('monta o SDK na conta correta e recusa alteração de preço antes da confirmação',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>session})))
  const complete=vi.fn();render(<StripeInlinePayment checkoutId={checkoutId} buyer={buyer} mode="test" price={1990} currency="BRL" design={defaultCheckoutDesign} render={renderParts} onComplete={complete}/>)
  expect(await screen.findByLabelText('Campos seguros da Stripe')).toBeInTheDocument()
  expect(sdk.load).toHaveBeenCalledWith('pk_test_fixture',{stripeAccount:'acct_123456789',locale:'pt-BR'})
 })
 it('não permite confirmar quando o preço reservado mudou',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({...session,amountCents:2990})})))
  render(<StripeInlinePayment checkoutId={checkoutId} buyer={buyer} mode="test" price={1990} currency="BRL" design={defaultCheckoutDesign} render={renderParts} onComplete={vi.fn()}/>)
  expect(await screen.findByRole('alert')).toHaveTextContent('valor da oferta foi alterado')
  expect(screen.queryByLabelText('Campos seguros da Stripe')).not.toBeInTheDocument()
  expect(sdk.confirm).not.toHaveBeenCalled()
 })
 it('uma recusa mantém o formulário disponível e uma aprovação segue para verificação',async()=>{
  sdk.confirm.mockResolvedValueOnce({type:'error',error:{message:'Pagamento recusado'}}).mockResolvedValueOnce({type:'success'})
  const complete=vi.fn(),user=userEvent.setup();render(<StripePaymentFields render={renderParts} design={defaultCheckoutDesign} sessionId={session.sessionId} onComplete={complete}/>)
  await user.click(screen.getByRole('button',{name:'Pagar com segurança'}));expect(await screen.findByRole('alert')).toHaveTextContent('Pagamento recusado');expect(complete).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button',{name:'Pagar com segurança'}));await waitFor(()=>expect(complete).toHaveBeenCalledWith(session.sessionId))
  expect(sdk.confirm).toHaveBeenCalledWith({redirect:'if_required'})
 })
 it('o campo seguro e o botão mantêm as posições e não criam formulário HTML aninhado',async()=>{
  const user=userEvent.setup(),{container}=render(<CheckoutExperience product={{id:'p',name:'Produto',description:'',imageUrl:null,warrantyDays:7,producerDisplayName:'Vendedor'}} price={1990} currency="BRL" layout={templateLayout('minimal')} settings={defaultSettings} paymentAvailable renderPayment={(_buyer,render)=>render({fields:<div>Campos seguros</div>,action:<button type="button">Pagar</button>})}/>)
  await user.type(screen.getByRole('textbox',{name:'Nome completo'}),'Comprador');await user.type(screen.getByRole('textbox',{name:/^E-mail$/}),'buyer@example.com');await user.click(screen.getByRole('button',{name:'Continuar para o pagamento'}))
  expect(container.querySelectorAll('form')).toHaveLength(1);expect(container.querySelector('form form')).toBeNull()
  expect(screen.getByText('Campos seguros').closest('.co-payment-section')).not.toBeNull()
  expect(screen.getByRole('button',{name:'Pagar'}).closest('.co-action-group')).not.toBeNull()
 })
})
describe('Confirmação baseada no processador',()=>{
 it('retornar sem sessão não mostra pagamento confirmado nem consulta o servidor',()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);render(<StripeCheckoutConfirmation checkoutId={checkoutId} sessionId={null}/>)
  expect(screen.queryByText('Pagamento confirmado')).toBeNull();expect(fetch).not.toHaveBeenCalled()
 })
 it('só mostra confirmação quando o servidor verificou pagamento e registro',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({status:'paid',recorded:true})})))
  render(<StripeCheckoutConfirmation checkoutId={checkoutId} sessionId={session.sessionId}/>)
  expect(await screen.findByText('Pagamento confirmado')).toBeVisible()
 })
})
