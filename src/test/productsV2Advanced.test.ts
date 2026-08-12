import {readFileSync} from 'node:fs'
import {describe,expect,it} from 'vitest'
import {buildTrackedUrl,isInvalidProductRelation} from '../features/products/advancedService'

const sql=readFileSync(`${process.cwd()}/supabase/migrations/20260812100000_products_v2_advanced.sql`,'utf8')
describe('Products V2 advanced',()=>{
 it('preserva somente parâmetros de tracking compatíveis e mantém query existente',()=>{
  expect(buildTrackedUrl('https://checkout.example/p?a=1',{utm_source:'meta',utm_campaign:' lançamento ',evil:'secret'})).toBe('https://checkout.example/p?a=1&utm_source=meta&utm_campaign=lan%C3%A7amento')
 })
 it('impede relações de produto consigo mesmo no cliente e no banco',()=>{
  expect(isInvalidProductRelation('p1','p1')).toBe(true)
  expect(isInvalidProductRelation('p1','p2')).toBe(false)
  expect(sql).toContain('product_order_bump_no_self')
  expect(sql).toContain('product_funnel_no_self')
 })
 it('valida cupom, expiração, oferta, assinatura, mínimo e método no backend',()=>{
  for(const rule of ['validate_product_coupon','expired','offer_not_allowed','subscription_not_allowed','minimum_not_met','payment_method_not_allowed','limit_reached'])expect(sql).toContain(rule)
  expect(sql).toContain("security definer")
  expect(sql).toContain('select billing_type,price_cents into v_billing,v_amount_cents')
  expect(sql).not.toContain('p_amount_cents-v_discount')
 })
 it('rejeita referências comerciais pertencentes a outro merchant',()=>{
  expect(sql).toContain('product_commercial_reference_guard')
  for(const error of ['ORDER_BUMP_REFERENCE_MISMATCH','FUNNEL_REFERENCE_MISMATCH','LINK_OFFER_MISMATCH','COUPON_OFFER_MISMATCH'])expect(sql).toContain(error)
 })
 it('deduplica Purchase e protege percentuais de coprodução',()=>{
  expect(sql).toContain('unique(integration_id,event_name,order_id)')
  expect(sql).toContain('COPRODUCTION_SHARE_EXCEEDED')
  expect(sql).toContain('for update')
 })
 it('exige configuração comercial real antes de publicar',()=>{
  expect(sql).toContain('PRODUCT_OFFER_REQUIRED')
  expect(sql).toContain('PRODUCT_PAYMENT_REQUIRED')
  expect(sql).toContain('PRODUCT_CHECKOUT_REQUIRED')
 })
})
