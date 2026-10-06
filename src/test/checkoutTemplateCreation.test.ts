import {describe,expect,it,vi} from 'vitest'
const {insert}=vi.hoisted(()=>({insert:vi.fn()}))
vi.mock('../lib/supabase',()=>({supabase:{from:()=>({insert})}}))
import {checkoutService} from '../features/products/checkoutService'
import {providedCheckoutTemplate} from '../features/products/checkoutTemplate'

describe('Criação do checkout com o modelo enviado',()=>{
 it('persiste um template aceito pelo banco e guarda o JSON completo no rascunho',async()=>{
  insert.mockImplementation(payload=>({select:()=>({single:async()=>({data:{...payload,id:'checkout',lock_version:1},error:null})})}))
  const checkout=await checkoutService.create('seller','product',{name:'Checkout principal',offerId:'offer',template:'modelo-json'})
  const payload=insert.mock.calls[0][0]
  expect(payload.template).toBe('minimal')
  expect(payload.offer_id).toBe('offer')
  expect(payload.draft_settings.templateConfig).toEqual(providedCheckoutTemplate)
  expect(checkout.design.primary).toBe('#6366f1')
  expect(checkout.layout.map(block=>block.type)).toEqual(expect.arrayContaining(['banner','timer','buyer_form','order_summary','payment_methods','button']))
 })
})
