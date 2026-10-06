import {beforeEach,describe,expect,it,vi} from 'vitest'
import {render,screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {MemoryRouter,Route,Routes} from 'react-router-dom'
import {CheckoutBuilderPage} from '../features/products/CheckoutStudio'
import {checkoutService,defaultCheckoutDesign,defaultSettings} from '../features/products/checkoutService'
import {productServiceV2} from '../features/products/productServiceV2'

vi.mock('../hooks/useAuth',()=>({useAuth:()=>({user:{id:'seller'}})}))
vi.mock('../features/products/productServiceV2',()=>({productServiceV2:{get:vi.fn(),listOffers:vi.fn()}}))
vi.mock('../features/products/checkoutService',async original=>{
 const actual=await original<typeof import('../features/products/checkoutService')>()
 return {...actual,checkoutService:{get:vi.fn(),saveDraft:vi.fn(),publish:vi.fn()}}
})
const initial={id:'checkout',productId:'product',sellerId:'seller',offerId:'offer',name:'Meu checkout',slug:'meu',template:'minimal',status:'draft' as const,isDefault:false,layout:[{id:'heading',type:'title' as const,props:{text:'Título inicial'}}],design:defaultCheckoutDesign,settings:defaultSettings,publishedVersionId:null,lockVersion:7,createdAt:'2026-10-06',updatedAt:'2026-10-06'}
beforeEach(()=>{
 vi.clearAllMocks();localStorage.clear()
 vi.mocked(checkoutService.get).mockResolvedValue(structuredClone(initial))
 vi.mocked(productServiceV2.get).mockResolvedValue({id:'product',name:'Produto'} as never)
 vi.mocked(productServiceV2.listOffers).mockResolvedValue([{id:'offer',name:'Oferta',priceCents:19700,currency:'BRL'}] as never)
 vi.mocked(checkoutService.publish).mockResolvedValue({versionId:'published',version:1,lockVersion:10})
})
async function editor(){
 render(<MemoryRouter initialEntries={['/product/checkout']}><Routes><Route path="/:productId/:checkoutId" element={<CheckoutBuilderPage/>}/></Routes></MemoryRouter>)
 const user=userEvent.setup();await user.click(await screen.findByLabelText('Editar Título'));return user
}
describe('Checkout Studio: publicação íntegra',()=>{
 it('impede publicação se salvar o rascunho falhar',async()=>{
  vi.mocked(checkoutService.saveDraft).mockRejectedValue(new Error('offline'))
  const user=await editor();await user.clear(screen.getByLabelText('Texto'));await user.type(screen.getByLabelText('Texto'),'Minha oferta')
  await user.click(screen.getByRole('button',{name:'Publicar'}))
  await waitFor(()=>expect(screen.getByText(/Não foi possível salvar/)).toBeVisible())
  expect(checkoutService.publish).not.toHaveBeenCalled()
 })
 it('serializa salvamentos e publica a alteração mais recente com a versão correta',async()=>{
  let finish!:(lock:number)=>void
  vi.mocked(checkoutService.saveDraft).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockResolvedValueOnce(9)
  const user=await editor(),text=screen.getByLabelText('Texto');await user.clear(text);await user.type(text,'Versão A');await user.click(screen.getByRole('button',{name:'Salvar'}))
  await waitFor(()=>expect(checkoutService.saveDraft).toHaveBeenCalledTimes(1))
  await user.clear(text);await user.type(text,'Versão B');await user.click(screen.getByRole('button',{name:'Publicar'}));finish(8)
  await waitFor(()=>expect(checkoutService.publish).toHaveBeenCalledWith('checkout',9,expect.any(String)))
  expect(checkoutService.saveDraft).toHaveBeenNthCalledWith(1,'checkout',7,expect.arrayContaining([expect.objectContaining({props:{text:'Versão A'}})]),expect.any(Object),expect.any(Object))
  expect(checkoutService.saveDraft).toHaveBeenNthCalledWith(2,'checkout',8,expect.arrayContaining([expect.objectContaining({props:{text:'Versão B'}})]),expect.any(Object),expect.any(Object))
 })
})
