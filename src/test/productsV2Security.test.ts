import {readFileSync} from 'node:fs'
import {describe,expect,it} from 'vitest'

const migration=readFileSync(`${process.cwd()}/supabase/migrations/20260811120000_products_v2.sql`,'utf8')
const app=readFileSync(`${process.cwd()}/src/App.tsx`,'utf8')

describe('Products V2 security and routing',()=>{
 it('keeps the existing products table and evolves it without replacing public IDs',()=>{
  expect(migration).toContain('alter table public.products')
  expect(migration).not.toMatch(/drop table[^;]*products/i)
  expect(migration).toContain('product_offer_sync_legacy')
 })
 it('enforces ownership and RLS for every private product entity',()=>{
  for(const table of ['product_offers','product_payment_settings','product_delivery_settings','product_modules','product_activity_log'])expect(migration).toContain(`'${table}'`)
  expect(migration).toContain('enable row level security')
  expect(migration).toContain('seller_id=auth.uid()')
  expect(migration).toContain("(storage.foldername(name))[1]=auth.uid()::text")
 })
 it('uses soft deletion and protects products with financial history',()=>{
  expect(migration).toContain('deleted_at timestamptz')
  expect(migration).toContain('archived_at timestamptz')
 })
 it('cria produto, oferta e entrega na mesma transação autenticada',()=>{
  expect(migration).toContain('function public.create_product_v2')
  expect(migration).toContain("if auth.uid() is null")
  expect(migration).toContain('insert into public.product_offers')
  expect(migration).toContain('insert into public.product_delivery_settings')
 })
 it('exposes canonical and requested compatibility routes',()=>{
  expect(app).toContain('produtos/:id/:section')
  expect(app).toContain('/dashboard/products')
 })
})
