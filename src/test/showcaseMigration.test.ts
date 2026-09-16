import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222'
const product = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', foreign = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
let db: PGlite
beforeAll(async () => {
 db = new PGlite()
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.products(id uuid primary key,seller_id uuid references auth.users(id),name text,category text,image_url text,deleted_at timestamptz,status text default 'active');
 create table public.payment_transactions(id uuid primary key default gen_random_uuid(),user_id uuid,product_id uuid,status text,currency text default 'BRL',amount_cents bigint,refunded_at timestamptz,chargeback_at timestamptz);
 insert into auth.users values ('${owner}'),('${other}');
 insert into products(id,seller_id,name) values ('${product}','${owner}','Meu produto'),('${foreign}','${other}','Outro produto');`)
 await db.exec(readFileSync('supabase/migrations/20260916090000_product_showcase.sql', 'utf8'))
}, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => { await db.exec('begin'); await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]) })
afterEach(async () => { await db.exec('rollback') })
async function sale(cents: number, status = 'approved', currency = 'BRL', seller = owner, id = product) {
 await db.query('insert into payment_transactions(user_id,product_id,status,currency,amount_cents) values($1,$2,$3,$4,$5)', [seller,id,status,currency,cents])
}
async function list() { return (await db.query<{id:string;gross_sales_cents:number;showcase_status:string}>('select * from list_my_showcase_products()')).rows }
const publish = (id = product, enabled = true) => db.query('select set_product_showcase_publication($1,$2)', [id, enabled])

describe('Vitrine: regra aplicada pelo banco', () => {
 it('inicia vazia sem apagar produtos, inclusive produtos já elegíveis', async () => {
  await sale(100000)
  expect((await db.query('select * from product_showcase_publications')).rows).toHaveLength(0)
  expect((await db.query('select * from products')).rows).toHaveLength(2)
  expect(await list()).toMatchObject([{id:product,showcase_status:'eligible'}])
 })
 it('bloqueia publicação direta abaixo de R$ 1.000,00', async () => {
  await sale(99999); await db.exec('set local role authenticated')
  expect(await list()).toMatchObject([{showcase_status:'locked',gross_sales_cents:99999}])
  await expect(publish()).rejects.toMatchObject({message:'SHOWCASE_SALES_REQUIRED'})
 })
 it('soma vendas do produto, publica no limite exato, persiste e remove sem apagar produto', async () => {
  await sale(68000); await sale(32000); await db.exec('set local role authenticated')
  await publish(); await publish()
  expect(await list()).toMatchObject([{showcase_status:'published',gross_sales_cents:100000}])
  expect((await db.query('select * from product_showcase_publications')).rows).toHaveLength(1)
  await publish(product,false)
  expect(await list()).toMatchObject([{showcase_status:'eligible'}])
 })
 it('ignora vendas inválidas, outra moeda, outro vendedor e outro produto', async () => {
  await sale(68000)
  for (const status of ['pending','declined','refunded','chargeback']) await sale(100000,status)
  await sale(100000,'approved','USD'); await sale(100000,'approved','BRL',other)
  await sale(100000,'approved','BRL',owner,foreign)
  expect(await list()).toMatchObject([{id:product,showcase_status:'locked',gross_sales_cents:68000}])
 })
 it('retira da lista publicada quando reembolsos reduzem o total', async () => {
  await sale(100000); await publish()
  await db.exec("update payment_transactions set status='refunded',refunded_at=now()")
  expect(await list()).toMatchObject([{showcase_status:'locked',gross_sales_cents:0}])
  await publish(product,false)
  expect((await db.query('select * from product_showcase_publications')).rows).toHaveLength(0)
 })
 it('impede publicar produtos de outro vendedor', async () => {
  await sale(100000,'approved','BRL',other,foreign); await db.exec('set local role authenticated')
  await expect(publish(foreign)).rejects.toMatchObject({message:'SHOWCASE_PRODUCT_UNAVAILABLE'})
 })
 it('impede contornar a RPC com insert direto na tabela', async () => {
  await db.exec('set local role authenticated')
  await expect(db.query('insert into product_showcase_publications(product_id,seller_id) values($1,$2)',[product,owner])).rejects.toMatchObject({code:'42501'})
 })
 it('RLS impede ler publicações alheias', async () => {
  await db.query('insert into product_showcase_publications(product_id,seller_id) values($1,$2)',[foreign,other])
  await db.exec('set local role authenticated')
  expect((await db.query('select * from product_showcase_publications')).rows).toHaveLength(0)
 })
 it('não permite RPC anônima', async () => {
  await db.exec('set local role anon')
  await expect(db.query('select * from list_my_showcase_products()')).rejects.toMatchObject({code:'42501'})
 })
 it('não expõe produtos excluídos ou arquivados', async () => {
  await db.exec("update products set status='archived'")
  expect(await list()).toEqual([])
  await expect(publish()).rejects.toMatchObject({message:'SHOWCASE_PRODUCT_UNAVAILABLE'})
 })
})
