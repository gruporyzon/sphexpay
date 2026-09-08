import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe,expect,it } from 'vitest'

const sql=readFileSync(resolve(process.cwd(),'supabase/migrations/20260908120000_security_hardening.sql'),'utf8')

describe('migration de endurecimento de segurança',()=>{
 it('é aditiva — nunca derruba tabelas existentes',()=>{
  expect(sql).not.toMatch(/drop\s+table/i)
 })
 it('cria a trilha de auditoria append-only',()=>{
  expect(sql).toContain('create table if not exists public.security_audit_log')
  expect(sql).toContain('force row level security')
  expect(sql).toContain('security_audit_log_own_read')
  expect(sql).toMatch(/grant select on public\.security_audit_log to authenticated/)
  // authenticated não recebe insert/update/delete
  expect(sql).not.toMatch(/grant[^;]*insert[^;]*security_audit_log to authenticated/i)
 })
 it('expõe a RPC controlada record_security_event',()=>{
  expect(sql).toContain('function public.record_security_event')
  expect(sql).toContain('security definer')
  expect(sql).toContain("set search_path to 'public', 'pg_temp'")
  expect(sql).toContain('grant execute on function public.record_security_event(text, jsonb) to authenticated')
 })
 it('força RLS nas tabelas financeiras e de negócio',()=>{
  for(const table of ['payment_transactions','payment_transaction_events','financial_event_outbox','products','dashboard_scenarios','dashboard_exchange_rates']){
   expect(sql).toContain(`'${table}'`)
  }
  expect(sql).toContain('revoke all on public.%I from anon')
 })
 it('remove privilégios de escrita do frontend sobre os logs de transação',()=>{
  expect(sql).toContain("array['payment_transactions', 'payment_transaction_events', 'financial_event_outbox']")
  expect(sql).toContain('grant select on public.%I to authenticated')
 })
 it('registra a classificação de dados como comentário de tabela',()=>{
  expect(sql).toContain('comment on table public.payment_transactions is')
  expect(sql).toMatch(/NAO cont[eé]m PAN/i)
 })
})
