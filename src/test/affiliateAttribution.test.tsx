import { render,screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach,describe,expect,it,vi } from 'vitest'
// @ts-expect-error Backend JavaScript stays outside the frontend bundle.
import { resolveAffiliate } from '../../server/stripe/payments.js'
import { affiliateCodeFor } from '../features/products/stripeCheckoutClient'
import { AffiliateEditor } from '../features/affiliates/AffiliateEditor'
import { affiliateService } from '../features/affiliates/affiliateService'
import { affiliateLink } from '../features/affiliates/affiliateLink'

const db=(affiliate:Record<string,unknown>|null,link:Record<string,unknown>|null)=>({from:(table:string)=>{const q:any={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='affiliates'?affiliate:link,error:null})};return q}})
const input={sellerId:'seller',productId:'p1',code:'AFF-BRUNO123',buyerEmail:'cliente@exemplo.com',amountCents:10000,currency:'BRL'}
afterEach(()=>{vi.restoreAllMocks();localStorage.clear()})

describe('afiliados de verdade',()=>{
 it('calcula a comissão percentual e fixa no servidor',async()=>{
  expect(await resolveAffiliate(db({id:'a1',email:'bruno@exemplo.com',status:'active'},{commission_type:'percentage',commission_value:'30',currency:'BRL'}),input)).toEqual({affiliateId:'a1',commissionCents:3000})
  expect(await resolveAffiliate(db({id:'a1',email:null,status:'active'},{commission_type:'fixed',commission_value:'2500',currency:'BRL'}),input)).toEqual({affiliateId:'a1',commissionCents:2500})
  expect(await resolveAffiliate(db({id:'a1',email:null,status:'active'},{commission_type:'fixed',commission_value:'99999',currency:'BRL'}),input)).toEqual({affiliateId:'a1',commissionCents:10000})
 })
 it('não paga comissão sem código, afiliado inativo, produto não vinculado, outra moeda ou autoindicação',async()=>{
  const link={commission_type:'percentage',commission_value:'30',currency:'BRL'}
  expect(await resolveAffiliate(db({id:'a1',status:'active'},link),{...input,code:undefined})).toBeNull()
  expect(await resolveAffiliate(db({id:'a1',status:'suspended'},link),input)).toBeNull()
  expect(await resolveAffiliate(db({id:'a1',status:'active'},null),input)).toBeNull()
  expect(await resolveAffiliate(db({id:'a1',status:'active'},{commission_type:'fixed',commission_value:'100',currency:'USD'}),input)).toBeNull()
  expect(await resolveAffiliate(db({id:'a1',email:'Cliente@Exemplo.com',status:'active'},link),input)).toBeNull()
 })
 it('guarda o código do link por 30 dias e ignora código inválido',()=>{
  expect(affiliateCodeFor('c1','?ref=aff-bruno123')).toBe('AFF-BRUNO123')
  expect(affiliateCodeFor('c1','')).toBe('AFF-BRUNO123')
  expect(affiliateCodeFor('c2','?ref=<script>')).toBeUndefined()
  localStorage.setItem('sphex-affiliate:c3',JSON.stringify({code:'AFF-VELHO123',at:Date.now()-31*86400000}))
  expect(affiliateCodeFor('c3','')).toBeUndefined()
  expect(affiliateLink('p1','AFF-BRUNO123','https://sphexpay.com.br')).toBe('https://sphexpay.com.br/p/p1?ref=AFF-BRUNO123')
 })
 it('cadastra o afiliado, vincula produto e mostra o link de divulgação',async()=>{
  vi.spyOn(affiliateService,'products').mockResolvedValue([{id:'p1',name:'Curso',currency:'BRL'}])
  const save=vi.spyOn(affiliateService,'save').mockResolvedValue({id:'a1',publicId:'AFF-BRUNO123'})
  const link=vi.spyOn(affiliateService,'saveProduct').mockResolvedValue('l1')
  const user=userEvent.setup()
  render(<AffiliateEditor affiliate={null} onClose={()=>{}} onSaved={()=>{}}/>)
  await user.type(screen.getByLabelText('Nome'),'Bruno')
  await user.type(screen.getByLabelText('E-mail'),'bruno@exemplo.com')
  await user.click(screen.getByRole('button',{name:'Cadastrar afiliado'}))
  expect(save).toHaveBeenCalledWith({name:'Bruno',email:'bruno@exemplo.com',status:'active'},undefined)
  await user.selectOptions(await screen.findByLabelText('Produto'),'p1')
  await user.type(screen.getByLabelText('Comissão (%)'),'30')
  await user.click(screen.getByRole('button',{name:/Vincular/}))
  expect(link).toHaveBeenCalledWith('a1',{productId:'p1',commissionType:'percentage',commissionValue:30,currency:'BRL'})
  expect(await screen.findByText(/\/p\/p1\?ref=AFF-BRUNO123/)).toBeInTheDocument()
 })
})
