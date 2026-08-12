import {describe,expect,it} from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {defaultSettings,templateLayout} from '../features/products/checkoutService'

const migration=fs.readFileSync(path.resolve('supabase/migrations/20260812150000_checkout_studio.sql'),'utf8')
const app=fs.readFileSync(path.resolve('src/App.tsx'),'utf8')
const studio=fs.readFileSync(path.resolve('src/features/products/CheckoutStudio.tsx'),'utf8')

describe('Checkout Studio: regras críticas',()=>{
 it('gera templates editáveis sem HTML ou JavaScript arbitrário',()=>{
  const layout=templateLayout('minimal')
  expect(layout.map(x=>x.type)).toEqual(expect.arrayContaining(['buyer_form','order_summary','payment_methods','button']))
  expect(layout.some(x=>String(x.type).includes('html'))).toBe(false)
  expect(templateLayout('blank')).toEqual([])
 })
 it('mantém requisitos mínimos e dados sensíveis desativados por padrão',()=>{
  expect(defaultSettings.buyerEmail).toBe(true)
  expect(defaultSettings.saveAllowedData).toBe(false)
  expect(defaultSettings.threeDS).toBe(false)
 })
 it('força RLS e ownership em todas as entidades do Studio',()=>{
  for(const table of ['product_checkouts','checkout_versions','checkout_analytics_events']){
   expect(migration).toContain(`alter table public.%I force row level security`)
   expect(migration).toContain(table)
  }
  expect(migration).toContain('seller_id=auth.uid()')
  expect(migration).toContain("revoke all on public.%I from anon")
 })
 it('publica com lock otimista, idempotência, oferta ativa e versão imutável',()=>{
  expect(migration).toContain('CHECKOUT_VERSION_CONFLICT')
  expect(migration).toContain('last_publish_key=p_idempotency_key')
  expect(migration).toContain("o.price_cents>0")
  expect(migration).toContain('insert into public.checkout_versions')
  expect(migration).toContain('CHECKOUT_REQUIRED_COMPONENTS')
 })
 it('protege o principal e faz sua troca em transação no servidor',()=>{
  expect(migration).toContain('CHECKOUT_DEFAULT_REQUIRED')
  expect(migration).toContain('function public.set_default_checkout')
  expect(migration).toContain('product_id=p_product_id and seller_id=auth.uid()')
 })
 it('impede mutação direta de versões e referências de outra conta',()=>{
  expect(migration).toContain('revoke insert,update,delete on public.checkout_versions from authenticated')
  expect(migration).toContain('CHECKOUT_OWNERSHIP_MISMATCH')
  expect(migration).toContain('CHECKOUT_ORDER_BUMP_INVALID')
 })
 it('expõe rotas reais e uma resolução segura para conflito entre abas',()=>{
  for(const route of ['produtos/:id/:section','produtos/:productId/checkout/:checkoutId/builder','produtos/:productId/checkout/:checkoutId/preview'])expect(app).toContain(route)
  expect(studio).toContain('Este checkout foi atualizado em outra sessão.')
  expect(studio).toContain('Recarregar versão')
  expect(studio).toContain('Revisar alterações')
  expect(studio).not.toMatch(/href=["']#/)
 })
 it('expõe somente o snapshot publicado por uma RPC pública dedicada',()=>{
  expect(migration).toContain('function public.get_published_checkout')
  expect(migration).toContain("c.status='published'")
  expect(migration).toContain('join public.checkout_versions v on v.id=c.published_version_id')
  expect(migration).toContain('grant execute on function public.get_published_checkout(uuid) to anon,authenticated')
  expect(migration).not.toMatch(/get_published_checkout[\s\S]*?'sellerId'/)
 })
})
