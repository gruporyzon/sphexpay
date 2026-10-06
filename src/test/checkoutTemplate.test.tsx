import {afterEach,describe,expect,it,vi} from 'vitest'
import {act,render,screen} from '@testing-library/react'
import {CheckoutExperience} from '../features/products/CheckoutExperience'
import {CheckoutCountdown} from '../features/products/CheckoutCountdown'
import {CheckoutTemplatePanel} from '../features/products/CheckoutTemplatePanel'
import {applyCheckoutTemplate,parseCheckoutTemplate,providedCheckoutTemplate,exportCheckoutTemplate} from '../features/products/checkoutTemplate'
import {defaultCheckoutDesign,defaultSettings,templateLayout} from '../features/products/checkoutService'
import userEvent from '@testing-library/user-event'
const product={id:'product',name:'Oferta do vendedor',description:'Descrição real da oferta',imageUrl:null,warrantyDays:7,producerDisplayName:'Vendedor'}
const snapshot=()=>({layout:templateLayout('minimal'),design:{...defaultCheckoutDesign,primary:'#ff6a2f',background:'#f6f6f3'},settings:{...defaultSettings,repeatEmail:true}})
afterEach(()=>vi.useRealTimers())
describe('Modelo JSON solicitado',()=>{
 it('aplica índigo, fundo branco e botão arredondado sem perder mídia ou identificação',()=>{
  const original=snapshot();original.layout.find(b=>b.type==='banner')!.props.url='https://example.com/banner.mp4'
  const result=applyCheckoutTemplate(parseCheckoutTemplate(JSON.stringify(providedCheckoutTemplate)),original)
  expect(result.design).toMatchObject({primary:'#6366f1',accent:'#6366f1',background:'#ffffff',buttonShape:'rounded'})
  expect(result.settings.repeatEmail).toBe(true)
  expect(result.layout.find(b=>b.type==='banner')!.props.url).toBe('https://example.com/banner.mp4')
  expect(result.settings.templateConfig?.config.element_styles.banner).toEqual({accent:'#aa8666',animation:{preset:'shimmer',speed:'fast'}})
  expect(original.design.primary).toBe('#ff6a2f')
  expect(original.layout).toEqual(result.layout)
 })
 it.each([
  {version:2},
  {kind:'html'},
  {config:{...providedCheckoutTemplate.config,checkout_accent_color:'url(javascript:alert(1))'}},
  {config:{...providedCheckoutTemplate.config,mobile_elements_order:['timer','timer']}},
  {config:{...providedCheckoutTemplate.config,mobile_elements_slots:{banner:'arbitrary'}}},
  {config:{...providedCheckoutTemplate.config,element_styles:{banner:{animation:{preset:'execute',speed:'fast'}}}}},
  {config:{...providedCheckoutTemplate.config,custom_elements:[{id:'x',type:'html',props:{text:'<script/>'}}]}}
 ])('rejeita configuração insegura ou incompatível: %j',patch=>expect(()=>parseCheckoutTemplate({...providedCheckoutTemplate,...patch})).toThrow())
 it('rejeita JSON quebrado, objetos perigosos e modelos grandes',()=>{
  expect(()=>parseCheckoutTemplate('{')).toThrow('JSON inválido')
  expect(()=>parseCheckoutTemplate(JSON.stringify(providedCheckoutTemplate).replace('"banner":{}','"banner":{"__proto__":{}}'))).toThrow()
  expect(()=>parseCheckoutTemplate(' '.repeat(65537))).toThrow('64 KB')
 })
 it('publica posições e ordem do celular, animação e conteúdo real sem criar provas sociais',()=>{
  const model=applyCheckoutTemplate(providedCheckoutTemplate,snapshot()),{container}=render(<CheckoutExperience {...model} product={product} price={19700} currency="BRL" paymentAvailable/>)
  expect(container.querySelector('[data-checkout-element="banner"]')).toHaveClass('co-template-animation-shimmer')
  expect(container.querySelector('[data-checkout-element="banner"]')).toHaveStyle({'--co-element-accent':'#aa8666','--co-animation-duration':'1.6s'})
  expect(container.querySelector('[data-checkout-element="product_info"]')).toHaveAttribute('data-mobile-slot','sidebar')
  expect(container.querySelector('[data-checkout-element="advantages"]')).toHaveAttribute('data-mobile-slot','sidebar')
  expect(container.querySelector('[data-checkout-element="order_summary"]')).toHaveAttribute('data-mobile-slot','form_bottom')
  expect(container.querySelector('[data-checkout-element="payment_icons"]')).toHaveAttribute('data-mobile-slot','form_bottom')
  expect(container.querySelector('[data-checkout-element="guarantee"]')).toHaveAttribute('data-mobile-slot','form_bottom')
  expect(container.querySelector('button[type="submit"]')).toHaveClass('co-action-shape-rounded')
  expect(container.querySelector('[data-checkout-element="testimonials"]')).toBeNull()
  expect(container.querySelector('[data-checkout-element="scarcity"]')).toBeNull()
  expect(screen.queryByLabelText('Prazo da oferta')).toBeNull()
  expect(screen.getByRole('heading',{name:product.name})).toBeVisible()
 })
 it('mantém o resumo financeiro independente de customizações, ordena avisos antes da ação',()=>{
  const model=applyCheckoutTemplate(providedCheckoutTemplate,snapshot());model.layout.push({id:'notice',type:'notice',props:{elementKey:'urgency',text:'Inscrições até a data informada'}})
  const {container}=render(<CheckoutExperience {...model} product={product} price={19700} currency="BRL" paymentAvailable/>)
  expect(container.querySelector('[data-checkout-element="urgency"]')).toHaveAttribute('data-mobile-slot','pre_cta')
  expect(container.querySelector('[data-checkout-element="urgency"]')).toHaveStyle({'--co-mobile-order':'307'})
  expect(container.querySelector('.co-total')).toHaveTextContent('R$ 197,00')
 })
 it('exporta as cores e o formato atualmente editados',()=>{
  const exported=exportCheckoutTemplate(providedCheckoutTemplate,{...defaultCheckoutDesign,primary:'#123456',background:'#ffffff',buttonShape:'pill'})
  expect(parseCheckoutTemplate(exported).config).toMatchObject({checkout_accent_color:'#123456',checkout_button_style:'pill'})
  expect(providedCheckoutTemplate.config.checkout_accent_color).toBe('#6366f1')
 })
 it('importa o modelo e permite mudar a posição de elementos sem perder os outros dados',async()=>{
  const apply=vi.fn(),user=userEvent.setup();render(<CheckoutTemplatePanel onApply={apply}/>)
  await user.click(screen.getByRole('button',{name:'Aplicar modelo enviado'}))
  expect(apply).toHaveBeenCalledWith(providedCheckoutTemplate)
  await user.click(screen.getByText('Celular: ordem e posições'));await user.selectOptions(screen.getByLabelText('Posição de order_summary no celular'),'pre_cta')
  expect(apply.mock.lastCall?.[0].config.mobile_elements_slots.order_summary).toBe('pre_cta')
  expect(apply.mock.lastCall?.[0].config.timer.style.accent).toBe('#FACC15')
 })
})
describe('Timer com prazo real',()=>{
 it('conta pelo horário da oferta, mostra progresso e não reinicia ao abrir novamente',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))
  const props={endsAt:'2026-10-06T14:00:00Z',startsAt:'2026-10-06T10:00:00Z',style:providedCheckoutTemplate.config.timer.style}
  const first=render(<CheckoutCountdown {...props}/>);expect(screen.getByText('02')).toBeVisible();expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','50')
  act(()=>vi.advanceTimersByTime(3600000));expect(screen.getByText('01')).toBeVisible();first.unmount()
  render(<CheckoutCountdown {...props}/>);expect(screen.getByText('01')).toBeVisible();expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','75')
  act(()=>vi.advanceTimersByTime(3600000));expect(screen.getByText('Prazo encerrado')).toBeVisible();expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','100')
 })
 it('não inventa um prazo ou progresso quando não foram informados',()=>{
  const {container,rerender}=render(<CheckoutCountdown endsAt="" style={providedCheckoutTemplate.config.timer.style}/>);expect(container).toBeEmptyDOMElement()
  rerender(<CheckoutCountdown endsAt="2099-01-01T12:00:00Z" style={providedCheckoutTemplate.config.timer.style}/>);expect(screen.queryByRole('progressbar')).toBeNull()
 })
})
