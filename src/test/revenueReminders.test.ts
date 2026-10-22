import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import {afterAll,beforeAll,describe,expect,it} from 'vitest'
import {buildRevenueReminder,buildSaleNotification,formatBRL} from '../../server/notifications/revenueMessages.js'

describe('aviso de venda no padrão dos gateways',()=>{
 it('mostra só o status e o valor da venda',()=>{
  expect(buildSaleNotification('approved',19700)).toEqual({title:'Venda aprovada!',body:`Valor: ${formatBRL(19700)}`})
  expect(buildSaleNotification('pending',4990)).toEqual({title:'Venda pendente',body:`Valor: ${formatBRL(4990)}`})
 })
})

describe('mensagens dos lembretes de faturamento',()=>{
 it('profissional usa o valor real e o horário',()=>{
  const message=buildRevenueReminder({hour:12,revenueCents:125000,sales:3,style:'professional',firstName:'Rafael Souza',seed:0})
  expect(message.title).toBe('Resumo do meio-dia')
  expect(message.body).toContain(formatBRL(125000))
  expect(message.body).toMatch(/^Rafael, você faturou .* em 3 vendas\.$/)
 })
 it('meia-noite fala do dia anterior',()=>{
  const message=buildRevenueReminder({hour:0,revenueCents:50000,sales:1,style:'professional',seed:0})
  expect(message.title).toBe('Fechamento do dia')
  expect(message.body).toMatch(/^Ontem você faturou .* em 1 venda\./)
 })
 it('humor muda conforme o faturamento e nunca inventa valor',()=>{
  const big=buildRevenueReminder({hour:18,revenueCents:1_500_000,sales:40,style:'humor',seed:0})
  expect(big.body).toContain('Papai Noel')
  expect(big.body).toContain(formatBRL(1_500_000))
  const zero=buildRevenueReminder({hour:15,revenueCents:0,sales:0,style:'humor',seed:1})
  expect(zero.body).not.toMatch(/R\$/)
 })
 it('misto alterna entre os estilos e respeita os limites do aviso',()=>{
  const styles=new Set([0,1,2,3].map(seed=>buildRevenueReminder({hour:20,revenueCents:999,sales:1,style:'mixed',seed}).style))
  expect(styles).toEqual(new Set(['professional','humor']))
  for(const hour of [0,8,12,15,18,20])for(const style of ['professional','humor','mixed'] as const)for(const seed of [0,1,2,7]){
   const message=buildRevenueReminder({hour,revenueCents:seed*123456,sales:seed,style,firstName:'Ana',seed})
   expect(message.title.length).toBeLessThanOrEqual(60)
   expect(message.body.length).toBeLessThanOrEqual(160)
   expect(message.body.charAt(0)).toBe(message.body.charAt(0).toUpperCase())
  }
 })
})

// Banco: quem recebe e quanto faturou, com as preferências de cada vendedor.
const read=(path:string)=>readFileSync(path,'utf8')
const ana='11111111-1111-4111-8111-111111111111',bia='22222222-2222-4222-8222-222222222222',caio='33333333-3333-4333-8333-333333333333'
let db:PGlite
beforeAll(async()=>{
 db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 create table push_subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid,enabled boolean);
 create table payment_transactions(id uuid primary key default gen_random_uuid(),user_id uuid,provider text,status text,currency text,amount_cents bigint,occurred_at timestamptz,approved_at timestamptz,metadata jsonb default '{}');`)
 const sql=read('supabase/migrations/20261022140000_sale_push_and_revenue_reminders.sql')
 // Vault, pg_net e pg_cron não existem no banco de teste.
 await db.exec(sql.slice(0,sql.indexOf('-- [vault]')))
 await db.query(`insert into auth.users values($1,'{"full_name":"Ana Lima"}'),($2,'{}'),($3,'{}')`,[ana,bia,caio])
 await db.query('insert into push_subscriptions(user_id,enabled) values($1,true),($2,true),($3,false)',[ana,bia,caio])
 // 22/10 em Brasília: duas vendas aprovadas da Ana, uma recusada, uma de teste e uma do dia seguinte.
 await db.query(`insert into payment_transactions(user_id,provider,status,currency,amount_cents,occurred_at,approved_at,metadata) values
  ($1,'stripe','approved','BRL',10000,'2026-10-22T12:00:00Z','2026-10-22T12:00:00Z','{"stripe_mode":"live"}'),
  ($1,'stripe','approved','BRL',5000,'2026-10-23T02:30:00Z','2026-10-23T02:30:00Z','{"stripe_mode":"live"}'),
  ($1,'stripe','declined','BRL',9900,'2026-10-22T13:00:00Z',null,'{}'),
  ($1,'stripe','approved','BRL',7700,'2026-10-22T13:00:00Z','2026-10-22T13:00:00Z','{"stripe_mode":"test"}'),
  ($1,'stripe','approved','BRL',3000,'2026-10-23T03:30:00Z','2026-10-23T03:30:00Z','{"stripe_mode":"live"}')`,[ana])
},30000)
afterAll(async()=>{await db?.close()})

describe('lembretes de faturamento no banco',()=>{
 it('soma só as vendas aprovadas de produção do dia de Brasília e respeita as preferências',async()=>{
  let rows=(await db.query<{user_id:string;revenue_cents:string;sales:number;first_name:string|null;style:string}>("select * from revenue_reminder_targets(12,'2026-10-22') order by first_name nulls last")).rows
  expect(rows.map(row=>row.user_id)).toEqual([ana,bia])
  expect(Number(rows[0].revenue_cents)).toBe(15000)
  expect(rows[0]).toMatchObject({sales:2,first_name:'Ana',style:'mixed'})
  await db.query("insert into revenue_reminder_settings(user_id,enabled,style,hours) values($1,true,'humor','{8,20}'),($2,false,'mixed','{0,8,12,15,18,20}')",[ana,bia])
  rows=(await db.query<{user_id:string;revenue_cents:string;sales:number;first_name:string|null;style:string}>("select * from revenue_reminder_targets(12,'2026-10-22')")).rows
  expect(rows).toHaveLength(0)
  rows=(await db.query<{user_id:string;revenue_cents:string;sales:number;first_name:string|null;style:string}>("select * from revenue_reminder_targets(20,'2026-10-22')")).rows
  expect(rows).toHaveLength(1)
  expect(rows[0].style).toBe('humor')
 })
 it('cada pessoa só lê e muda a própria preferência e não escolhe horário fora da lista',async()=>{
  await db.exec(`select set_config('test.uid','${bia}',false);set role authenticated`)
  try{
   expect((await db.query('select * from revenue_reminder_settings')).rows).toHaveLength(1)
   expect((await db.query("update revenue_reminder_settings set style='professional' where user_id=$1",[ana])).affectedRows).toBe(0)
   await expect(db.query("update revenue_reminder_settings set hours='{9}' where user_id=$1",[bia])).rejects.toThrow(/check/)
   await expect(db.query('select * from revenue_reminder_targets(12,current_date)')).rejects.toThrow(/permission denied/)
   await expect(db.query('select * from revenue_reminder_log')).rejects.toThrow(/permission denied/)
  }finally{await db.exec(`reset role;select set_config('test.uid','',false)`)}
 })
})
