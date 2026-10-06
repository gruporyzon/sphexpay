import {describe,it,expect,vi} from 'vitest'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {CheckoutExperience} from '../features/products/CheckoutExperience'
import {CheckoutMedia} from '../features/products/CheckoutMedia'
import {safeCheckoutUrl,checkoutPublicUrl,validateCheckoutMedia} from '../features/products/checkoutMedia'
import {defaultCheckoutDesign,defaultSettings,templateLayout} from '../features/products/checkoutService'
const product={id:'product',name:'Produto teste',description:'Uma oferta publicada',imageUrl:null,warrantyDays:null,producerDisplayName:'Vendedor'}
const props={product,price:19700,currency:'BRL' as const,layout:templateLayout('minimal'),design:defaultCheckoutDesign,settings:defaultSettings}
describe('Checkout público personalizado',()=>{
 it('avança, permite editar identificação e envia só nome e e-mail para o fluxo oficial',async()=>{
  const pay=vi.fn().mockResolvedValue(undefined),user=userEvent.setup();render(<CheckoutExperience {...props} paymentAvailable onPay={pay}/>)
  await user.type(screen.getByLabelText('Nome completo'),'Maria Silva');await user.type(screen.getByLabelText('E-mail'),'MARIA@example.com')
  await user.click(screen.getByRole('button',{name:'Continuar para o pagamento'}));expect(pay).not.toHaveBeenCalled()
  expect(screen.getByText('Cartão de crédito')).toBeVisible();await user.click(screen.getByRole('button',{name:'Editar'}));expect(screen.getByLabelText('E-mail')).toHaveValue('MARIA@example.com')
  await user.click(screen.getByRole('button',{name:'Continuar para o pagamento'}));await user.click(screen.getByRole('button',{name:'Ir para o pagamento seguro'}))
  await waitFor(()=>expect(pay).toHaveBeenCalledWith({name:'Maria Silva',email:'maria@example.com'}))
  expect(document.querySelector('input[name="cardNumber"]')).toBeNull()
 })
 it('repetição de e-mail valida identidade e prévia nunca chama o processador',async()=>{
  const pay=vi.fn(),user=userEvent.setup();render(<CheckoutExperience {...props} preview settings={{...defaultSettings,repeatEmail:true}} onPay={pay}/>)
  await user.type(screen.getByLabelText('Nome completo'),'Maria Silva');await user.type(screen.getByLabelText('E-mail'),'maria@example.com');await user.type(screen.getByLabelText('Confirme seu e-mail'),'other@example.com')
  await user.click(screen.getByRole('button',{name:'Continuar para o pagamento'}));expect(screen.getByRole('alert')).toHaveTextContent('Os e-mails precisam ser iguais.')
  await user.clear(screen.getByLabelText('Confirme seu e-mail'));await user.type(screen.getByLabelText('Confirme seu e-mail'),'maria@example.com');await user.click(screen.getByRole('button',{name:'Continuar para o pagamento'}));await user.click(screen.getByRole('button',{name:'Ir para o pagamento seguro'}));expect(pay).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('Publique o checkout')
 })
 it('bloqueia cobrança indisponível e retorno da Stripe não inventa aprovação',async()=>{
  const user=userEvent.setup(),{rerender}=render(<CheckoutExperience {...props} paymentMessage="Ative sua integração"/>);await user.type(screen.getByLabelText('Nome completo'),'Maria Silva');await user.type(screen.getByLabelText('E-mail'),'maria@example.com');await user.click(screen.getByRole('button',{name:'Continuar para o pagamento'}));expect(screen.getByRole('button',{name:'Ir para o pagamento seguro'})).toBeDisabled();expect(screen.getByRole('status')).toHaveTextContent('Ative sua integração')
  rerender(<CheckoutExperience {...props} returned/>);expect(screen.getByRole('heading',{name:'Pagamento em verificação'})).toBeVisible();expect(screen.queryByText('Pagamento aprovado')).toBeNull()
 })
 it('renderiza só banners publicados visíveis e preserva vídeo com controles',()=>{
  const {container}=render(<CheckoutExperience {...props} layout={[...props.layout,{id:'hidden',type:'banner',hidden:true,props:{url:'https://example.com/hidden.jpg'}},{id:'video',type:'banner',props:{url:'https://example.com/banner.mp4',mediaKind:'video',poster:'https://example.com/poster.jpg',ratio:'21/9'}}]}/>);
  expect(container.querySelector('img[src*="hidden.jpg"]')).toBeNull();const video=container.querySelector('video')!;expect(video).toHaveAttribute('src','https://example.com/banner.mp4');expect(video).toHaveAttribute('controls');expect(video).toHaveAttribute('playsinline');expect(video).not.toHaveAttribute('autoplay')
  fireEvent.error(video);expect(screen.getByText('Mídia indisponível')).toBeVisible()
 })
 it('URLs rejeitam scripts, HTTP e credenciais; links públicos usam a origem real',()=>{
  for(const url of ['javascript:alert(1)','data:image/svg+xml,test','http://example.com/test','https://user:secret@example.com/test'])expect(safeCheckoutUrl(url)).toBe('')
  expect(safeCheckoutUrl('https://example.com/banner.mp4?version=1')).toContain('https://example.com/')
  expect(checkoutPublicUrl('checkout-id','https://www.sphexpay.com.br')).toBe('https://www.sphexpay.com.br/pay/checkout-id')
 })
 it('recusa conteúdo falso e arquivos grandes antes de enviar; aceita MP4 válido',async()=>{
  const file=(type:string,bytes:number[],size=bytes.length)=>({type,size,slice:()=>({arrayBuffer:async()=>new Uint8Array(bytes).buffer})}) as File
  await expect(validateCheckoutMedia(file('image/png',[1,2,3]))).rejects.toThrow('conteúdo')
  await expect(validateCheckoutMedia(file('video/mp4',[],30*1024*1024))).rejects.toThrow('25 MB')
  await expect(validateCheckoutMedia(file('text/html',[1]))).rejects.toThrow('Use JPG')
  await expect(validateCheckoutMedia(file('video/mp4',[0,0,0,24,102,116,121,112,105,115,111,109]))).resolves.toBe('video')
 })
 it('mídia insegura mostra estado útil em vez de tentar carregar HTML',()=>{
  const {container}=render(<CheckoutMedia block={{id:'bad',type:'video',props:{url:'javascript:alert(1)'}}}/>);expect(container.querySelector('video')).toBeNull();expect(screen.getByText('Adicione seu vídeo de apresentação')).toBeVisible()
 })
})
